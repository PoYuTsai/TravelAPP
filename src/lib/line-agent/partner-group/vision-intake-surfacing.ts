/**
 * vision-intake-surfacing.ts — 圖片刀B 的 surfacing decision + responder.
 *
 * 「@bot 讀取這張圖」→ LINE content API 抓圖 → Claude vision 抽客人對話文字
 * → triageCaseIntake 三分流（與客需刀直接接軌）。
 *
 * 本模組是 M3-0 tool-gate（'ocr'）的第一個真消費者：surfacing 走
 * `canUseExternalTool`，所以 OA 永不、未 tag 永不、`AI_AGENT_OCR_ENABLED`
 * default off、`AI_AGENT_TOOL_COST_CAP_USD` 未設也擋（雙閘）。daily cost cap
 * 則由 vision adapter 內的 checkBudget/recordSpend 把守 — 兩層預算互不取代。
 *
 * 「這張圖」解析（Eric 拍板：夥伴體驗優先，零學習成本）：
 *   1. 引用圖片＋tag（精準）→ quotedMessageId 直接餵 content API
 *   2. 沒引用 → 該群最近一張圖（webhook 記錄；30 分鐘 freshness 窗，
 *      由本模組用 event.timestamp 判斷 — KV TTL 只是垃圾回收）
 *
 * Fail-closed 紀律：找不到圖／content 404／vision 失敗 → 固定誠實回覆；
 * store 讀取失敗視同沒圖（永不 throw、永不腦補）。錯誤碼 fixed-code only。
 */

import type {
  PartnerGroupResponder,
  PartnerGroupRespondInput,
  PartnerGroupRespondResult,
} from './responder'
import type { AgentSourceChannel } from '../types'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { PartnerGroupImageMsg } from '../storage/store'
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

/**
 * 「最近一張圖」的新鮮度窗（ms）。超窗的圖不讀 — 寧可請夥伴引用，也不要
 * 讀到三天前不相干的圖。與 KV 的 30 分鐘 TTL 對齊（policy 在這裡，TTL 是 GC）。
 */
export const VISION_IMAGE_FRESHNESS_MS = 30 * 60 * 1000

// ---------------------------------------------------------------------------
// Intent lexicon
// ---------------------------------------------------------------------------

/**
 * 自然語觸發詞（Eric 2026-06-11 拍板：「@bot 讀取這張圖」就要動）。
 * 刻意不與 客需（客需／整理需求…）、RAG（查內部案例…）詞彙重疊，
 * 三條路徑可獨立觸發。
 */
const VISION_INTAKE_INTENT_TOKENS = [
  '讀取這張圖',
  '讀取圖片',
  '讀取截圖',
  '讀這張圖',
  '讀一下圖',
  '讀一下截圖',
  '讀圖',
  '看一下這張圖',
  '看這張圖',
  '看一下圖',
  '看一下截圖',
  '看圖',
  '看截圖',
  '這張圖',
  '這張截圖',
  '圖片內容',
  '圖裡',
  '圖中',
] as const

/** True iff `text` 明確要求讀圖（夥伴的 explicit external-data request）。 */
export function detectVisionIntakeIntent(text: string): boolean {
  if (!text) return false
  return VISION_INTAKE_INTENT_TOKENS.some((token) => text.includes(token))
}

// ---------------------------------------------------------------------------
// Surfacing decision — M3-0 tool-gate 'ocr' 真消費者
// ---------------------------------------------------------------------------

export interface ShouldUseVisionIntakeInput {
  sourceChannel: AgentSourceChannel
  /** mentionsBot OR quote-to-bot, resolved by the caller（router botDirected）. */
  botDirected: boolean
  text: string
  env?: Record<string, string | undefined>
}

/**
 * The surfacing decision. True ONLY when partner group + tagged + explicit
 * 讀圖 intent + the M3-0 ocr gate allows（enabled AND a positive cost cap）.
 * Any missing precondition ⇒ the existing responder runs；gate off 時 base
 * responder 的刀A 誠實條款負責回「目前讀不到圖片」。
 */
export function shouldUseVisionIntake(input: ShouldUseVisionIntakeInput): boolean {
  if (!detectVisionIntakeIntent(input.text)) return false
  const gate = canUseExternalTool(
    {
      tool: 'ocr',
      sourceChannel: input.sourceChannel,
      botDirected: input.botDirected,
      // 觸發詞本身就是「明確要求讀外部資料」— intent 已在上面確認。
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
// Target image resolution（引用優先 → 群內最近一張）
// ---------------------------------------------------------------------------

async function resolveTargetImageMessageId(
  event: NormalizedLineEvent,
  getLatestImage: (groupId: string) => Promise<PartnerGroupImageMsg | null>
): Promise<string | null> {
  // 1. 引用優先：夥伴明確指了某則訊息。若引用的是文字訊息，content API 會
  //    404 → 誠實回「找不到圖」，絕不悄悄改讀別張。
  const quotedId = event.quotedRef?.quotedMessageId
  if (typeof quotedId === 'string' && quotedId !== '') return quotedId

  // 2. 群內最近一張圖（fail-safe：store 壞掉視同沒圖）。
  const groupId = event.groupId
  if (typeof groupId !== 'string' || groupId === '') return null
  let latest: PartnerGroupImageMsg | null
  try {
    latest = await getLatestImage(groupId)
  } catch {
    return null
  }
  if (!latest) return null

  // Freshness 窗：超窗的「最近」其實是陳年舊圖 — 不讀。
  if (event.timestamp - latest.timestamp > VISION_IMAGE_FRESHNESS_MS) return null
  return latest.messageId
}

// ---------------------------------------------------------------------------
// Vision intake responder
// ---------------------------------------------------------------------------

export interface CreateVisionIntakeResponderDeps {
  /** LINE content fetcher（webhook 端 close over token＋fetch）。 */
  fetchImage: (messageId: string) => Promise<LineImageContent>
  /** Claude vision 抽取（adapter 蓋 transport + daily cost cap）。 */
  vision: VisionIntakeSource
  /** 群內最近一張圖（webhook 端 close over store）。 */
  getLatestImage: (groupId: string) => Promise<PartnerGroupImageMsg | null>
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
      // 1. 解析「這張圖」
      const messageId = await resolveTargetImageMessageId(
        input.event,
        deps.getLatestImage
      )
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
        // 404 ＝ 引用的不是圖片或內容已過期 → 與「找不到圖」同一句誠實回覆。
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
