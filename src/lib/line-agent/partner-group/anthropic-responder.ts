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

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MAX_TOKENS = 1024

/** 外部佐證刀 — 每題搜尋次數上限（design §3 成本：3 × $0.01 ≈ $0.03/題）。 */
const WEB_SEARCH_MAX_USES = 3

/** Anthropic web_search 計費：$10 / 1000 次（design §0 vendor）。 */
const WEB_SEARCH_COST_PER_REQUEST_USD = 0.01

/** 文末來源連結上限（design §1：citations 抽 1–3 個）。 */
const MAX_SOURCE_URLS = 3

/** Q2 排行程降級註記（design 2026-06-13）：兩次都過不了 tripwire 時附在原文後。 */
const DEGRADE_NOTE =
  '\n\n⚠️ 此行程草稿格式未過自動檢查，報價器可能無法直接解析，請 Eric 確認。'

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
   * Daily cost cap（P0-A 刀 2）— REQUIRED so a forgotten wiring can never mean
   * "unlimited spend". The factory builds the real KV-backed cap; tests inject
   * a fake.
   */
  costCap: DailyCostCap
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
  private readonly costCap: DailyCostCap
  private readonly webSearchEnabled: boolean

  constructor(deps: AnthropicPartnerGroupResponderDeps) {
    this.transport = deps.transport
    this.apiKey = deps.apiKey
    this.defaultModel = deps.defaultModel
    this.researchModel = deps.researchModel
    this.knowledgeSource = deps.knowledgeSource
    this.costCap = deps.costCap
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

    // 外部佐證刀 — per-request 防衛性收窄：deps 開閘之外，本則訊息還要確實
    // 是 bot-directed 且不在 OA 客人面（tool-gate 第 1/4 關在最後一哩重判，
    // 只會收窄、永不放寬）。
    const allowWebSearch =
      this.webSearchEnabled &&
      input.event.sourceChannel !== 'line_oa' &&
      (input.botDirected ?? input.event.mentionsBot) === true

    // ── single LLM round, repeatable ────────────────────────────────────────
    // Q2 排行程 tripwire（design 2026-06-13）needs to re-issue the call with a
    // correction note when the draft fails the gate, so the whole transport →
    // parse → spend → finalText path lives in runOnce. correctionNote 非空時
    // 附加到 system 末段，要 LLM 依 problems 重出 v1（第一次呼叫 undefined ⇒
    // system 與現行 byte-identical）。
    const runOnce = async (correctionNote?: string): Promise<PartnerGroupRespondResult> => {
      const baseSystem = buildPartnerGroupSystemPrompt(input, knowledge, {
        webSearchEnabled: allowWebSearch,
      })
      const system = correctionNote
        ? `${baseSystem}\n\n【格式修正要求】上一版排行程草稿未通過自動檢查（customer_itinerary_v1），請依下列問題重新輸出，務必補齊每個 Day N｜ 標題與可解析的日期/人數 header：\n${correctionNote}`
        : baseSystem
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
            messages: [{ role: 'user', content: input.text }],
            ...(allowWebSearch
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
        ? Math.ceil((system.length + input.text.length) / 4)
        : (inputTokensRaw as number)
      const outputTokens = usageMissing ? MAX_TOKENS : (outputTokensRaw as number)
      // 搜尋費補項（外部佐證刀）：usage.server_tool_use.web_search_requests ×
      // $0.01。usage 整包缺且本次有掛 tool ⇒ 按 max_uses 全用滿保守估 —
      // 寧高估觸發煞車，不低估燒錢（同 token 估計的紀律）。
      const searchRequestsRaw = usage?.server_tool_use?.web_search_requests
      const searchRequests =
        typeof searchRequestsRaw === 'number' && searchRequestsRaw > 0 ? searchRequestsRaw : 0
      const billedSearches =
        usageMissing && allowWebSearch ? WEB_SEARCH_MAX_USES : searchRequests
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
      })
      return { text: finalText, meta: { responder: 'llm', model } }
    }

    // ── draft intent（排行程）→ tripwire：過閘原樣回／失敗帶 problems 重產 1 次／
    //    再失敗降級保留原文＋未過檢註記（真群永遠有回覆）。非 draft 路徑完全不動。
    if (input.intent.action === 'draft') {
      let result = await runOnce()
      // degraded（budget/transport/parse 已先回 stub）不進閘，原樣透出。
      if (result.meta?.responder !== 'llm') return result

      let gate = gateCustomerItineraryDraft(result.text)
      if (!gate.ok) {
        const retry = await runOnce(gate.problems.join('；'))
        if (retry.meta?.responder === 'llm') {
          result = retry
          gate = gateCustomerItineraryDraft(result.text)
        }
        if (!gate.ok) {
          log('llm_call', { model, outcome: 'degraded', degradedReason: 'itinerary_gate_failed' })
          return {
            text: result.text + DEGRADE_NOTE,
            meta: { responder: 'llm', model, degraded: true, error: 'itinerary_gate_failed' },
          }
        }
      }
      return result
    }

    return runOnce()
  }
}
