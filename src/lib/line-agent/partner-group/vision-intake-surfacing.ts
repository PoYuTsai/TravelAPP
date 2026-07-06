/**
 * vision-intake-surfacing.ts — 圖片刀B 的 surfacing decision + 共用固定回覆。
 *
 * 「引用一張圖＋tag bot」→ surfacing 放行讀圖路徑。本模組是 M3-0 tool-gate
 * （'ocr'）的第一個真消費者：surfacing 走 `canUseExternalTool`，所以 OA 永不、
 * 未 tag 永不、`AI_AGENT_OCR_ENABLED` default off、`AI_AGENT_TOOL_COST_CAP_USD`
 * 未設也擋（雙閘）。daily cost cap 則由 vision adapter 內的
 * checkBudget/recordSpend 把守 — 兩層預算互不取代。
 *
 * 「這張圖」解析（Eric 2026-06-11 真機煙測後拍板：引用即觸發、去關鍵詞）：
 *   引用圖片＋tag → 即觸發，無需任何觸發詞 — 夥伴零學習成本。
 *   「引用的是圖片」由 webhook 以 store 的 image-marker 判定（quotedImage），
 *   本模組不讀 store；無引用圖 ⇒ surfacing 不放行。
 *
 * Task 7.1（2026-06-16）：舊「圖→純轉錄→triageCaseIntake 死路」responder
 * （createVisionIntakeResponder）已被 vision-smart-reply-surfacing.ts 取代並
 * 自此移除。本模組現只留：(1) surfacing 判斷 shouldUseVisionIntake（仍由
 * responder-factory dispatcher 使用）、(2) 共用固定誠實回覆常數（smart-reply
 * 沿用）。
 */

import type { AgentSourceChannel } from '../types'
import { canUseExternalTool } from '../tools/tool-gate'
import { loadToolConfig } from '../tools/tool-config'

// ---------------------------------------------------------------------------
// Fixed phrasing（誠實回覆 — 與刀A system prompt 條款同調；smart-reply 沿用）
// ---------------------------------------------------------------------------

export const VISION_INTAKE_NO_IMAGE_REPLY =
  '找不到要讀的圖片：請對那張圖長按選「回覆」再 tag 我一次，或重新傳一張後再叫我。'

export const VISION_INTAKE_UNAVAILABLE_REPLY =
  '這張圖暫時讀取失敗，請把客人的文字訊息直接貼上來，或稍後再試一次。'

// ---------------------------------------------------------------------------
// Surfacing decision — M3-0 tool-gate 'ocr' 真消費者
// ---------------------------------------------------------------------------

export interface ShouldUseVisionIntakeInput {
  sourceChannel: AgentSourceChannel
  /** mentionsBot OR quote-to-bot, resolved by the caller（router botDirected）. */
  botDirected: boolean
  /**
   * True iff this event quotes a recorded partner-group IMAGE message —
   * resolved by the webhook against the store（fail-safe ⇒ false）。引用文字
   * 訊息、引用過期、store 壞掉都是 false ⇒ 不觸發。
   */
  quotedImage: boolean
  env?: Record<string, string | undefined>
}

/**
 * The surfacing decision. True ONLY when partner group + tagged + quoted an
 * image + the M3-0 ocr gate allows（enabled AND a positive cost cap）.
 * Any missing precondition ⇒ the existing responder runs；gate off 時 base
 * responder 的刀A 誠實條款負責回「目前讀不到圖片」。
 */
export function shouldUseVisionIntake(input: ShouldUseVisionIntakeInput): boolean {
  if (!input.quotedImage) return false
  const gate = canUseExternalTool(
    {
      tool: 'ocr',
      sourceChannel: input.sourceChannel,
      botDirected: input.botDirected,
      // 對著一張圖 tag bot 本身就是「明確要求讀外部資料」的手勢。
      userRequestedExternalData: true,
      // Per-turn spend：vision 每訊息至多一次呼叫，turn 起點恆為 0；每日
      // 累計預算由 adapter 的 DailyCostCap 把守。
      costSpentUsd: 0,
    },
    loadToolConfig(input.env)
  )
  return gate.allowed
}
