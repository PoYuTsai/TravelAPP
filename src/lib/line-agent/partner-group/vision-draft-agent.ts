/**
 * vision-draft-agent.ts — Task 6：行程類截圖走 golden 範本草稿（兩段輸出）。
 *
 * Task 5 在 vision 流程開好 `draftAgent` 注入孔（classify='draft' 時呼叫）。
 * 本檔造 `draftAgent` 本體：與 SmartReplyAgent 同型 `(brief, input) => Promise<result>`。
 *
 * AD-1（複用 draft responder）：把 brief 組成 need 文字，以 intent.action='draft'
 * 呼叫注入的 `responder`（＝ AnthropicPartnerGroupResponder，已內建 golden 注入 →
 * gate → 重產 → 降級）。本檔**不**重造 LLM 迴圈 / golden 注入 / gate / 降級。
 *
 * AD-3（兩段對映）：responder 正文當對外段（用 ensureTwoSegments 收尾，保證有
 * OUTBOUND_HEADER），brief.gaps 當內部待確認段（補 INTERNAL_HEADER）。
 *
 * 護欄（不可破）：
 *  - 不讀 env、不 import LINE / Notion client（responder 由注入提供）。
 *  - 降級不 throw：responder 回 degraded result 時，本檔仍正常包兩段、透傳 meta。
 *  - 本檔只組 need 文字 + 包兩段，無 I/O。
 */

import type {
  PartnerGroupResponder,
  PartnerGroupRespondInput,
  PartnerGroupRespondResult,
} from './responder'
import type { VisionNeedBrief } from './vision-need-extraction'
import { INTERNAL_HEADER, ensureTwoSegments } from './smart-reply-agent'

export interface CreateVisionDraftAgentDeps {
  /** 行程類 draft responder（＝AnthropicPartnerGroupResponder，已內建 golden 注入＋gate）。 */
  responder: PartnerGroupResponder
}

/** brief → 行程類草稿（兩段）。複用 draft responder 的 golden/gate 機制（AD-1）。 */
export function createVisionDraftAgent(
  deps: CreateVisionDraftAgentDeps,
): (brief: VisionNeedBrief, input: PartnerGroupRespondInput) => Promise<PartnerGroupRespondResult> {
  return async (brief, input) => {
    // 1. brief（summary + knownFacts）→ need 文字。
    const need = [brief.summary, ...brief.knownFacts].filter(Boolean).join('\n')

    // 2. 以 draft intent 呼叫注入的 draft responder（golden 注入＋gate＋降級在其內）。
    const draftInput: PartnerGroupRespondInput = {
      ...input,
      text: need,
      intent: { action: 'draft', confidence: 'high', source: 'deterministic' },
    }
    const result = await deps.responder.respond(draftInput)

    // 3. 對外段（ensureTwoSegments 保證 OUTBOUND_HEADER）＋ 內部待確認段（補 INTERNAL_HEADER）。
    //    ensureTwoSegments 只處理 OUTBOUND_HEADER、不產 INTERNAL_HEADER（見 smart-reply-agent.ts），
    //    故此處一律補一個內部段，列 brief.gaps。
    const gapsLine =
      brief.gaps.length > 0 ? brief.gaps.map((g) => `・${g}`).join('\n') : '無'
    const twoSegment =
      `${ensureTwoSegments(result.text)}\n\n` +
      `${INTERNAL_HEADER}\n待確認（截圖未提及、報價/排程需要）：\n${gapsLine}`

    // meta 透傳（含 responder 的 degraded/error），只覆寫 text。
    return { ...result, text: twoSegment }
  }
}
