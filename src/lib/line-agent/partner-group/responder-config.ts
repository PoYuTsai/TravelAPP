/**
 * responder-config.ts — narrow env selector for the partner-group responder
 * (design 2026-06-03 §3.2 解 B).
 *
 * WHY a separate selector instead of loadAgentConfig:
 *  - loadAgentConfig is all-or-nothing: any missing required env throws
 *    AgentConfigError.  The partner-group reply is an ENHANCEMENT, not case
 *    persistence — a missing unrelated env (Notion/KV) must not 500 the webhook.
 *  - On THIS path ANTHROPIC_API_KEY is OPTIONAL: a missing key produces an empty
 *    string and the factory degrades to a safe stub, rather than throwing.
 *
 * This selector therefore NEVER throws.  It owns the authoritative source of
 * `partnerResponderMode`; loadAgentConfig's ModelsConfig is deliberately left
 * untouched (no dual source — see design §3.2 / §9).
 */

/** The subset of model config the partner-group responder factory consumes. */
export interface PartnerResponderConfig {
  /** stub | anthropic — optional env, defaults to 'stub'. */
  partnerResponderMode: 'stub' | 'anthropic'
  /** Empty string when absent (no throw); factory degrades on empty. */
  anthropicApiKey: string
  /** Empty string when absent (no throw). */
  defaultModel: string
  /** Empty string when absent (no throw). */
  researchModel: string
}

function read(env: Record<string, string | undefined>, key: string): string {
  const value = env[key]
  return value && value.trim() !== '' ? value.trim() : ''
}

/**
 * Parse the partner-responder model config from an env record (defaults to
 * process.env).  NEVER throws — missing values become empty strings and the
 * factory decides whether to degrade.
 */
export function getPartnerResponderConfig(
  env: Record<string, string | undefined> = process.env
): PartnerResponderConfig {
  const rawMode = read(env, 'AI_AGENT_PARTNER_RESPONDER_MODE')
  const partnerResponderMode: 'stub' | 'anthropic' =
    rawMode === 'anthropic' ? 'anthropic' : 'stub'

  return {
    partnerResponderMode,
    anthropicApiKey: read(env, 'ANTHROPIC_API_KEY'),
    defaultModel: read(env, 'AI_AGENT_DEFAULT_MODEL'),
    researchModel: read(env, 'AI_AGENT_RESEARCH_MODEL'),
  }
}
