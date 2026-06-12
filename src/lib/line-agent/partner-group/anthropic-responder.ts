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

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MAX_TOKENS = 1024

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
}

export class AnthropicPartnerGroupResponder implements PartnerGroupResponder {
  private readonly transport: typeof fetch
  private readonly apiKey: string
  private readonly defaultModel: string
  private readonly researchModel: string
  private readonly knowledgeSource?: QaKnowledgeSource
  private readonly costCap: DailyCostCap

  constructor(deps: AnthropicPartnerGroupResponderDeps) {
    this.transport = deps.transport
    this.apiKey = deps.apiKey
    this.defaultModel = deps.defaultModel
    this.researchModel = deps.researchModel
    this.knowledgeSource = deps.knowledgeSource
    this.costCap = deps.costCap
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

    const system = buildPartnerGroupSystemPrompt(input, knowledge)
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
    let usage: { input_tokens?: unknown; output_tokens?: unknown } | undefined
    try {
      const data = (await response.json()) as {
        content?: Array<{ text?: unknown }>
        usage?: { input_tokens?: unknown; output_tokens?: unknown }
      }
      text = data?.content?.[0]?.text
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
    const costUsd = estimateCostUsd(model, inputTokens, outputTokens)

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
      })
      return degraded(model, 'anthropic_parse_error')
    }

    log('llm_call', {
      model,
      latencyMs: Date.now() - startedAt,
      inputTokens,
      outputTokens,
      costUsd,
      outcome: 'ok',
      ...(usageMissing ? { usageMissing: true } : {}),
    })
    return { text, meta: { responder: 'llm', model } }
  }
}
