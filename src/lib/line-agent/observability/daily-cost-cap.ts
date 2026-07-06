/**
 * daily-cost-cap.ts — P0-A 刀 2 Anthropic 每日成本上限（design
 * docs/plans/2026-06-10-p0a-cut2-minimal-observability-design.md）。
 *
 * The cap is a BRAKE, not an invoice：它的工作是「絕不無上限燒錢」，逐筆精確帳目
 * 由 structured-log 的 llm_call.costUsd 提供。
 *
 * 雙 fail-closed（Eric 定案）：
 *  - cap env `AI_AGENT_DAILY_COST_CAP_USD` 未設 / 非數字 / ≤0 → `disabled`。
 *    要開 LLM 必須明示預算 — 與本專案 gate 文化一致。
 *  - KV 未接（kv=null）或 read/incr THROW → `kv_unavailable`，且 raw error
 *    （可能含 token / url）絕不 rethrow、絕不進 log — 呼叫端只看 fixed code。
 *  - 兩者呼叫端都「不打 LLM」，退 deterministic / stub 路徑。
 *
 * 計量：
 *  - KV key `line-agent:llm-cost:YYYY-MM-DD`，日切採 **UTC+7（曼谷／清邁）**。
 *  - 以 micro-USD 整數 INCRBY 累計（避免浮點漂移）；TTL 48h（跨日殘留自清）。
 *  - check 與 record 非原子：v1 流量（個位數～數十則/日）下最壞超限一次
 *    Haiku 呼叫（≈$0.01 級），刻意接受。流量上升（OA 1:1 客服）時換原子實作
 *    只需替換本模組，呼叫點不動。
 *
 * recordSpend 永不 throw：LLM 已經打完、錢已花，記帳失敗不能丟掉回覆 —
 * 回 `{ recorded: false }` 讓呼叫端 log `cost_record_failed` 後照常送出。
 */

/** The narrow KV surface this module needs（KvClient 是其超集）。 */
export interface CostCapKv {
  /** GET — 回累計值（數字或可 parse 的字串），無 key 回 null。 */
  get<T = unknown>(key: string): Promise<T | null>
  /** INCRBY + 首次建 key 時掛 TTL；回累計後的值。 */
  incrByWithTtl(key: string, by: number, ttlSeconds: number): Promise<number>
}

export const DAILY_COST_KEY_PREFIX = 'line-agent:llm-cost:'
/** 48h：當日 key 跨完日後自動清掉，不用排程。 */
export const DAILY_COST_TTL_SECONDS = 48 * 60 * 60

/** UTC+7（曼谷）офset — 日切時區，Eric 的營運時區。 */
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

/**
 * 價目表（USD / MTok），key 是模型 FAMILY substring（model id 帶版本後綴也對得到）。
 * ⚠️ 換模型 / 官方調價時必須同步更新本表。
 * 未知模型一律用表中「最貴」費率估 — 寧高估觸發煞車，不低估燒錢。
 */
const MODEL_PRICING: Array<{ family: string; inputPerMTok: number; outputPerMTok: number }> = [
  { family: 'haiku', inputPerMTok: 1, outputPerMTok: 5 },
  { family: 'sonnet', inputPerMTok: 3, outputPerMTok: 15 },
]

const MOST_EXPENSIVE = MODEL_PRICING.reduce((a, b) =>
  a.inputPerMTok + a.outputPerMTok >= b.inputPerMTok + b.outputPerMTok ? a : b,
)

/** 純函式：以 family 價目表估算一次呼叫的 USD 成本。 */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing =
    MODEL_PRICING.find((p) => model.toLowerCase().includes(p.family)) ?? MOST_EXPENSIVE
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMTok +
    (outputTokens / 1_000_000) * pricing.outputPerMTok
  )
}

export type CostCapCheckOutcome = 'ok' | 'over_cap' | 'kv_unavailable' | 'disabled'

export interface CostCapCheck {
  outcome: CostCapCheckOutcome
  /** 當日已累計（micro-USD）。kv 不可用 / disabled 時省略。 */
  dailySpendMicroUsd?: number
}

export interface DailyCostCap {
  /** LLM 呼叫前查；只有 `ok` 才可以打。 */
  checkBudget(): Promise<CostCapCheck>
  /** LLM 呼叫後記帳。永不 throw；失敗回 { recorded: false }。 */
  recordSpend(usd: number): Promise<{ recorded: boolean }>
}

export interface CreateDailyCostCapDeps {
  /** Env 讀 `AI_AGENT_DAILY_COST_CAP_USD`。 */
  env: Record<string, string | undefined>
  /** KV port；null＝未接（fail-closed）。 */
  kv: CostCapKv | null
  /** 注入式時鐘（epoch ms），預設 Date.now。 */
  now?: () => number
}

/** 解析 cap（USD）。未設 / 非數字 / ≤0 → null（disabled）。 */
function parseCapUsd(env: Record<string, string | undefined>): number | null {
  const raw = (env.AI_AGENT_DAILY_COST_CAP_USD ?? '').trim()
  if (raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

/** 以 UTC+7（曼谷）取日字串 YYYY-MM-DD。日 cap 與廣告刀8 每日表共用同一時區換算，絕不自寫第二份。 */
export function bangkokDay(epochMs: number): string {
  return new Date(epochMs + BANGKOK_OFFSET_MS).toISOString().slice(0, 10)
}

export function createDailyCostCap(deps: CreateDailyCostCapDeps): DailyCostCap {
  const now = deps.now ?? Date.now
  const capUsd = parseCapUsd(deps.env)
  const kv = deps.kv

  const dayKey = () => `${DAILY_COST_KEY_PREFIX}${bangkokDay(now())}`

  return {
    async checkBudget(): Promise<CostCapCheck> {
      if (capUsd === null) return { outcome: 'disabled' }
      if (kv === null) return { outcome: 'kv_unavailable' }

      let spent: number
      try {
        const raw = await kv.get(dayKey())
        spent = raw == null ? 0 : Number(raw)
        if (!Number.isFinite(spent)) spent = 0
      } catch {
        // raw error 可能含 token / url — 吞掉，呼叫端只看 fixed code。
        return { outcome: 'kv_unavailable' }
      }

      const capMicroUsd = Math.round(capUsd * 1_000_000)
      return {
        outcome: spent >= capMicroUsd ? 'over_cap' : 'ok',
        dailySpendMicroUsd: spent,
      }
    },

    async recordSpend(usd: number): Promise<{ recorded: boolean }> {
      if (capUsd === null || kv === null) return { recorded: false }
      const microUsd = Math.round(usd * 1_000_000)
      if (microUsd <= 0) return { recorded: false }
      try {
        await kv.incrByWithTtl(dayKey(), microUsd, DAILY_COST_TTL_SECONDS)
        return { recorded: true }
      } catch {
        // 已付費的回覆不能因記帳失敗被丟掉 — 吞錯，讓呼叫端 log code。
        return { recorded: false }
      }
    },
  }
}
