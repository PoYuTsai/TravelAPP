/**
 * distill-llm-adapter.test.ts — 沉澱刀2 的真 Anthropic adapter
 * （design 2026-06-11 §2 LLM 刀）。
 *
 * 鎖住：
 *   - cost cap 紀律：非 ok 一律不打 transport；打完必 recordSpend
 *   - usage 缺時保守估帳（input ≈ prompt 長度/4、output = maxTokens，絕不記 0）
 *   - 截斷偵測：stop_reason === 'max_tokens' → throw（截斷 JSON 不可信），
 *     但「先記帳再 throw」— 已經打了就要記
 *   - 錯誤一律 fixed-code DistillLlmError（永不帶 key / prompt / 回文）
 *   - model resolution：explicit > env > default（設計指定 Sonnet）
 *   - request body：model / max_tokens=2048 / system / messages / headers
 */

import { describe, expect, it, vi } from 'vitest'
import {
  createAnthropicDistillSource,
  resolveDistillModel,
  DISTILL_LLM_MODEL_DEFAULT,
  DISTILL_MAX_TOKENS,
  DISTILL_SYSTEM_INSTRUCTION,
  DistillLlmError,
} from '../distill/distill-llm-adapter'
import { estimateCostUsd, type DailyCostCap } from '../observability/daily-cost-cap'

// ---------------------------------------------------------------------------
// Helpers（照 case-intake-llm-adapter 測試模式）
// ---------------------------------------------------------------------------

const PROMPT_TEXT = [
  '#1 [夥伴A] 清邁到拜縣包車多少？',
  '#2 [夥伴B] （回覆 #1） 單程 2500 泰銖',
].join('\n')

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

function anthropicResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function anthropicOkResponse(text: string): Response {
  return anthropicResponse({
    content: [{ text }],
    usage: { input_tokens: 100, output_tokens: 50 },
    stop_reason: 'end_turn',
  })
}

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

describe('resolveDistillModel', () => {
  it('explicit > env > default（設計指定 Sonnet）', () => {
    expect(resolveDistillModel({ model: 'claude-x' })).toBe('claude-x')
    expect(resolveDistillModel({ env: { AI_AGENT_DISTILL_LLM_MODEL: 'claude-y' } })).toBe(
      'claude-y'
    )
    expect(
      resolveDistillModel({ model: 'claude-x', env: { AI_AGENT_DISTILL_LLM_MODEL: 'claude-y' } })
    ).toBe('claude-x')
    expect(resolveDistillModel()).toBe(DISTILL_LLM_MODEL_DEFAULT)
    expect(DISTILL_LLM_MODEL_DEFAULT).toBe('claude-sonnet-4-6')
  })
})

// ---------------------------------------------------------------------------
// createAnthropicDistillSource — cost cap 紀律 + fixed codes + 截斷偵測
// ---------------------------------------------------------------------------

describe('createAnthropicDistillSource', () => {
  it.each(['over_cap', 'disabled', 'kv_unavailable'] as const)(
    'budget %s → transport 永不被呼叫，throw cost_cap fixed code',
    async (outcome) => {
      const transport = vi.fn()
      const source = createAnthropicDistillSource({
        transport: transport as unknown as typeof fetch,
        apiKey: 'k',
        costCap: blockedCostCap(outcome),
      })
      await expect(source(PROMPT_TEXT)).rejects.toThrow(DistillLlmError)
      await expect(source(PROMPT_TEXT)).rejects.toThrow(new RegExp(`cost_cap_${outcome}`))
      expect(transport).not.toHaveBeenCalled()
    }
  )

  it('200 → 回 raw text、recordSpend 被呼叫、request body 正確', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () => anthropicOkResponse('[{"question":"…"}]'))
    const source = createAnthropicDistillSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'secret-key',
      costCap,
    })
    const text = await source(PROMPT_TEXT)
    expect(text).toBe('[{"question":"…"}]')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(costCap.spends).toHaveLength(1)
    expect(costCap.spends[0]).toBeGreaterThan(0)

    const [url, init] = transport.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('api.anthropic.com')
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('secret-key')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe(DISTILL_LLM_MODEL_DEFAULT)
    expect(body.max_tokens).toBe(DISTILL_MAX_TOKENS)
    expect(body.system).toBe(DISTILL_SYSTEM_INSTRUCTION)
    expect(body.messages).toEqual([{ role: 'user', content: PROMPT_TEXT }])
  })

  it('usage 缺 → 保守估帳（input ≈ prompt 長度/4、output = maxTokens，絕不記 0）', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () =>
      anthropicResponse({ content: [{ text: '[]' }], stop_reason: 'end_turn' })
    )
    const source = createAnthropicDistillSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await expect(source(PROMPT_TEXT)).resolves.toBe('[]')
    expect(costCap.spends).toHaveLength(1)
    const expectedInput = Math.ceil(
      (DISTILL_SYSTEM_INSTRUCTION.length + PROMPT_TEXT.length) / 4
    )
    expect(costCap.spends[0]).toBe(
      estimateCostUsd(DISTILL_LLM_MODEL_DEFAULT, expectedInput, DISTILL_MAX_TOKENS)
    )
    expect(costCap.spends[0]).toBeGreaterThan(0)
  })

  it('recordSpend recorded:false → 不丟掉已付費的回覆', async () => {
    const transport = vi.fn(async () => anthropicOkResponse('[]'))
    const costCap: DailyCostCap = {
      async checkBudget() {
        return { outcome: 'ok' as const, dailySpendMicroUsd: 0 }
      },
      async recordSpend() {
        return { recorded: false }
      },
    }
    const source = createAnthropicDistillSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await expect(source(PROMPT_TEXT)).resolves.toBe('[]')
  })

  it('stop_reason max_tokens → 先記帳再 throw max_tokens_truncated（截斷 JSON 不可信）', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () =>
      anthropicResponse({
        content: [{ text: '[{"question":"被截斷的半個 JSO' }],
        usage: { input_tokens: 100, output_tokens: 2048 },
        stop_reason: 'max_tokens',
      })
    )
    const source = createAnthropicDistillSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await expect(source(PROMPT_TEXT)).rejects.toThrow(/max_tokens_truncated/)
    // 已經打了就要記 — throw 前 spend 必須已入帳
    expect(costCap.spends).toHaveLength(1)
    expect(costCap.spends[0]).toBeGreaterThan(0)
  })

  it('transport throw → anthropic_api_error（raw error 不外洩）', async () => {
    const transport = vi.fn(async () => {
      throw new Error('x-api-key=SECRET leaked in stack')
    })
    const source = createAnthropicDistillSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap: okCostCap(),
    })
    await expect(source(PROMPT_TEXT)).rejects.toThrow(/anthropic_api_error/)
    await expect(source(PROMPT_TEXT)).rejects.not.toThrow(/SECRET/)
  })

  it('non-200 → anthropic_non_200（不帶 upstream body）', async () => {
    const transport = vi.fn(async () => new Response('upstream secret', { status: 500 }))
    const source = createAnthropicDistillSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap: okCostCap(),
    })
    await expect(source(PROMPT_TEXT)).rejects.toThrow(/anthropic_non_200/)
    await expect(source(PROMPT_TEXT)).rejects.not.toThrow(/upstream secret/)
  })

  it('content[0].text 缺 → anthropic_parse_error，但 spend 已記（已付費）', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () =>
      anthropicResponse({ content: [], usage: { input_tokens: 10, output_tokens: 1 } })
    )
    const source = createAnthropicDistillSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await expect(source(PROMPT_TEXT)).rejects.toThrow(/anthropic_parse_error/)
    expect(costCap.spends).toHaveLength(1)
  })

  it('content[0].text 空白 → anthropic_parse_error，但 spend 已記', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () =>
      anthropicResponse({
        content: [{ text: '   ' }],
        usage: { input_tokens: 10, output_tokens: 1 },
      })
    )
    const source = createAnthropicDistillSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await expect(source(PROMPT_TEXT)).rejects.toThrow(/anthropic_parse_error/)
    expect(costCap.spends).toHaveLength(1)
  })

  it('response body 非 JSON → anthropic_parse_error', async () => {
    const transport = vi.fn(async () => new Response('not json', { status: 200 }))
    const source = createAnthropicDistillSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap: okCostCap(),
    })
    await expect(source(PROMPT_TEXT)).rejects.toThrow(/anthropic_parse_error/)
  })
})

// ---------------------------------------------------------------------------
// System prompt — 沉澱規則鎖定（防止 prompt 被無聲改壞）
// ---------------------------------------------------------------------------

describe('DISTILL_SYSTEM_INSTRUCTION', () => {
  it('carries the distill hard rules', () => {
    expect(DISTILL_SYSTEM_INSTRUCTION).toContain('≥2 次')
    expect(DISTILL_SYSTEM_INSTRUCTION).toContain('（已標記）')
    expect(DISTILL_SYSTEM_INSTRUCTION).toContain('最多 5 條')
    expect(DISTILL_SYSTEM_INSTRUCTION).toContain('sourceLines')
    expect(DISTILL_SYSTEM_INSTRUCTION).toContain('不得腦補')
    expect(DISTILL_SYSTEM_INSTRUCTION).toContain('code fence')
  })

  it('locks the third admission gate: reusable boss answers (knife A)', () => {
    expect(DISTILL_SYSTEM_INSTRUCTION).toContain('滿足任一')
    expect(DISTILL_SYSTEM_INSTRUCTION).toContain('可重複使用')
    expect(DISTILL_SYSTEM_INSTRUCTION).toContain('還成立嗎')
    expect(DISTILL_SYSTEM_INSTRUCTION).toContain('只對單一客人成立的不收')
  })
})
