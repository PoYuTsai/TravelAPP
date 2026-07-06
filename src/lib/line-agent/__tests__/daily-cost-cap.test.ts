/**
 * P0-A 刀 2 — daily-cost-cap.ts（design
 * docs/plans/2026-06-10-p0a-cut2-minimal-observability-design.md）。
 *
 * 契約：
 *  - createDailyCostCap({ env, kv, now? }) → { checkBudget(), recordSpend(usd) }
 *  - checkBudget → 'ok' | 'over_cap' | 'kv_unavailable' | 'disabled'
 *  - 雙 fail-closed：cap env 未設/非法 → disabled；kv 缺/壞 → kv_unavailable
 *    （兩者呼叫端都不打 LLM）
 *  - KV key：line-agent:llm-cost:YYYY-MM-DD，**UTC+7 日切**，micro-USD 整數累計
 *  - estimateCostUsd：family 價目表（haiku/sonnet），未知模型用最貴費率
 */
import { describe, expect, it } from 'vitest'
import {
  createDailyCostCap,
  estimateCostUsd,
  DAILY_COST_KEY_PREFIX,
  DAILY_COST_TTL_SECONDS,
  type CostCapKv,
} from '../observability/daily-cost-cap'

/** In-memory CostCapKv fake mimicking Redis GET/INCRBY+TTL semantics. */
function makeFakeKv() {
  const counters = new Map<string, number>()
  const ttls = new Map<string, number>()
  const kv: CostCapKv = {
    async get<T = unknown>(key: string): Promise<T | null> {
      return (counters.has(key) ? counters.get(key)! : null) as T | null
    },
    async incrByWithTtl(key, by, ttlSeconds) {
      const next = (counters.get(key) ?? 0) + by
      counters.set(key, next)
      if (!ttls.has(key)) ttls.set(key, ttlSeconds)
      return next
    },
  }
  return { kv, counters, ttls }
}

// 2026-06-10T16:30:00Z → UTC+7 是 2026-06-10 23:30（同日）
const NOW_SAME_DAY = Date.parse('2026-06-10T16:30:00Z')
// 2026-06-10T17:30:00Z → UTC+7 是 2026-06-11 00:30（已跨日）
const NOW_NEXT_DAY = Date.parse('2026-06-10T17:30:00Z')

const ENV_CAP_5USD = { AI_AGENT_DAILY_COST_CAP_USD: '5' }

describe('estimateCostUsd', () => {
  it('prices a haiku-family call at $1/MTok in + $5/MTok out', () => {
    // 1M input + 1M output = 1 + 5 = 6 USD
    expect(estimateCostUsd('claude-haiku-4-5', 1_000_000, 1_000_000)).toBeCloseTo(6, 9)
  })

  it('prices a sonnet-family call at $3/MTok in + $15/MTok out', () => {
    expect(estimateCostUsd('claude-sonnet-4-6', 1_000_000, 1_000_000)).toBeCloseTo(18, 9)
  })

  it('prices an unknown model at the most expensive table rate (never underestimates)', () => {
    expect(estimateCostUsd('mystery-model', 1_000_000, 1_000_000)).toBeCloseTo(18, 9)
  })
})

describe('createDailyCostCap', () => {
  it('returns ok under the cap and accumulates micro-USD on record', async () => {
    const { kv, counters, ttls } = makeFakeKv()
    const cap = createDailyCostCap({ env: ENV_CAP_5USD, kv, now: () => NOW_SAME_DAY })

    expect(await cap.checkBudget()).toEqual({ outcome: 'ok', dailySpendMicroUsd: 0 })
    await cap.recordSpend(0.012345)

    const key = `${DAILY_COST_KEY_PREFIX}2026-06-10`
    expect(counters.get(key)).toBe(12_345) // micro-USD 整數
    expect(ttls.get(key)).toBe(DAILY_COST_TTL_SECONDS)
  })

  it('keys the counter by the UTC+7 (Bangkok) day, not UTC', async () => {
    const { kv, counters } = makeFakeKv()
    const cap = createDailyCostCap({ env: ENV_CAP_5USD, kv, now: () => NOW_NEXT_DAY })

    await cap.recordSpend(1)

    expect(Array.from(counters.keys())).toEqual([`${DAILY_COST_KEY_PREFIX}2026-06-11`])
  })

  it('returns over_cap once the accumulated spend reaches the cap', async () => {
    const { kv } = makeFakeKv()
    const cap = createDailyCostCap({ env: ENV_CAP_5USD, kv, now: () => NOW_SAME_DAY })

    await cap.recordSpend(5) // 正好打滿 $5
    const check = await cap.checkBudget()
    expect(check.outcome).toBe('over_cap')
    expect(check.dailySpendMicroUsd).toBe(5_000_000)
  })

  it('is disabled (fail-closed) when the cap env is missing or invalid', async () => {
    const { kv } = makeFakeKv()
    for (const env of [{}, { AI_AGENT_DAILY_COST_CAP_USD: 'abc' }, { AI_AGENT_DAILY_COST_CAP_USD: '0' }, { AI_AGENT_DAILY_COST_CAP_USD: '-1' }]) {
      const cap = createDailyCostCap({ env, kv, now: () => NOW_SAME_DAY })
      expect((await cap.checkBudget()).outcome).toBe('disabled')
    }
  })

  it('is kv_unavailable (fail-closed) when no kv client is wired', async () => {
    const cap = createDailyCostCap({ env: ENV_CAP_5USD, kv: null, now: () => NOW_SAME_DAY })
    expect((await cap.checkBudget()).outcome).toBe('kv_unavailable')
  })

  it('is kv_unavailable when the kv read throws — and never rethrows the raw error', async () => {
    const throwingKv: CostCapKv = {
      async get() {
        throw new Error('redis exploded: token=SECRET url=https://secret.upstash.io')
      },
      async incrByWithTtl() {
        throw new Error('redis exploded: token=SECRET')
      },
    }
    const cap = createDailyCostCap({ env: ENV_CAP_5USD, kv: throwingKv, now: () => NOW_SAME_DAY })
    expect((await cap.checkBudget()).outcome).toBe('kv_unavailable')
  })

  it('recordSpend swallows kv failures and reports recorded:false (reply must not be dropped)', async () => {
    const throwingKv: CostCapKv = {
      async get() {
        return null
      },
      async incrByWithTtl() {
        throw new Error('redis exploded')
      },
    }
    const cap = createDailyCostCap({ env: ENV_CAP_5USD, kv: throwingKv, now: () => NOW_SAME_DAY })
    await expect(cap.recordSpend(0.5)).resolves.toEqual({ recorded: false })
  })

  it('recordSpend is a no-op (recorded:false) when disabled or kv missing', async () => {
    const { kv, counters } = makeFakeKv()
    const disabled = createDailyCostCap({ env: {}, kv, now: () => NOW_SAME_DAY })
    expect(await disabled.recordSpend(1)).toEqual({ recorded: false })
    expect(counters.size).toBe(0)

    const noKv = createDailyCostCap({ env: ENV_CAP_5USD, kv: null, now: () => NOW_SAME_DAY })
    expect(await noKv.recordSpend(1)).toEqual({ recorded: false })
  })
})
