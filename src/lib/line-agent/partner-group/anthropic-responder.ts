/**
 * anthropic-responder.ts — real Anthropic Messages API adapter for the
 * partner-group responder (design 2026-06-03 §5; cost cap + structured log:
 * docs/plans/2026-06-10-p0a-cut2-minimal-observability-design.md).
 *
 * HARD BOUNDARIES (inherited from responder.ts, must never be violated):
 *  - Produces TEXT only. Never imports a LINE client, never sends, never writes
 *    a quote. Whether the text reaches the group is owned by router + permission.
 *  - Never reads env. The constructor receives primitives; the factory owns env.
 *
 * P0-A 刀 2 additions:
 *  - DAILY COST CAP（雙 fail-closed）：`costCap.checkBudget()` runs BEFORE the
 *    transport is touched. Anything but `ok`（over_cap / disabled /
 *    kv_unavailable）⇒ the LLM is NOT called and the safe stub is returned with
 *    a matching `cost_cap_*` error code. After a successful call the
 *    usage-estimated spend is recorded; a record failure NEVER drops the
 *    already-paid-for reply（log code only）.
 *  - STRUCTURED LOG：the per-request logger arrives via `input.log`（bound to
 *    the webhook requestId）; absent ⇒ a '-' requestId fallback. All previous
 *    ad-hoc console.* lines are folded into `llm_call` / `cost_cap` events —
 *    fixed codes and numbers only, never a key / prompt / message body.
 */

import {
  STUB_PARTNER_GROUP_REPLY,
  type PartnerGroupResponder,
  type PartnerGroupRespondInput,
  type PartnerGroupRespondResult,
} from './responder'
import { routePartnerModel } from './model-routing'
import { buildPartnerGroupSystemPrompt } from './system-prompt'
import type { QaKnowledgeSource } from './qa-knowledge-source'
import { createAgentLogger, type AgentLogger } from '../observability/structured-log'
import { estimateCostUsd, type DailyCostCap } from '../observability/daily-cost-cap'
import { gateCustomerItineraryDraft } from '../notion/customer-itinerary-gate'
import { partitionOutbound } from './outbound-segments'
import type {
  ItineraryReferenceResult,
  ItineraryReferenceSource,
} from '../notion/itinerary-reference-source'

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MAX_TOKENS = 4096

/** 外部佐證刀 — 每題搜尋次數上限（design §3 成本：3 × $0.01 ≈ $0.03/題）。 */
const WEB_SEARCH_MAX_USES = 3

/** Anthropic web_search 計費：$10 / 1000 次（design §0 vendor）。 */
const WEB_SEARCH_COST_PER_REQUEST_USD = 0.01

/** 文末來源連結上限（design §1：citations 抽 1–3 個）。 */
const MAX_SOURCE_URLS = 3

/** Q2 排行程降級註記（design 2026-06-13）：兩次都過不了 tripwire 時附在原文後。 */
const DEGRADE_NOTE =
  '\n\n⚠️ 此行程草稿格式未過自動檢查，報價器可能無法直接解析，請 Eric 確認。'

/**
 * 排行程二段流程 Pass 2 查核指示（design 2026-06-17）— web research 與「是不是
 * 排行程」解耦：Pass 1 先出乾淨草稿（關 web，保格式），Pass 2 才開 web 查核不確定
 * 的事實（開放時間、節慶/活動日期、景點/路線是否存在、季節性歇業），改錯後以
 * **完全相同**的 customer_itinerary_v1 格式重出整份行程（不得格式漂移）。附在
 * system 末段、Pass 1 草稿放在 user content。
 */
const ITINERARY_WEB_VERIFY_NOTE =
  '【行程查核要求｜web_search】上方使用者訊息內附的是一份已照 customer_itinerary_v1 格式排好的行程草稿。請用 web_search 查核草稿中不確定的事實性內容（景點開放時間、節慶/活動日期、某景點或路線是否存在、季節性歇業/關閉），修正任何錯誤；查核完成後，請以「完全相同」的 customer_itinerary_v1 格式（三行 header＋連續 Day N｜ 純文字結構）重新輸出整份行程，不得改變格式、不得只回修正摘要。確定無誤處原樣保留。'

/**
 * 排行程日期基準（design 2026-06-17）— 把 now 格式化成「2026年6月17日（週三）」，
 * 以 Asia/Taipei 為準（夥伴/Eric 在台灣；年份判斷不受伺服器 UTC 換日影響）。
 */
function formatTaipeiDateLabel(now: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  )
  return `${parts.year}年${parts.month}月${parts.day}日（${parts.weekday}）`
}

/** Safe-default fallback: stub text, observably tagged with the error code. */
function degraded(model: string, error: string): PartnerGroupRespondResult {
  return {
    text: STUB_PARTNER_GROUP_REPLY,
    meta: { responder: 'stub', model, degraded: true, error },
  }
}

/** Map a non-ok budget outcome to its fixed degraded error code. */
const COST_CAP_ERROR_CODE = {
  over_cap: 'cost_cap_exceeded',
  disabled: 'cost_cap_disabled',
  kv_unavailable: 'cost_cap_kv_unavailable',
} as const

export interface AnthropicPartnerGroupResponderDeps {
  /** Injected fetch-shaped transport — tests pass a fake; prod passes fetch. */
  transport: typeof fetch
  /** Anthropic API key (non-empty — the factory degrades to stub when empty). */
  apiKey: string
  /** Model for respond/analyze/unknown intents. */
  defaultModel: string
  /** Model for draft/parse intents. */
  researchModel: string
  /**
   * 沉澱 QA 知識源（檢索閉環刀）— OPTIONAL＋fail-open：未注入或失敗 ⇒
   * prompt 與現行 byte-identical。對照 costCap 的 REQUIRED fail-closed —
   * 知識是 enhancement，預算是 brake。
   */
  knowledgeSource?: QaKnowledgeSource
  /**
   * 排行程參考源（合併刀 M-2，取代 Task 4/5 的 itineraryReferenceSource ＋
   * caseProfileSource 兩條 source）— OPTIONAL＋draft-only＋fail-open，鏡像
   * knowledgeSource：未注入 / 失敗 / draft 以外的 intent ⇒ system 與現行
   * byte-identical、gate 走中性最小 constraints。一個 turn **只諮詢一次**，同時取
   * 骨架（注入 persona）＋來源訊號（M-1 入 log）＋本案 profile（餵 per-case lint）。
   * need 帶當則 draft 請求文字；responder 不讀 env、不 import Notion client（選取/
   * profile 推導/注入由 composition root 的 wiring 負責）。
   */
  itineraryReferenceSource?: ItineraryReferenceSource
  /**
   * Daily cost cap（P0-A 刀 2）— REQUIRED so a forgotten wiring can never mean
   * "unlimited spend". The factory builds the real KV-backed cap; tests inject
   * a fake.
   */
  costCap: DailyCostCap
  /**
   * 排行程日期基準時鐘（design 2026-06-17 年份 bug）— OPTIONAL，預設真時鐘
   * `() => new Date()`。draft intent 才取值注入 system「今天日期」；測試注入固定
   * 時鐘求決定性。讀時鐘不違反「不讀 env」鐵律（時鐘非 env）。
   */
  now?: () => Date
  /**
   * 外部佐證刀 — web_search server tool 開關。composition root（webhook /
   * CLI）用 canUseExternalTool 判定後注入；responder 不讀 env 鐵律不破。
   * 省略 / false ⇒ request body 與現行 byte-identical。
   */
  webSearchEnabled?: boolean
}

export class AnthropicPartnerGroupResponder implements PartnerGroupResponder {
  private readonly transport: typeof fetch
  private readonly apiKey: string
  private readonly defaultModel: string
  private readonly researchModel: string
  private readonly knowledgeSource?: QaKnowledgeSource
  private readonly itineraryReferenceSource?: ItineraryReferenceSource
  private readonly costCap: DailyCostCap
  private readonly now: () => Date
  private readonly webSearchEnabled: boolean

  constructor(deps: AnthropicPartnerGroupResponderDeps) {
    this.transport = deps.transport
    this.apiKey = deps.apiKey
    this.defaultModel = deps.defaultModel
    this.researchModel = deps.researchModel
    this.knowledgeSource = deps.knowledgeSource
    this.itineraryReferenceSource = deps.itineraryReferenceSource
    this.costCap = deps.costCap
    this.now = deps.now ?? (() => new Date())
    this.webSearchEnabled = deps.webSearchEnabled === true
  }

  async respond(input: PartnerGroupRespondInput): Promise<PartnerGroupRespondResult> {
    const log: AgentLogger = input.log ?? createAgentLogger({ requestId: '-' })

    // Model is chosen per-request from intent (design §4) — not bound in ctor.
    const model = routePartnerModel(input.intent, {
      defaultModel: this.defaultModel,
      researchModel: this.researchModel,
    })

    // BUDGET GATE — before any prompt is built or transport touched. Anything
    // but `ok` fails closed to the stub (the cap is a brake: no budget, no LLM).
    const budget = await this.costCap.checkBudget()
    log('cost_cap', {
      checkOutcome: budget.outcome,
      dailySpendMicroUsd: budget.dailySpendMicroUsd,
    })
    if (budget.outcome !== 'ok') {
      const error = COST_CAP_ERROR_CODE[budget.outcome]
      log('llm_call', { model, outcome: 'degraded', degradedReason: error })
      return degraded(model, error)
    }

    // 檢索閉環刀 — 沉澱知識（fail-open）：source 內部已收斂錯誤為 null，
    // 這層 try-catch 是 belt-and-braces — 任何 throw 都不得擋住回覆。
    let knowledge: string | null = null
    if (this.knowledgeSource) {
      try {
        knowledge = await this.knowledgeSource()
      } catch {
        log('qa_knowledge_unavailable', {})
      }
    }

    // 排行程參考（合併刀 M-2）— OPTIONAL＋draft-only＋fail-open，鏡像知識讀取：
    // 僅 draft intent 才諮詢 source；非 draft 一律不發、不付費。一個 turn **只打
    // 一次**，同時取骨架（注入 persona）＋來源訊號（M-1）＋本案 profile（餵 gate）。
    // 任何 throw ⇒ itinerary_reference_unavailable log，回覆照常（fail-open）；
    // reference 留 null ⇒ system byte-identical、gate 走中性最小 constraints。
    let reference: ItineraryReferenceResult | null = null
    if (this.itineraryReferenceSource && input.intent.action === 'draft') {
      try {
        reference = await this.itineraryReferenceSource(input.text)
      } catch {
        log('itinerary_reference_unavailable', {})
      }
    }
    // M-1：案例 vs 退範本來源訊號入 log（固定碼 case|template）— 調語料涵蓋率的
    // 關鍵：看得出某筆 draft 用真案例或退手工範本。null（未命中諮詢）不發此 log。
    if (reference) {
      log('itinerary_reference', { referenceSource: reference.source })
    }

    // 外部佐證刀 — per-request 防衛性收窄：deps 開閘之外，本則訊息還要確實
    // 是 bot-directed 且不在 OA 客人面（tool-gate 第 1/4 關在最後一哩重判，
    // 只會收窄、永不放寬）。design 2026-06-17：web research 與「是不是排行程」
    // 解耦 — toolGateOpen 是純工具閘信號（與非 draft 路徑同一組守衛，line_oa /
    // botDirected 不鬆）；draft 的 Pass 1 仍硬關 web（保格式），Pass 2 才吃
    // toolGateOpen。非 draft 路徑 allowWebSearch 與現行完全相同。
    const toolGateOpen =
      this.webSearchEnabled &&
      input.event.sourceChannel !== 'line_oa' &&
      (input.botDirected ?? input.event.mentionsBot) === true
    const allowWebSearch = toolGateOpen && input.intent.action !== 'draft'

    // 排行程日期基準（design 2026-06-17 年份 bug）— 只 draft intent 注入「今天日期」，
    // 非 draft 留 undefined ⇒ system byte-identical。文字路與截圖路都以 draft intent
    // 走此 responder，故一處修正同治兩路。
    const currentDate =
      input.intent.action === 'draft' ? formatTaipeiDateLabel(this.now()) : undefined

    // ── single LLM round, repeatable ────────────────────────────────────────
    // Q2 排行程 tripwire（design 2026-06-13）needs to re-issue the call with a
    // correction note when the draft fails the gate, so the whole transport →
    // parse → spend → finalText path lives in runOnce. correctionNote 非空時
    // 附加到 system 末段，要 LLM 依 problems 重出 v1（第一次呼叫 undefined ⇒
    // system 與現行 byte-identical）。
    // runOnce 走完整 transport → parse → spend → finalText 一輪，spend/log 一致。
    // opts（design 2026-06-17 二段流程）：
    //   webOverride —— 覆蓋本輪 tool 掛載與搜尋費記帳（Pass 2 需 web 開，但
    //                   allowWebSearch 對 draft 恆 false）；省略 ⇒ 用 allowWebSearch。
    //   systemSuffix —— 接在 system 末段的指示（Pass 2 的查核要求）。
    //   userContent —— 覆蓋 user message 內容（Pass 2 餵 Pass 1 草稿）；省略 ⇒ input.text。
    //   logPass —— llm_call log 加一個固定數字標籤區分 Pass（不記任何內容）。
    const runOnce = async (
      correctionNote?: string,
      opts?: { webOverride?: boolean; systemSuffix?: string; userContent?: string; logPass?: number }
    ): Promise<PartnerGroupRespondResult> => {
      const useWebSearch = opts?.webOverride ?? allowWebSearch
      const baseSystem = buildPartnerGroupSystemPrompt(input, knowledge, {
        webSearchEnabled: useWebSearch,
        itineraryReference: reference?.skeleton ?? undefined,
        // 第4刀：golden 命中時改用「強制照抄＋四防」段（system-prompt 內依此分流）。
        itineraryReferenceSource: reference?.source,
        currentDate,
      })
      let system = correctionNote
        ? `${baseSystem}\n\n【格式修正要求】上一版排行程草稿未通過自動檢查（customer_itinerary_v1），請依下列問題重新輸出，務必補齊每個 Day N｜ 標題與可解析的日期/人數 header：\n${correctionNote}`
        : baseSystem
      if (opts?.systemSuffix) system = `${system}\n\n${opts.systemSuffix}`
      const userContent = opts?.userContent ?? input.text
      const startedAt = Date.now()

      let response: Response
      try {
        response = await this.transport(ANTHROPIC_MESSAGES_URL, {
          method: 'POST',
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: MAX_TOKENS,
            system,
            messages: [{ role: 'user', content: userContent }],
            ...(useWebSearch
              ? {
                  tools: [
                    { type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES },
                  ],
                }
              : {}),
          }),
        })
      } catch {
        // Transport threw (network/DNS/abort). Safe-default — NEVER 500 the
        // webhook. Code-only log: the raw error could echo request details.
        log('llm_call', {
          model,
          latencyMs: Date.now() - startedAt,
          outcome: 'degraded',
          degradedReason: 'anthropic_api_error',
        })
        return degraded(model, 'anthropic_api_error')
      }

      if (!response.ok) {
        log('llm_call', {
          model,
          latencyMs: Date.now() - startedAt,
          outcome: 'degraded',
          degradedReason: 'anthropic_non_200',
          httpStatus: response.status,
        })
        return degraded(model, 'anthropic_non_200')
      }

      let text: unknown
      const sourceUrls: string[] = []
      let usage:
        | {
            input_tokens?: unknown
            output_tokens?: unknown
            server_tool_use?: { web_search_requests?: unknown }
          }
        | undefined
      try {
        const data = (await response.json()) as {
          content?: Array<{ text?: unknown; citations?: unknown }>
          usage?: typeof usage
        }
        // 多 block 串接：web search 回應是 text / server_tool_use /
        // web_search_tool_result 混排 — 只取帶 text 的 block。單 text block
        // 時與原 content[0].text 等價（閘關行為零變化）。
        const blocks = Array.isArray(data?.content) ? data.content : []
        const textBlocks = blocks.filter(
          (b): b is { text: string; citations?: unknown } => typeof b?.text === 'string'
        )
        text = textBlocks.length > 0 ? textBlocks.map((b) => b.text).join('') : undefined
        for (const block of textBlocks) {
          const citations = Array.isArray(block.citations) ? block.citations : []
          for (const c of citations as Array<{ url?: unknown }>) {
            if (typeof c?.url === 'string' && c.url !== '' && !sourceUrls.includes(c.url)) {
              sourceUrls.push(c.url)
            }
          }
        }
        usage = data?.usage
      } catch {
        log('llm_call', {
          model,
          latencyMs: Date.now() - startedAt,
          outcome: 'degraded',
          degradedReason: 'anthropic_parse_error',
        })
        return degraded(model, 'anthropic_parse_error')
      }

      // SPEND RECORDING — the call already happened, so this runs for parse
      // failures below too. usage missing ⇒ conservative estimate (never 0):
      // full MAX_TOKENS out + a chars/4 approximation of what we sent in.
      const inputTokensRaw = usage?.input_tokens
      const outputTokensRaw = usage?.output_tokens
      const usageMissing =
        typeof inputTokensRaw !== 'number' || typeof outputTokensRaw !== 'number'
      const inputTokens = usageMissing
        ? Math.ceil((system.length + userContent.length) / 4)
        : (inputTokensRaw as number)
      const outputTokens = usageMissing ? MAX_TOKENS : (outputTokensRaw as number)
      // 搜尋費補項（外部佐證刀）：usage.server_tool_use.web_search_requests ×
      // $0.01。usage 整包缺且本次有掛 tool ⇒ 按 max_uses 全用滿保守估 —
      // 寧高估觸發煞車，不低估燒錢（同 token 估計的紀律）。
      const searchRequestsRaw = usage?.server_tool_use?.web_search_requests
      const searchRequests =
        typeof searchRequestsRaw === 'number' && searchRequestsRaw > 0 ? searchRequestsRaw : 0
      const billedSearches =
        usageMissing && useWebSearch ? WEB_SEARCH_MAX_USES : searchRequests
      const costUsd =
        estimateCostUsd(model, inputTokens, outputTokens) +
        billedSearches * WEB_SEARCH_COST_PER_REQUEST_USD

      const { recorded } = await this.costCap.recordSpend(costUsd)
      if (!recorded) {
        // Never drop the already-paid-for reply over bookkeeping — code-only log.
        log('cost_cap', { reason: 'record_failed' })
      }

      if (typeof text !== 'string' || text.trim() === '') {
        log('llm_call', {
          model,
          latencyMs: Date.now() - startedAt,
          inputTokens,
          outputTokens,
          costUsd,
          outcome: 'degraded',
          degradedReason: 'anthropic_parse_error',
          ...(usageMissing ? { usageMissing: true } : {}),
          ...(billedSearches > 0 ? { webSearchRequests: billedSearches } : {}),
          ...(opts?.logPass ? { pass: opts.logPass } : {}),
        })
        return degraded(model, 'anthropic_parse_error')
      }

      // 外部佐證刀 — citations 來源附文末（去重後最多 MAX_SOURCE_URLS 個）。
      // 無 citations（含閘關）⇒ finalText === text，現行行為零變化。
      const finalText =
        sourceUrls.length > 0
          ? `${text}\n\n資料來源：\n${sourceUrls
              .slice(0, MAX_SOURCE_URLS)
              .map((u) => `- ${u}`)
              .join('\n')}`
          : text

      log('llm_call', {
        model,
        latencyMs: Date.now() - startedAt,
        inputTokens,
        outputTokens,
        costUsd,
        outcome: 'ok',
        ...(usageMissing ? { usageMissing: true } : {}),
        ...(billedSearches > 0 ? { webSearchRequests: billedSearches } : {}),
        ...(opts?.logPass ? { pass: opts.logPass } : {}),
      })
      return { text: finalText, meta: { responder: 'llm', model } }
    }

    // ── draft intent（排行程）→ 二段流程（design 2026-06-17）：
    //    Pass 1：tripwire 出乾淨草稿（關 web，保格式）— 過閘原樣回／失敗帶
    //            problems 重產 1 次／再失敗降級保留原文＋未過檢註記。
    //    Pass 2：toolGateOpen 時對 Pass 1 乾淨草稿做 web 佐證修正並 re-gate；過
    //            閘採 Pass 2（附來源），失敗/降級回退 Pass 1（永不比今日差）。
    //    web research 與「是不是排行程」解耦：Pass 1 恆關 web，Pass 2 才吃工具閘。
    //    非 draft 路徑完全不動。
    if (input.intent.action === 'draft') {
      let result = await runOnce()
      // degraded（budget/transport/parse 已先回 stub）不進閘，原樣透出。
      if (result.meta?.responder !== 'llm') return result

      // gate「只驗上半」（備注分離 2026-06-17）：模型把備注另起 INTERNAL_HEADER 段，
      // 只把 v1 行程上半餵 gate，避免「車型建議/待確認/問句」字樣污染 round-trip/lint。
      let gate = gateCustomerItineraryDraft(
        partitionOutbound(result.text).itinerary,
        reference?.profile ?? undefined
      )
      if (!gate.ok) {
        const retry = await runOnce(gate.problems.join('；'))
        if (retry.meta?.responder === 'llm') {
          result = retry
          gate = gateCustomerItineraryDraft(
            partitionOutbound(result.text).itinerary,
            reference?.profile ?? undefined
          )
        }
        if (!gate.ok) {
          log('llm_call', { model, outcome: 'degraded', degradedReason: 'itinerary_gate_failed' })
          return {
            text: result.text + DEGRADE_NOTE,
            meta: { responder: 'llm', model, degraded: true, error: 'itinerary_gate_failed' },
          }
        }
      }

      // Pass 2 — web 佐證修正。只在 toolGateOpen 且 Pass 1 已過閘可用時發；
      // 一次額外呼叫，spend/log 全走 runOnce。過閘 ⇒ 採 Pass 2（附來源連結）；
      // 失敗/降級/再過不了閘 ⇒ 回退 Pass 1（永不比今日差）。
      if (toolGateOpen) {
        const verified = await runOnce(undefined, {
          webOverride: true,
          systemSuffix: ITINERARY_WEB_VERIFY_NOTE,
          userContent: result.text,
          logPass: 2,
        })
        if (verified.meta?.responder === 'llm') {
          const verifiedGate = gateCustomerItineraryDraft(
            partitionOutbound(verified.text).itinerary,
            reference?.profile ?? undefined
          )
          if (verifiedGate.ok) return verified
        }
        // Pass 2 降級或未過閘 ⇒ 回退 Pass 1（result 已是過閘的乾淨草稿）。
      }
      return result
    }

    return runOnce()
  }
}
