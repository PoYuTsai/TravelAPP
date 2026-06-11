/**
 * distill-llm-adapter.ts — 知識沉澱刀2 的真 Anthropic adapter
 * （design 2026-06-11 §2 LLM 刀）。
 *
 * 角色分工（mirror case-intake-llm-adapter）：
 *   - 本模組只負責「把織好的 promptText 變成 raw model text」；
 *     JSON 解析與所有 guards 都在 candidates.ts（純函式、零信任）。
 *   - transport 注入（fetch-shaped，同 anthropic-responder）— 不 import SDK，
 *     測試注入 fake，CLI/cron 注入真 fetch。
 *   - COST CAP（P0-A 刀 2 紀律）：每次呼叫前 checkBudget，非 `ok` 一律不打、
 *     throw fixed-code error；呼叫後 recordSpend，記帳失敗永不丟掉已付費的回覆。
 *   - 截斷偵測（刀1 vision adapter 同紀律）：stop_reason === 'max_tokens' 即
 *     截斷 — 截斷的 JSON 不可信，「先記帳再 throw」（已經打了就要記）。
 *
 * Prompt 安全邊界：進 prompt 的只有 thread-weaver 織出的匿名化 transcript
 * （夥伴A/B 化名、含截圖轉錄）— 不含真名、key、內部 operator notes。
 * 錯誤一律 fixed code，永不帶 key / prompt / 回應內文。
 */

import { estimateCostUsd, type DailyCostCap } from '../observability/daily-cost-cap'
import { createAgentLogger, type AgentLogger } from '../observability/structured-log'

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/** 最多 5 條候選 JSON，2048 綽綽有餘；再大就是模型失控，截斷偵測會擋。 */
export const DISTILL_MAX_TOKENS = 2048

// ---------------------------------------------------------------------------
// Model resolution（mirror resolveCaseIntakeLlmModel：explicit > env > default）
// ---------------------------------------------------------------------------

/** 設計指定 Sonnet — 30 天 transcript 的歸納比 enrichment 重，Haiku 不夠。 */
export const DISTILL_LLM_MODEL_DEFAULT = 'claude-sonnet-4-6'

export function resolveDistillModel(opts?: {
  model?: string
  env?: Record<string, string | undefined>
}): string {
  const explicit = opts?.model?.trim()
  if (explicit) return explicit
  const fromEnv = opts?.env?.AI_AGENT_DISTILL_LLM_MODEL?.trim()
  if (fromEnv) return fromEnv
  return DISTILL_LLM_MODEL_DEFAULT
}

// ---------------------------------------------------------------------------
// System prompt（exported for tests）
// ---------------------------------------------------------------------------

export const DISTILL_SYSTEM_INSTRUCTION = [
  '你是清邁包車旅行社的知識整理助手。輸入是夥伴群最近 30 天的對話紀錄（已匿名化、含截圖轉錄）。',
  '紀錄格式：每則訊息以「#行號 [發話者]」開頭，內文可跨行；「（截圖）」表示該則是截圖的文字轉錄；',
  '「（回覆 #n）」表示回覆第 n 則；「（已標記）」表示老闆標過「記一下」，可單獨入選不受重複次數限制。',
  '任務：找出「重複出現的常規問答」（價格範圍、景點、路線可行性等），整理成知識庫候選。',
  '硬規則：',
  '- 只收「同類問題出現 ≥2 次」或「（已標記）」的常規問答；一次性的個案談判（特殊喬價、特例安排）一律排除',
  '- 答案只能來自對話中夥伴實際說過的內容；不得腦補、不得加入你自己的旅遊知識',
  '- 最多 5 條；不足 5 條就回實際數量；完全沒有 → 回 []',
  '- question / answer 用繁體中文、各 500 字以內；answer 保留價格數字、時間等原始寫法',
  '只回 JSON 陣列，格式：',
  '[{"question":"…","answer":"…","sourceLines":[行號數字],"occurrences":N}]',
  'sourceLines 是該問答出處的 # 行號。不要任何前綴、後綴、說明或 code fence。',
].join('\n')

// ---------------------------------------------------------------------------
// Source factory — transport + cost cap；錯誤一律 fixed code
// ---------------------------------------------------------------------------

/** 把織好的 promptText 變成 raw model text（candidates.ts 零信任解析）。 */
export type DistillSource = (promptText: string) => Promise<string>

export interface AnthropicDistillSourceDeps {
  /** fetch-shaped transport（tests 注入 fake；prod 注入 fetch）。 */
  transport: typeof fetch
  apiKey: string
  /** REQUIRED — 忘了接 cap 永遠不能等於無上限燒錢。 */
  costCap: DailyCostCap
  model?: string
  env?: Record<string, string | undefined>
  log?: AgentLogger
}

/** Fixed-code、secret-free 的 adapter 錯誤（caller 收斂成降級/重試）。 */
export class DistillLlmError extends Error {
  constructor(code: string) {
    super(`distill llm call failed: ${code}`)
    this.name = 'DistillLlmError'
  }
}

export function createAnthropicDistillSource(deps: AnthropicDistillSourceDeps): DistillSource {
  const model = resolveDistillModel({ model: deps.model, env: deps.env })
  const log = deps.log ?? createAgentLogger({ requestId: '-' })

  return async function distillSource(promptText: string): Promise<string> {
    // BUDGET GATE — 同 anthropic-responder：非 ok 一律不打。
    const budget = await deps.costCap.checkBudget()
    log('cost_cap', {
      checkOutcome: budget.outcome,
      dailySpendMicroUsd: budget.dailySpendMicroUsd,
    })
    if (budget.outcome !== 'ok') {
      log('llm_call', { model, outcome: 'degraded', degradedReason: `cost_cap_${budget.outcome}` })
      throw new DistillLlmError(`cost_cap_${budget.outcome}`)
    }

    const startedAt = Date.now()
    let response: Response
    try {
      response = await deps.transport(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'x-api-key': deps.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: DISTILL_MAX_TOKENS,
          system: DISTILL_SYSTEM_INSTRUCTION,
          messages: [{ role: 'user', content: promptText }],
        }),
      })
    } catch {
      // Raw error 可能帶 request 細節 — 吞掉，只留 fixed code。
      log('llm_call', {
        model,
        latencyMs: Date.now() - startedAt,
        outcome: 'degraded',
        degradedReason: 'anthropic_api_error',
      })
      throw new DistillLlmError('anthropic_api_error')
    }

    if (!response.ok) {
      log('llm_call', {
        model,
        latencyMs: Date.now() - startedAt,
        outcome: 'degraded',
        degradedReason: 'anthropic_non_200',
        httpStatus: response.status,
      })
      throw new DistillLlmError('anthropic_non_200')
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
      throw new DistillLlmError('anthropic_parse_error')
    }

    // SPEND RECORDING — 已經打了就要記；usage 缺時保守估（絕不記 0）。
    const inputTokensRaw = usage?.input_tokens
    const outputTokensRaw = usage?.output_tokens
    const usageMissing =
      typeof inputTokensRaw !== 'number' || typeof outputTokensRaw !== 'number'
    const inputTokens = usageMissing
      ? Math.ceil((DISTILL_SYSTEM_INSTRUCTION.length + promptText.length) / 4)
      : (inputTokensRaw as number)
    const outputTokens = usageMissing ? DISTILL_MAX_TOKENS : (outputTokensRaw as number)
    const costUsd = estimateCostUsd(model, inputTokens, outputTokens)

    const { recorded } = await deps.costCap.recordSpend(costUsd)
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
      throw new DistillLlmError('anthropic_parse_error')
    }

    // 截斷偵測 — 與 vision adapter 不同：這裡輸出是 JSON，截斷即不可信，
    // 一律 throw（spend 已在上面入帳，不會漏記）。
    if (stopReason === 'max_tokens') {
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
      throw new DistillLlmError('max_tokens_truncated')
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
    return text
  }
}
