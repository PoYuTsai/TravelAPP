/**
 * anthropic-call.ts — 共用的 Anthropic Messages API transport（抽自 distill /
 * approval / case-intake / vision 四個 throw-based adapter 逐字重複的核心）。
 *
 * 抽出來的不變式（四個 adapter 一字不差共用，差異點全留給 caller）：
 *   - COST CAP 紀律：呼叫前 checkBudget，非 `ok` 一律不打、makeError 丟 fixed-code；
 *     呼叫後 recordSpend，記帳失敗永不丟掉已付費的回覆（log code only）。
 *   - transport 注入（fetch-shaped）— 不 import SDK；測試注入 fake、prod 注入 fetch。
 *   - usage 缺漏時保守估帳（input = fallbackInputTokens、output = maxTokens，絕不記 0）。
 *   - 錯誤一律經 `makeError`：raw error / upstream body / key / prompt 永不外洩，
 *     caller 把 fixed code 映射成自己的 Error 子類（保留既有錯誤型別 / 測試斷言）。
 *
 * 差異點（由 caller 決定，不入本層）：
 *   - model / system / messages（純字串 or image block）/ maxTokens / fallbackInputTokens
 *   - 截斷政策 `truncation`：
 *       'throw'  — stop_reason==='max_tokens' 即不可信，先記帳再 makeError 丟錯（distill / approval）
 *       'mark'   — 截斷只標記不致命，terminal log 標 degradedReason 仍回 text（vision）
 *       'ignore' — 不檢查截斷（case-intake）
 *
 * ⚠️ 刻意不涵蓋 anthropic-responder（return-degraded-stub 而非 throw、multi-block
 * citations、web_search 計費、draft retry tripwire）與 llm-refine-adapter
 * （這層無 fetch，callModel 已注入）。
 */

import { estimateCostUsd, type DailyCostCap } from './daily-cost-cap'
import type { AgentLogger } from './structured-log'

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/** stop_reason==='max_tokens' 的處置（各 adapter 的既有行為）。 */
export type TruncationPolicy = 'throw' | 'mark' | 'ignore'

export interface CallAnthropicMessagesParams {
  model: string
  system: string
  /** 純字串 content（一般 adapter）或 image+text block 陣列（vision）。 */
  messages: Array<{ role: 'user'; content: unknown }>
  maxTokens: number
  /** usage 缺漏時的保守 input token 估計（絕不記 0）。 */
  fallbackInputTokens: number
  truncation: TruncationPolicy
}

export interface CallAnthropicMessagesDeps {
  /** fetch-shaped transport（tests 注入 fake；prod 注入 fetch）。 */
  transport: typeof fetch
  apiKey: string
  /** REQUIRED — 忘了接 cap 永遠不能等於無上限燒錢。 */
  costCap: DailyCostCap
  /** 已綁 requestId 的 logger（caller 負責給；本層不建 default）。 */
  log: AgentLogger
  /** fixed code → caller 自己的 Error 子類（保留各 adapter 既有錯誤型別）。 */
  makeError: (code: string) => Error
}

export interface CallAnthropicMessagesResult {
  /** 已驗非空的 raw model text（caller 可自行 trim）。 */
  text: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  usageMissing: boolean
  /** stop_reason === 'max_tokens'（'throw' 政策時根本不會回到這裡）。 */
  truncated: boolean
}

export async function callAnthropicMessages(
  params: CallAnthropicMessagesParams,
  deps: CallAnthropicMessagesDeps,
): Promise<CallAnthropicMessagesResult> {
  const { model, system, messages, maxTokens, fallbackInputTokens, truncation } = params
  const { transport, apiKey, costCap, log, makeError } = deps

  // BUDGET GATE — 非 ok 一律不打 transport。
  const budget = await costCap.checkBudget()
  log('cost_cap', {
    checkOutcome: budget.outcome,
    dailySpendMicroUsd: budget.dailySpendMicroUsd,
  })
  if (budget.outcome !== 'ok') {
    log('llm_call', { model, outcome: 'degraded', degradedReason: `cost_cap_${budget.outcome}` })
    throw makeError(`cost_cap_${budget.outcome}`)
  }

  const startedAt = Date.now()
  let response: Response
  try {
    response = await transport(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    })
  } catch {
    // Raw error 可能帶 request 細節（url / key）— 吞掉，只留 fixed code。
    log('llm_call', {
      model,
      latencyMs: Date.now() - startedAt,
      outcome: 'degraded',
      degradedReason: 'anthropic_api_error',
    })
    throw makeError('anthropic_api_error')
  }

  if (!response.ok) {
    log('llm_call', {
      model,
      latencyMs: Date.now() - startedAt,
      outcome: 'degraded',
      degradedReason: 'anthropic_non_200',
      httpStatus: response.status,
    })
    throw makeError('anthropic_non_200')
  }

  let text: unknown
  let usage: { input_tokens?: unknown; output_tokens?: unknown } | undefined
  let stopReason: unknown
  try {
    const data = (await response.json()) as {
      content?: Array<{ text?: unknown }>
      usage?: { input_tokens?: unknown; output_tokens?: unknown }
      stop_reason?: unknown
    }
    text = data?.content?.[0]?.text
    usage = data?.usage
    stopReason = data?.stop_reason
  } catch {
    log('llm_call', {
      model,
      latencyMs: Date.now() - startedAt,
      outcome: 'degraded',
      degradedReason: 'anthropic_parse_error',
    })
    throw makeError('anthropic_parse_error')
  }

  // SPEND RECORDING — 已經打了就要記；usage 缺時保守估（絕不記 0）。
  const inputTokensRaw = usage?.input_tokens
  const outputTokensRaw = usage?.output_tokens
  const usageMissing =
    typeof inputTokensRaw !== 'number' || typeof outputTokensRaw !== 'number'
  const inputTokens = usageMissing ? fallbackInputTokens : (inputTokensRaw as number)
  const outputTokens = usageMissing ? maxTokens : (outputTokensRaw as number)
  const costUsd = estimateCostUsd(model, inputTokens, outputTokens)

  const { recorded } = await costCap.recordSpend(costUsd)
  if (!recorded) log('cost_cap', { reason: 'record_failed' })

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
    throw makeError('anthropic_parse_error')
  }

  const truncated = stopReason === 'max_tokens'

  // 截斷政策 'throw'：輸出不可信，先記帳（上面已記）再 throw。
  if (truncation === 'throw' && truncated) {
    log('llm_call', {
      model,
      latencyMs: Date.now() - startedAt,
      inputTokens,
      outputTokens,
      costUsd,
      outcome: 'degraded',
      degradedReason: 'max_tokens_truncated',
      ...(usageMissing ? { usageMissing: true } : {}),
    })
    throw makeError('max_tokens_truncated')
  }

  // terminal ok log（'mark' 時標 degradedReason，但 outcome 仍 ok）。
  const markTruncated = truncation === 'mark' && truncated
  log('llm_call', {
    model,
    latencyMs: Date.now() - startedAt,
    inputTokens,
    outputTokens,
    costUsd,
    outcome: 'ok',
    ...(markTruncated ? { degradedReason: 'max_tokens_truncated' } : {}),
    ...(usageMissing ? { usageMissing: true } : {}),
  })

  return { text, inputTokens, outputTokens, costUsd, usageMissing, truncated }
}
