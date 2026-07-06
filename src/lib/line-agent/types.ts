/**
 * Shared domain types for the LINE OA agent layer.
 *
 * Keep this file to pure type / union definitions only.
 * Business logic and validation live in config.ts / config modules.
 */

// ---------------------------------------------------------------------------
// Route modes — controls where new OA customer case cards are delivered
// ---------------------------------------------------------------------------

/**
 * "discord_smoke"   → case cards go only to Discord private channel (smoke-test mode).
 * "partner_group"   → case cards are posted to the LINE partner group (normal MVP mode).
 */
export type AgentRouteMode = 'discord_smoke' | 'partner_group'

// ---------------------------------------------------------------------------
// Source / channel types — where a command or event originated
// ---------------------------------------------------------------------------

/**
 * The surface that produced an incoming event or command.
 *
 * - "line_oa"            Official LINE OA customer message (webhook event source).
 * - "line_partner_group" Message from the partner LINE group.
 * - "discord_private"    Eric's private Discord command plane.
 * - "internal_worker"    Backend worker / scheduled job / programmatic call.
 */
export type AgentSourceChannel =
  | 'line_oa'
  | 'line_partner_group'
  | 'discord_private'
  | 'internal_worker'

// ---------------------------------------------------------------------------
// Execution path types — how the agent processed a command
// ---------------------------------------------------------------------------

/**
 * The processing path taken for a given command or event.
 *
 * - "discord_cc"           Invoked through the existing Discord / cc / tmux path.
 * - "backend_worker_llm"   Processed by a shared backend worker with LLM calls.
 * - "line_api_llm"         The LINE bot made direct LLM API calls.
 * - "deterministic"        Handled without any LLM — pure rule-based / parser logic.
 */
export type AgentExecutionPath =
  | 'discord_cc'
  | 'backend_worker_llm'
  | 'line_api_llm'
  | 'deterministic'
