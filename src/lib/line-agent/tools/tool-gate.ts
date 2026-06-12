/**
 * tool-gate.ts
 *
 * M3-0 — the LAST WORD on whether a high-cost external tool (web search, OCR,
 * Notion RAG) may run. Pure and synchronous: no provider call, no I/O, no LLM.
 * An LLM proposing "search the web" passes a ToolGateRequest here; this gate can
 * only ever NARROW that proposal, never widen it.
 *
 * Decision order (first failing check wins, so the reason is the most specific
 * applicable defense):
 *  1. line_oa  → ALWAYS denied. Customer plane never spends + never auto-replies.
 *  2. non-partner-group source → denied. Only the partner group has the
 *     human-in-the-loop context to authorize spend.
 *  3. tool disabled in config → denied (billing / tool gate disabled).
 *  4. bot not directly addressed → denied.
 *  5. user did not explicitly request external/realtime data → denied
 *     （web_search 豁免：tag 即授權，見外部佐證刀 design 2026-06-13 §0）.
 *  6. cost cap reached → denied (budget exhausted).
 *  7. otherwise → allowed.
 */

import type { PermissionResult } from '../permissions'
import type { ToolConfig } from './tool-config'

/** The high-cost external tools gated by this contract. */
export type ExternalTool = 'web_search' | 'ocr' | 'notion_rag'

export interface ToolGateRequest {
  /** Which external tool the caller (or LLM) wants to invoke. */
  tool: ExternalTool
  /** Originating channel, e.g. 'line_partner_group' | 'line_oa'. */
  sourceChannel: string
  /** Runtime-derived "bot is addressed" signal (tag OR quote-to-bot). */
  botDirected: boolean
  /** True only when the user explicitly asked to look up web / realtime data. */
  userRequestedExternalData: boolean
  /** Accumulated external-tool spend (USD) so far this turn/session. */
  costSpentUsd: number
}

/** Map a tool to its per-tool enable flag in the parsed config. */
function isToolEnabled(tool: ExternalTool, config: ToolConfig): boolean {
  switch (tool) {
    case 'web_search':
      return config.webSearchEnabled
    case 'ocr':
      return config.ocrEnabled
    case 'notion_rag':
      return config.notionRagEnabled
  }
}

/**
 * Decide whether an external tool call is authorized. See module header for the
 * full decision order.
 */
export function canUseExternalTool(
  request: ToolGateRequest,
  config: ToolConfig
): PermissionResult {
  // 1. OA customer plane — independent of any env/billing flag.
  if (request.sourceChannel === 'line_oa') {
    return {
      allowed: false,
      reason:
        'canUseExternalTool: line_oa (customer plane) may NEVER invoke external tools. ' +
        'This is the billing + customer-no-auto-reply double insurance.',
    }
  }

  // 2. Only the partner group can ever authorize external-tool spend.
  if (request.sourceChannel !== 'line_partner_group') {
    return {
      allowed: false,
      reason: `canUseExternalTool: source "${request.sourceChannel}" cannot authorize external tools; only line_partner_group can.`,
    }
  }

  // 3. Billing / tool gate — default OFF until the operator opts in.
  if (!isToolEnabled(request.tool, config)) {
    return {
      allowed: false,
      reason: `canUseExternalTool: tool "${request.tool}" is disabled (billing/tool gate disabled). Set the matching AI_AGENT_*_ENABLED env to enable it.`,
    }
  }

  // 4. Bot must be directly addressed.
  if (!request.botDirected) {
    return {
      allowed: false,
      reason: 'canUseExternalTool: bot is not addressed (botDirected is false).',
    }
  }

  // 5. User must explicitly ask for external/realtime data.
  //    外部佐證刀（design 2026-06-13 §0）：web_search 豁免本關 — 在夥伴群
  //    tag bot 本身就是 explicit intent（tag 即授權）。OCR / notion_rag 不動。
  if (request.tool !== 'web_search' && !request.userRequestedExternalData) {
    return {
      allowed: false,
      reason:
        'canUseExternalTool: user did not explicitly request external/realtime data; ' +
        'external lookups are never auto-triggered.',
    }
  }

  // 6. Cost cap — deny once spend reaches the budget.
  if (request.costSpentUsd >= config.costCapUsd) {
    return {
      allowed: false,
      reason: `canUseExternalTool: cost cap reached (spent ${request.costSpentUsd} >= cap ${config.costCapUsd} USD); budget exhausted.`,
    }
  }

  return { allowed: true }
}
