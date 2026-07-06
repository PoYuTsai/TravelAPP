/**
 * tool-config.ts
 *
 * Pure env parser for the M3-0 external-tool / billing gate.
 *
 * High-cost external tools (web search, OCR, Notion RAG) default to OFF. The
 * operator must explicitly opt in per tool via env; a billing budget caps spend
 * even once a tool is enabled. Like config.ts this is injectable — pass a plain
 * Record so unit tests never mutate process.env.
 *
 * This module does NOT call any provider. It only turns env strings into a
 * typed policy object that tool-gate.ts consumes.
 */

export interface ToolConfig {
  /** web_search may run only when this is true (env explicitly "true"). */
  webSearchEnabled: boolean
  /** OCR may run only when this is true. */
  ocrEnabled: boolean
  /** Notion RAG deep-read may run only when this is true. */
  notionRagEnabled: boolean
  /**
   * Hard spend ceiling (USD) for external tool calls in a turn/session. A tool
   * is denied once accumulated spend reaches this cap. Defaults to 0 — i.e. no
   * budget until the operator sets one, so an enabled tool still cannot spend.
   */
  costCapUsd: number
}

/**
 * A flag is ON only when the env value is exactly "true" (case-insensitive,
 * trimmed). Anything else — "1", "yes", "on", empty, absent — is OFF. The
 * billing-safe default is "do not run".
 */
function flag(env: Record<string, string | undefined>, key: string): boolean {
  return (env[key] ?? '').trim().toLowerCase() === 'true'
}

/**
 * Parse the external-tool policy from an env record.
 *
 * @param env - env record to parse. Defaults to process.env.
 */
export function loadToolConfig(
  env: Record<string, string | undefined> = process.env
): ToolConfig {
  const rawCap = parseFloat((env.AI_AGENT_TOOL_COST_CAP_USD ?? '').trim())
  const costCapUsd = Number.isFinite(rawCap) && rawCap > 0 ? rawCap : 0

  return {
    webSearchEnabled: flag(env, 'AI_AGENT_WEB_SEARCH_ENABLED'),
    ocrEnabled: flag(env, 'AI_AGENT_OCR_ENABLED'),
    notionRagEnabled: flag(env, 'AI_AGENT_NOTION_RAG_ENABLED'),
    costCapUsd,
  }
}
