/**
 * vision-intake-surfacing.ts — 圖片刀B 的 surfacing decision + responder.
 *
 * 「引用一張圖＋tag bot」→ LINE content API 抓圖 → Claude vision 抽客人對話
 * 文字 → triageCaseIntake 三分流（與客需刀直接接軌）。
 *
 * 本模組是 M3-0 tool-gate（'ocr'）的第一個真消費者：surfacing 走
 * `canUseExternalTool`，所以 OA 永不、未 tag 永不、`AI_AGENT_OCR_ENABLED`
 * default off、`AI_AGENT_TOOL_COST_CAP_USD` 未設也擋（雙閘）。daily cost cap
 * 則由 vision adapter 內的 checkBudget/recordSpend 把守 — 兩層預算互不取代。
 *
 * 「這張圖」解析（Eric 2026-06-11 真機煙測後拍板：引用即觸發、去關鍵詞）：
 *   引用圖片＋tag → 即觸發，無需任何觸發詞 — 夥伴零學習成本。
 *   「引用的是圖片」由 webhook 以 store 的 image-marker 判定（quotedImage），
 *   本模組不讀 store；無引用圖 ⇒ surfacing 不放行，base responder 的刀A
 *   誠實條款負責回覆。舊版關鍵詞 lexicon＋「群內最近一張圖」fallback 已除役。
 *
 * Fail-closed 紀律：找不到圖／content 404／vision 失敗 → 固定誠實回覆
 * （永不 throw、永不腦補）。錯誤碼 fixed-code only。
 */

import type {
  PartnerGroupResponder,
  PartnerGroupRespondInput,
  PartnerGroupRespondResult,
} from './responder'
import type { AgentSourceChannel } from '../types'
import { LineContentError, type LineImageContent } from '../line/content-client'
import { VisionIntakeError, type VisionIntakeSource } from './vision-intake-adapter'
import { canUseExternalTool } from '../tools/tool-gate'
import { loadToolConfig } from '../tools/tool-config'
import { triageCaseIntake } from './case-intake-triage'

// ---------------------------------------------------------------------------
// Fixed phrasing（誠實回覆 — 與刀A system prompt 條款同調）
// ---------------------------------------------------------------------------

export const VISION_INTAKE_NO_IMAGE_REPLY =
  '找不到要讀的圖片：請對那張圖長按選「回覆」再 tag 我一次，或重新傳一張後再叫我。'

export const VISION_INTAKE_UNAVAILABLE_REPLY =
  '這張圖暫時讀取失敗，請把客人的文字訊息直接貼上來，或稍後再試一次。'

/** 回覆中轉述抽取文字的長度上限 — 截圖轉錄不該洗版。 */
const EXTRACTION_ECHO_MAX_CHARS = 1000

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

// ---------------------------------------------------------------------------
// Vision intake responder
// ---------------------------------------------------------------------------

export interface CreateVisionIntakeResponderDeps {
  /** LINE content fetcher（webhook 端 close over token＋fetch）。 */
  fetchImage: (messageId: string) => Promise<LineImageContent>
  /** Claude vision 抽取（adapter 蓋 transport + daily cost cap）。 */
  vision: VisionIntakeSource
}

/**
 * 讀圖 responder factory. Only produces text; whether it is sent stays owned
 * by the router / webhook send gate. 每一步失敗都收斂成固定誠實回覆＋
 * fixed-code meta（loud + observable, never a throw, never fabrication）。
 */
export function createVisionIntakeResponder(
  deps: CreateVisionIntakeResponderDeps
): PartnerGroupResponder {
  return {
    async respond(
      input: PartnerGroupRespondInput
    ): Promise<PartnerGroupRespondResult> {
      // 1. 解析「這張圖」＝引用的那一則。Surfacing 已要求 quotedImage，這裡
      //    是防衛性檢查（dispatcher 之外的直接呼叫也 fail-closed）。
      const quotedId = input.event.quotedRef?.quotedMessageId
      const messageId =
        typeof quotedId === 'string' && quotedId !== '' ? quotedId : null
      if (messageId === null) {
        input.log?.('route_decision', {
          path: 'vision_intake',
          degradedReason: 'no_image_found',
        })
        return {
          text: VISION_INTAKE_NO_IMAGE_REPLY,
          meta: { responder: 'vision_intake', degraded: true, error: 'no_image_found' },
        }
      }

      // 2. 抓圖（LINE content API）
      let image: LineImageContent
      try {
        image = await deps.fetchImage(messageId)
      } catch (err) {
        const code = err instanceof LineContentError ? err.code : 'content_fetch_failed'
        input.log?.('route_decision', { path: 'vision_intake', degradedReason: code })
        // 404 ＝ 引用的內容已過期或實際上不是圖片 → 與「找不到圖」同一句誠實回覆。
        return {
          text:
            code === 'content_not_found'
              ? VISION_INTAKE_NO_IMAGE_REPLY
              : VISION_INTAKE_UNAVAILABLE_REPLY,
          meta: { responder: 'vision_intake', degraded: true, error: code },
        }
      }

      // 3. vision 抽取（daily cost cap 在 adapter 內把守）
      let extracted: string
      try {
        extracted = await deps.vision(image)
      } catch (err) {
        const code =
          err instanceof VisionIntakeError
            ? err.message.replace('vision intake call failed: ', '')
            : 'vision_failed'
        input.log?.('route_decision', { path: 'vision_intake', degradedReason: code })
        return {
          text: VISION_INTAKE_UNAVAILABLE_REPLY,
          meta: { responder: 'vision_intake', degraded: true, error: code },
        }
      }

      // 4. 抽取文字 → 三分流（與客需刀同一個 deterministic core）
      const triage = triageCaseIntake(extracted)
      input.log?.('route_decision', { path: 'vision_intake', flow: triage.flow })

      const echo =
        extracted.length > EXTRACTION_ECHO_MAX_CHARS
          ? `${extracted.slice(0, EXTRACTION_ECHO_MAX_CHARS)}…（截斷）`
          : extracted
      return {
        text: ['【截圖內容整理】', echo, '', triage.replyText].join('\n'),
        meta: { responder: 'vision_intake', confidence: triage.flow },
      }
    },
  }
}
