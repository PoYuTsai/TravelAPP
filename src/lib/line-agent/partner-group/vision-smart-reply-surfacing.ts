/**
 * vision-smart-reply-surfacing.ts — 圖片智慧回覆 responder（Task 4.1）.
 *
 * 取代舊「圖→純轉錄→triageCaseIntake 死路」path（vision-intake-surfacing）。
 * 新流程：夥伴引用客人截圖＋tag bot →
 *   1. 抓圖（LINE content API）
 *   2. need 語義抽取（VisionNeedSource）讀成結構化 VisionNeedBrief
 *   3. 是真客人對話 ⇒ 跑 agentic smart-reply 迴圈（Task 3.2）⇒ 兩段回覆
 *
 * Fail-closed 紀律（鏡像 vision-intake-surfacing）：
 *   - 無 quotedMessageId / content 404 ⇒ NO_IMAGE 固定誠實句
 *   - 其他抓圖失敗 / vision 抽取失敗 ⇒ UNAVAILABLE 固定誠實句
 *   - 非對話截圖（風景/地圖）⇒ not_a_conversation 固定句，**不**呼叫 agent（不燒 RAG/web）
 *   - 任何意外錯誤 ⇒ UNAVAILABLE 固定句
 *   永不 throw、永不腦補；fail-closed 分支一律不呼叫 agent。
 *
 * 錯誤碼複用 vision-intake 的固定句常數與 fixed-code meta 形狀，只在「非對話」
 * 多一個本模組專屬常數＋degraded code。
 */

import type {
  PartnerGroupResponder,
  PartnerGroupRespondInput,
  PartnerGroupRespondResult,
} from './responder'
import { LineContentError, type LineImageContent } from '../line/content-client'
import { VisionIntakeError } from './vision-intake-adapter'
import type { VisionNeedBrief, VisionNeedSource } from './vision-need-extraction'
import {
  VISION_INTAKE_NO_IMAGE_REPLY,
  VISION_INTAKE_UNAVAILABLE_REPLY,
} from './vision-intake-surfacing'

// ---------------------------------------------------------------------------
// Fixed phrasing（誠實回覆）
// ---------------------------------------------------------------------------

/**
 * 非對話截圖（風景/地圖/menu…）的固定誠實句。need.isConversation=false ⇒
 * 直接回這句、**絕不**進 agentic 迴圈（不燒 RAG/web）。
 */
export const VISION_SMART_REPLY_NOT_A_CONVERSATION_REPLY =
  '這張圖看起來不是客人對話截圖，請確認後再 tag 我。'

// ---------------------------------------------------------------------------
// Responder factory
// ---------------------------------------------------------------------------

type SmartReplyAgent = (
  brief: VisionNeedBrief,
  input: PartnerGroupRespondInput
) => Promise<PartnerGroupRespondResult>

export interface CreateVisionSmartReplyResponderDeps {
  /** LINE content fetcher（webhook 端 close over token＋fetch；tests 注入 fake）。 */
  fetchImage: (messageId: string) => Promise<LineImageContent>
  /** Claude vision 語義抽 need（adapter 蓋 transport + daily cost cap）。 */
  need: VisionNeedSource
  /** 截圖智慧回覆 agentic 迴圈（Task 3.2）— 已產兩段輸出。 */
  agent: SmartReplyAgent
  /**
   * 真客人對話的意圖分叉（design 決策 #2）：'draft' ＝ 行程類截圖走 golden 範本
   * 草稿路；'respond' ＝ 開放題走現行 agentic 路。
   *
   * 可選：未注入 ⇒ 視為 'respond'，行為與現行 byte-identical（接線在 Task 7，
   * fail-open try-catch 由 composition root wrapper 保證，不在本檔）。
   */
  classify?: (summary: string) => Promise<'draft' | 'respond'>
  /**
   * 行程類草稿 responder（Task 6 造本體）。簽名同 `agent`。
   *
   * 可選：未注入但 classify 回 'draft' ⇒ 安全退回 `agent`（永不無回覆）。
   */
  draftAgent?: SmartReplyAgent
}

/** fail-closed degraded result（固定句＋fixed-code meta，永不 throw）。 */
function degraded(text: string, error: string): PartnerGroupRespondResult {
  return {
    text,
    meta: { responder: 'vision_intake', degraded: true, error },
  }
}

/**
 * 圖→need→agentic 兩段回覆 responder factory。只產文字；是否真送由
 * router / webhook send gate 擁有。每一步失敗都收斂成固定誠實回覆＋
 * fixed-code meta，且 fail-closed 分支一律不呼叫 agent（不燒 RAG/web）。
 */
export function createVisionSmartReplyResponder(
  deps: CreateVisionSmartReplyResponderDeps
): PartnerGroupResponder {
  return {
    async respond(
      input: PartnerGroupRespondInput
    ): Promise<PartnerGroupRespondResult> {
      try {
        // 1. 解析「這張圖」＝引用的那一則（fail-closed，鏡像 vision-intake-surfacing）。
        const quotedId = input.event.quotedRef?.quotedMessageId
        const messageId =
          typeof quotedId === 'string' && quotedId !== '' ? quotedId : null
        if (messageId === null) {
          input.log?.('route_decision', {
            path: 'vision_intake',
            degradedReason: 'no_image_found',
          })
          return degraded(VISION_INTAKE_NO_IMAGE_REPLY, 'no_image_found')
        }

        // 2. 抓圖（LINE content API）。404 ＝ 引用過期/非圖 → 與「找不到圖」同句。
        let image: LineImageContent
        try {
          image = await deps.fetchImage(messageId)
        } catch (err) {
          const code =
            err instanceof LineContentError ? err.code : 'content_fetch_failed'
          input.log?.('route_decision', {
            path: 'vision_intake',
            degradedReason: code,
          })
          return code === 'content_not_found'
            ? degraded(VISION_INTAKE_NO_IMAGE_REPLY, code)
            : degraded(VISION_INTAKE_UNAVAILABLE_REPLY, code)
        }

        // 3. need 語義抽取。VisionIntakeError ＝ vision 呼叫失敗 → UNAVAILABLE，
        //    且 agent **絕不**被呼叫。
        let brief: VisionNeedBrief
        try {
          brief = await deps.need(image)
        } catch (err) {
          const code =
            err instanceof VisionIntakeError
              ? err.message.replace('vision intake call failed: ', '')
              : 'vision_failed'
          input.log?.('route_decision', {
            path: 'vision_intake',
            degradedReason: code,
          })
          return degraded(VISION_INTAKE_UNAVAILABLE_REPLY, code)
        }

        // 4. 非對話截圖 ⇒ 固定誠實句，**不**進 agentic 迴圈（不燒 RAG/web）。
        if (brief.isConversation === false) {
          input.log?.('route_decision', {
            path: 'vision_intake',
            degradedReason: 'not_a_conversation',
          })
          return degraded(
            VISION_SMART_REPLY_NOT_A_CONVERSATION_REPLY,
            'not_a_conversation'
          )
        }

        // 5. 真客人對話 ⇒ 先判行程類 vs 開放題（design 決策 #2）。
        //    classify 未注入 ⇒ 視為 'respond'，與現行行為 byte-identical。
        const kind = deps.classify ? await deps.classify(brief.summary) : 'respond'
        if (kind === 'draft' && deps.draftAgent) {
          input.log?.('route_decision', {
            path: 'vision_intake',
            visionIntent: 'draft',
          })
          return await deps.draftAgent(brief, input)
        }
        input.log?.('route_decision', {
          path: 'vision_intake',
          visionIntent: 'respond',
        })
        return await deps.agent(brief, input)
      } catch {
        // 任何意外錯誤一律收斂 UNAVAILABLE，絕不 throw、絕不 500 webhook。
        input.log?.('route_decision', {
          path: 'vision_intake',
          degradedReason: 'unexpected_error',
        })
        return degraded(VISION_INTAKE_UNAVAILABLE_REPLY, 'unexpected_error')
      }
    },
  }
}
