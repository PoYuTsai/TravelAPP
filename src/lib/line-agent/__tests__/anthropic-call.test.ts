/**
 * anthropic-call.test.ts — 共用 Anthropic Messages transport（抽自 distill /
 * approval / case-intake / vision 四個 throw-based adapter 的逐字重複核心）。
 *
 * 鎖住共用層契約（四個 adapter 的回歸網靠各自 *.test.ts，本檔鎖 helper 本體）：
 *   - cost cap 紀律：非 ok 一律不打 transport；打完必 recordSpend
 *   - 錯誤一律經 makeError（caller 映射成自己的 fixed-code Error 子類）
 *   - usage 缺 → fallbackInputTokens（input）+ maxTokens（output），絕不記 0
 *   - 截斷政策：throw（截斷即丟錯）/ mark（標記仍回）/ ignore（不檢查）
 *   - request body：model / max_tokens / system / messages / headers
 */

import { describe, expect, it, vi } from 'vitest'
import {
  callAnthropicMessages,
  type CallAnthropicMessagesParams,
  type CallAnthropicMessagesDeps,
} from '../observability/anthropic-call'
import { estimateCostUsd, type DailyCostCap } from '../observability/daily-cost-cap'
import type { AgentLogger, AgentLogEvent, AgentLogFieldsByEvent } from '../observability/structured-log'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class TestError extends Error {
  constructor(public readonly code: string) {
    super(`test error: ${code}`)
    this.name = 'TestError'
  }
}

function okCostCap(): DailyCostCap & { spends: number[] } {
  const spends: number[] = []
  return {
    spends,
    async checkBudget() {
      return { outcome: 'ok' as const, dailySpendMicroUsd: 0 }
    },
    async recordSpend(usd: number) {
      spends.push(usd)
      return { recorded: true }
    },
  }
}

function blockedCostCap(outcome: 'over_cap' | 'disabled' | 'kv_unavailable'): DailyCostCap {
  return {
    async checkBudget() {
      return { outcome }
    },
    async recordSpend() {
      return { recorded: false }
    },
  }
}

interface CollectedLog {
  event: AgentLogEvent
  fields: Record<string, unknown>
}

function collectingLogger(): { logs: CollectedLog[]; log: AgentLogger } {
  const logs: CollectedLog[] = []
  const log: AgentLogger = <E extends AgentLogEvent>(
    event: E,
    fields?: AgentLogFieldsByEvent[E],
  ) => {
    logs.push({ event, fields: (fields ?? {}) as Record<string, unknown> })
  }
  return { logs, log }
}

function anthropicResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function okResponse(text: string, stopReason = 'end_turn'): Response {
  return anthropicResponse({
    content: [{ text }],
    usage: { input_tokens: 100, output_tokens: 50 },
    stop_reason: stopReason,
  })
}

const MODEL = 'claude-haiku-4-5'
const SYSTEM = 'you are a test system prompt'
const USER = 'hello world'

function baseParams(
  over: Partial<CallAnthropicMessagesParams> = {},
): CallAnthropicMessagesParams {
  return {
    model: MODEL,
    system: SYSTEM,
    messages: [{ role: 'user', content: USER }],
    maxTokens: 256,
    fallbackInputTokens: 999,
    truncation: 'throw',
    ...over,
  }
}

function baseDeps(over: Partial<CallAnthropicMessagesDeps> = {}): CallAnthropicMessagesDeps {
  return {
    transport: (async () => okResponse('hi')) as unknown as typeof fetch,
    apiKey: 'secret-key',
    costCap: okCostCap(),
    log: collectingLogger().log,
    makeError: (code) => new TestError(code),
    ...over,
  }
}

// ---------------------------------------------------------------------------
// Budget gate
// ---------------------------------------------------------------------------

describe('callAnthropicMessages — budget gate', () => {
  it.each(['over_cap', 'disabled', 'kv_unavailable'] as const)(
    'budget %s → transport 永不被呼叫，throw cost_cap fixed code',
    async (outcome) => {
      const transport = vi.fn()
      await expect(
        callAnthropicMessages(
          baseParams(),
          baseDeps({ transport: transport as unknown as typeof fetch, costCap: blockedCostCap(outcome) }),
        ),
      ).rejects.toMatchObject({ code: `cost_cap_${outcome}` })
      expect(transport).not.toHaveBeenCalled()
    },
  )

  it('budget non-ok → makeError 收到的是 TestError（caller 自己的型別）', async () => {
    await expect(
      callAnthropicMessages(baseParams(), baseDeps({ costCap: blockedCostCap('over_cap') })),
    ).rejects.toBeInstanceOf(TestError)
  })
})

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

describe('callAnthropicMessages — success', () => {
  it('200 → 回 text、recordSpend 被呼叫、request body / headers 正確', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () => okResponse('the answer'))
    const result = await callAnthropicMessages(
      baseParams({ maxTokens: 512 }),
      baseDeps({ transport: transport as unknown as typeof fetch, costCap }),
    )
    expect(result.text).toBe('the answer')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(costCap.spends).toHaveLength(1)
    expect(costCap.spends[0]).toBeGreaterThan(0)

    const [url, init] = transport.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('api.anthropic.com')
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('secret-key')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe(MODEL)
    expect(body.max_tokens).toBe(512)
    expect(body.system).toBe(SYSTEM)
    expect(body.messages).toEqual([{ role: 'user', content: USER }])
    expect('tools' in body).toBe(false)
  })

  it('200 → terminal log 是 llm_call outcome ok（含 tokens / costUsd）', async () => {
    const { logs, log } = collectingLogger()
    await callAnthropicMessages(baseParams(), baseDeps({ log }))
    const llm = logs.filter((l) => l.event === 'llm_call')
    expect(llm).toHaveLength(1)
    expect(llm[0].fields.outcome).toBe('ok')
    expect(llm[0].fields.inputTokens).toBe(100)
    expect(llm[0].fields.outputTokens).toBe(50)
    expect(llm[0].fields.costUsd).toBeGreaterThan(0)
  })

  it('usage 缺 → fallbackInputTokens（input）+ maxTokens（output），絕不記 0', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () =>
      anthropicResponse({ content: [{ text: 'ok' }], stop_reason: 'end_turn' }),
    )
    const result = await callAnthropicMessages(
      baseParams({ maxTokens: 256, fallbackInputTokens: 777 }),
      baseDeps({ transport: transport as unknown as typeof fetch, costCap }),
    )
    expect(result.usageMissing).toBe(true)
    expect(result.inputTokens).toBe(777)
    expect(result.outputTokens).toBe(256)
    expect(costCap.spends[0]).toBe(estimateCostUsd(MODEL, 777, 256))
    expect(costCap.spends[0]).toBeGreaterThan(0)
  })

  it('recordSpend recorded:false → 不丟掉已付費的回覆，log cost_cap record_failed', async () => {
    const { logs, log } = collectingLogger()
    const costCap: DailyCostCap = {
      async checkBudget() {
        return { outcome: 'ok' as const, dailySpendMicroUsd: 0 }
      },
      async recordSpend() {
        return { recorded: false }
      },
    }
    const result = await callAnthropicMessages(baseParams(), baseDeps({ costCap, log }))
    expect(result.text).toBe('hi')
    expect(logs.some((l) => l.event === 'cost_cap' && l.fields.reason === 'record_failed')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Truncation policy
// ---------------------------------------------------------------------------

describe('callAnthropicMessages — truncation policy', () => {
  it("'throw' + max_tokens → 先記帳再 throw max_tokens_truncated", async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () => okResponse('half a JSO', 'max_tokens'))
    await expect(
      callAnthropicMessages(
        baseParams({ truncation: 'throw' }),
        baseDeps({ transport: transport as unknown as typeof fetch, costCap }),
      ),
    ).rejects.toMatchObject({ code: 'max_tokens_truncated' })
    expect(costCap.spends).toHaveLength(1)
    expect(costCap.spends[0]).toBeGreaterThan(0)
  })

  it("'mark' + max_tokens → 回 text、truncated:true、terminal log 標 degradedReason 但 outcome ok", async () => {
    const { logs, log } = collectingLogger()
    const transport = vi.fn(async () => okResponse('partial text', 'max_tokens'))
    const result = await callAnthropicMessages(
      baseParams({ truncation: 'mark' }),
      baseDeps({ transport: transport as unknown as typeof fetch, log }),
    )
    expect(result.text).toBe('partial text')
    expect(result.truncated).toBe(true)
    const llm = logs.filter((l) => l.event === 'llm_call')
    expect(llm).toHaveLength(1)
    expect(llm[0].fields.outcome).toBe('ok')
    expect(llm[0].fields.degradedReason).toBe('max_tokens_truncated')
  })

  it("'ignore' + max_tokens → 回 text、不檢查截斷、terminal log 無 degradedReason", async () => {
    const { logs, log } = collectingLogger()
    const transport = vi.fn(async () => okResponse('whole text', 'max_tokens'))
    const result = await callAnthropicMessages(
      baseParams({ truncation: 'ignore' }),
      baseDeps({ transport: transport as unknown as typeof fetch, log }),
    )
    expect(result.text).toBe('whole text')
    const llm = logs.filter((l) => l.event === 'llm_call')
    expect(llm[0].fields.outcome).toBe('ok')
    expect(llm[0].fields.degradedReason).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Failure modes — all sanitized via makeError
// ---------------------------------------------------------------------------

describe('callAnthropicMessages — failure modes', () => {
  it('transport throw → anthropic_api_error，raw error 不外洩、不記帳', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () => {
      throw new Error('x-api-key=SECRET leaked in stack')
    })
    const promise = callAnthropicMessages(
      baseParams(),
      baseDeps({ transport: transport as unknown as typeof fetch, costCap }),
    )
    await expect(promise).rejects.toMatchObject({ code: 'anthropic_api_error' })
    await expect(promise).rejects.not.toThrow(/SECRET/)
    expect(costCap.spends).toHaveLength(0)
  })

  it('non-200 → anthropic_non_200（不帶 upstream body）', async () => {
    const transport = vi.fn(async () => new Response('upstream secret', { status: 500 }))
    const promise = callAnthropicMessages(
      baseParams(),
      baseDeps({ transport: transport as unknown as typeof fetch }),
    )
    await expect(promise).rejects.toMatchObject({ code: 'anthropic_non_200' })
    await expect(promise).rejects.not.toThrow(/upstream secret/)
  })

  it('response body 非 JSON → anthropic_parse_error，未記帳', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () => new Response('not json', { status: 200 }))
    await expect(
      callAnthropicMessages(
        baseParams(),
        baseDeps({ transport: transport as unknown as typeof fetch, costCap }),
      ),
    ).rejects.toMatchObject({ code: 'anthropic_parse_error' })
    expect(costCap.spends).toHaveLength(0)
  })

  it('content[0].text 缺 → anthropic_parse_error，但 spend 已記（已付費）', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () =>
      anthropicResponse({ content: [], usage: { input_tokens: 10, output_tokens: 1 } }),
    )
    await expect(
      callAnthropicMessages(
        baseParams(),
        baseDeps({ transport: transport as unknown as typeof fetch, costCap }),
      ),
    ).rejects.toMatchObject({ code: 'anthropic_parse_error' })
    expect(costCap.spends).toHaveLength(1)
  })

  it('content[0].text 空白 → anthropic_parse_error，但 spend 已記', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () =>
      anthropicResponse({ content: [{ text: '   ' }], usage: { input_tokens: 10, output_tokens: 1 } }),
    )
    await expect(
      callAnthropicMessages(
        baseParams(),
        baseDeps({ transport: transport as unknown as typeof fetch, costCap }),
      ),
    ).rejects.toMatchObject({ code: 'anthropic_parse_error' })
    expect(costCap.spends).toHaveLength(1)
  })
})
