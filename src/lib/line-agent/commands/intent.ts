/**
 * intent.ts
 *
 * Deterministic intent classifier for KNOWN commands, plus an injectable LLM
 * fallback seam.
 *
 * Design rules:
 * - Known commands are classified by deterministic keyword/pattern matching
 *   FIRST — no model call.
 * - The LLM fallback is used ONLY when the deterministic pass returns null
 *   (i.e. the command is unknown).
 * - The permission layer ALWAYS gates the final action, regardless of what the
 *   LLM says.  The LLM can never widen permissions.
 * - Tests inject a stub via the LlmIntentClassifier interface — the real model
 *   adapter is NOT instantiated in tests and no API keys are used.
 */

// ---------------------------------------------------------------------------
// Intent action union
// ---------------------------------------------------------------------------

/**
 * All possible actions the command router understands.
 *
 * Dev actions (code_edit, deploy, parser_change, schema_change) are defined
 * here so the permission layer can explicitly deny them when the source is
 * line_partner_group.
 *
 * Operational actions (analyze, ocr, web_search, parse, draft, bug_packet,
 * respond, send) are allowed from the partner group.
 */
export type IntentAction =
  // Operational (allowed from partner group)
  | 'analyze'
  | 'ocr'
  | 'web_search'
  | 'parse'
  | 'draft'
  | 'bug_packet'
  | 'respond'
  | 'send'
  // Dev-plane actions (NOT allowed from partner group)
  | 'code_edit'
  | 'deploy'
  | 'parser_change'
  | 'schema_change'
  // Internal routing — not user-facing
  | 'create_case'
  | 'update_case'
  | 'silent'
  | 'unknown'

// ---------------------------------------------------------------------------
// CommandIntent type
// ---------------------------------------------------------------------------

export interface CommandIntent {
  /** The action inferred from the command text. */
  action: IntentAction
  /** Confidence in the classification. */
  confidence: 'high' | 'medium' | 'low'
  /** Whether the classification was deterministic or LLM-based. */
  source: 'deterministic' | 'llm'
  /** Optional extra context from the classifier. */
  meta?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// LLM fallback seam (injectable interface)
// ---------------------------------------------------------------------------

/**
 * Seam interface for LLM intent classification.
 *
 * Production code will inject a real model adapter.
 * Test code injects a stub — no API keys, no model calls.
 *
 * IMPORTANT: Even if the LLM returns a dev action (deploy, code_edit, etc.)
 * for a partner-group message, the permission layer in permissions.ts will
 * DENY it.  The LLM seam has no ability to widen permissions.
 */
export interface LlmIntentClassifier {
  classify(text: string): Promise<CommandIntent>
}

/**
 * Safe default classifier used by the route/webhook wiring in M1.
 *
 * It performs NO API calls and requires NO keys: every fallback resolves to an
 * `'unknown'` intent.  Known commands are still handled by the deterministic
 * pass in `classifyIntent`; this stub only covers the cases the deterministic
 * pass cannot classify.  The real model adapter replaces it post-M1.
 */
export const safeDefaultLlmClassifier: LlmIntentClassifier = {
  async classify(): Promise<CommandIntent> {
    return { action: 'unknown', confidence: 'low', source: 'llm' }
  },
}

// ---------------------------------------------------------------------------
// Deterministic keyword patterns (source of truth for KNOWN commands)
// ---------------------------------------------------------------------------

type PatternEntry = {
  pattern: RegExp
  action: IntentAction
}

const DETERMINISTIC_PATTERNS: PatternEntry[] = [
  // Dev actions — used to detect and DENY from partner group
  { pattern: /\bdeploy\b/i, action: 'deploy' },
  { pattern: /\bcode[_\s-]?edit\b|\bedit\s+code\b|\bedit\s+the\s+code\b/i, action: 'code_edit' },
  { pattern: /\bparser[_\s-]?change\b|\bchange\s+parser\b|\bchange\s+parser\s+logic\b/i, action: 'parser_change' },
  { pattern: /\bschema[_\s-]?change\b|\bmodify\s+(sanity\s+)?schema\b/i, action: 'schema_change' },
  // Operational actions
  { pattern: /\bocr\b/i, action: 'ocr' },
  { pattern: /\bweb[_\s-]?search\b|\bsearch\b/i, action: 'web_search' },
  { pattern: /\bparse\b/i, action: 'parse' },
  { pattern: /\bdraft\b/i, action: 'draft' },
  { pattern: /\bbug[_\s-]?packet\b/i, action: 'bug_packet' },
  { pattern: /\banalyze\b|\banalyse\b/i, action: 'analyze' },
  { pattern: /\bsend\b|\bpost\s+to\b|\b發到\b|\b發\b/i, action: 'send' },
]

/**
 * Classify a command text using deterministic pattern matching.
 *
 * Returns null when no pattern matches (caller should fall back to LLM).
 */
export function classifyDeterministic(text: string): CommandIntent | null {
  for (const { pattern, action } of DETERMINISTIC_PATTERNS) {
    if (pattern.test(text)) {
      return { action, confidence: 'high', source: 'deterministic' }
    }
  }
  return null
}

/**
 * Classify a command text, falling back to the injected LLM classifier when
 * no deterministic pattern matches.
 *
 * Caller MUST still gate the result through permissions.ts.
 */
export async function classifyIntent(
  text: string,
  llmClassifier: LlmIntentClassifier
): Promise<CommandIntent> {
  const deterministic = classifyDeterministic(text)
  if (deterministic !== null) {
    return deterministic
  }
  // LLM fallback — result is advisory; permissions.ts gates the final action
  return llmClassifier.classify(text)
}
