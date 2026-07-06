/**
 * distill-approval-llm-adapter.test.ts — 刀A 層2 的 Anthropic intent parser adapter
 * （design 2026-06-12 §1）。
 *
 * 鎖住（mirror distill-llm-adapter.test.ts — 同一條紀律鏈）：
 *   - cost cap 紀律：非 ok 一律不打 transport；打完必 recordSpend
 *   - usage 缺時保守估帳（input ≈ (system+prompt) 長度/4、output = maxTokens，絕不記 0）
 *   - 截斷偵測：stop_reason === 'max_tokens' → throw（截斷 JSON 不可信），
 *     但「先記帳再 throw」— 已經打了就要記
 *   - 錯誤一律 fixed-code ApprovalLlmError（永不帶 key / prompt / 回文）
 *   - model resolution：explicit > env > default（設計指定 Haiku — 短句分類）
 *   - request body：model / max_tokens=256 / system / messages / headers
 *   - prompt 帶齊三樣 context：原話、候選清單全文、引用內容（如有）
 *   - adapter 只回 raw text — JSON 解析在 approval-intent.ts（零信任）
 */

import { describe, expect, it, vi } from 'vitest'
import {
  createAnthropicApprovalIntentSource,
  resolveApprovalIntentModel,
  buildApprovalIntentPrompt,
  APPROVAL_INTENT_MODEL_DEFAULT,
  APPROVAL_INTENT_MAX_TOKENS,
  APPROVAL_INTENT_SYSTEM_INSTRUCTION,
  ApprovalLlmError,
  type ApprovalIntentRequest,
} from '../distill/approval-llm-adapter'
import { estimateCostUsd, type DailyCostCap } from '../observability/daily-cost-cap'

// ---------------------------------------------------------------------------
// Helpers（照 distill-llm-adapter 測試模式）
// ---------------------------------------------------------------------------

const REQUEST: ApprovalIntentRequest = {
  text: '大車保險一點',
  candidates: [
    { id: 1, question: '球具怎麼裝車？', answer: '建議 10 人座 Van' },
    { id: 2, question: '燭光晚餐要先訂嗎？', answer: '要，至少提前 3 天' },
  ],
  quotedBotContent: '高爾夫球具建議用大車載',
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

function anthropicResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function anthropicOkResponse(text: string): Response {
  return anthropicResponse({
    content: [{ text }],
    usage: { input_tokens: 100, output_tokens: 20 },
    stop_reason: 'end_turn',
  })
}

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

describe('resolveApprovalIntentModel', () => {
  it('explicit > env > default（設計指定 Haiku — 短句分類）', () => {
    expect(resolveApprovalIntentModel({ model: 'claude-x' })).toBe('claude-x')
    expect(
      resolveApprovalIntentModel({ env: { AI_AGENT_APPROVE_LLM_MODEL: 'claude-y' } })
    ).toBe('claude-y')
    expect(
      resolveApprovalIntentModel({
        model: 'claude-x',
        env: { AI_AGENT_APPROVE_LLM_MODEL: 'claude-y' },
      })
    ).toBe('claude-x')
    expect(resolveApprovalIntentModel()).toBe(APPROVAL_INTENT_MODEL_DEFAULT)
    expect(APPROVAL_INTENT_MODEL_DEFAULT).toBe('claude-haiku-4-5')
  })
})

// ---------------------------------------------------------------------------
// buildApprovalIntentPrompt — 三樣 context 是行為的一部分
// ---------------------------------------------------------------------------

describe('buildApprovalIntentPrompt', () => {
  it('帶齊三樣 context：原話、候選清單、引用內容', () => {
    const prompt = buildApprovalIntentPrompt({
      text: '大車保險一點',
      candidates: [{ id: 1, question: '球具怎麼裝車？', answer: '建議 10 人座 Van' }],
      quotedBotContent: '高爾夫球具建議用大車載',
    })
    expect(prompt).toContain('大車保險一點')
    expect(prompt).toContain('1. Q：球具怎麼裝車？')
    expect(prompt).toContain('A：建議 10 人座 Van')
    expect(prompt).toContain('高爾夫球具建議用大車載')
  })

  it('候選編號用貼群時的穩定 id，不是陣列位置', () => {
    const prompt = buildApprovalIntentPrompt({
      text: '收 3',
      candidates: [{ id: 3, question: 'q3', answer: 'a3' }],
    })
    expect(prompt).toContain('3. Q：q3')
  })

  it('無引用時不出現引用段', () => {
    const prompt = buildApprovalIntentPrompt({
      text: '都收吧',
      candidates: [{ id: 1, question: 'q', answer: 'a' }],
    })
    expect(prompt).not.toContain('引用')
  })

  it('引用是純空白時也不出現引用段', () => {
    const prompt = buildApprovalIntentPrompt({
      text: '都收吧',
      candidates: [{ id: 1, question: 'q', answer: 'a' }],
      quotedBotContent: '   ',
    })
    expect(prompt).not.toContain('引用')
  })
})

// ---------------------------------------------------------------------------
// createAnthropicApprovalIntentSource — cost cap 紀律 + fixed codes + 截斷偵測
// ---------------------------------------------------------------------------

describe('createAnthropicApprovalIntentSource', () => {
  it.each(['over_cap', 'disabled', 'kv_unavailable'] as const)(
    'budget %s → transport 永不被呼叫，throw cost_cap fixed code',
    async (outcome) => {
      const transport = vi.fn()
      const source = createAnthropicApprovalIntentSource({
        transport: transport as unknown as typeof fetch,
        apiKey: 'k',
        costCap: blockedCostCap(outcome),
      })
      await expect(source(REQUEST)).rejects.toThrow(ApprovalLlmError)
      await expect(source(REQUEST)).rejects.toThrow(new RegExp(`cost_cap_${outcome}`))
      expect(transport).not.toHaveBeenCalled()
    }
  )

  it('200 → 回 raw text、recordSpend 被呼叫、request body 正確（Haiku、256、system）', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () => anthropicOkResponse('{"action":"approve","indices":[1]}'))
    const source = createAnthropicApprovalIntentSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'secret-key',
      costCap,
    })
    const text = await source(REQUEST)
    expect(text).toBe('{"action":"approve","indices":[1]}')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(costCap.spends).toHaveLength(1)
    expect(costCap.spends[0]).toBeGreaterThan(0)

    const [url, init] = transport.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('api.anthropic.com')
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('secret-key')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe(APPROVAL_INTENT_MODEL_DEFAULT)
    expect(body.max_tokens).toBe(APPROVAL_INTENT_MAX_TOKENS)
    expect(body.system).toBe(APPROVAL_INTENT_SYSTEM_INSTRUCTION)
    expect(body.messages).toEqual([
      { role: 'user', content: buildApprovalIntentPrompt(REQUEST) },
    ])
  })

  it('usage 缺 → 保守估帳（input ≈ (system+prompt) 長度/4、output = maxTokens，絕不記 0）', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () =>
      anthropicResponse({ content: [{ text: '{"action":"not_approval"}' }], stop_reason: 'end_turn' })
    )
    const source = createAnthropicApprovalIntentSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await expect(source(REQUEST)).resolves.toBe('{"action":"not_approval"}')
    expect(costCap.spends).toHaveLength(1)
    const expectedInput = Math.ceil(
      (APPROVAL_INTENT_SYSTEM_INSTRUCTION.length + buildApprovalIntentPrompt(REQUEST).length) / 4
    )
    expect(costCap.spends[0]).toBe(
      estimateCostUsd(APPROVAL_INTENT_MODEL_DEFAULT, expectedInput, APPROVAL_INTENT_MAX_TOKENS)
    )
    expect(costCap.spends[0]).toBeGreaterThan(0)
  })

  it('recordSpend recorded:false → 不丟掉已付費的回覆', async () => {
    const transport = vi.fn(async () => anthropicOkResponse('{"action":"approve_all"}'))
    const costCap: DailyCostCap = {
      async checkBudget() {
        return { outcome: 'ok' as const, dailySpendMicroUsd: 0 }
      },
      async recordSpend() {
        return { recorded: false }
      },
    }
    const source = createAnthropicApprovalIntentSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await expect(source(REQUEST)).resolves.toBe('{"action":"approve_all"}')
  })

  it('stop_reason max_tokens → 先記帳再 throw max_tokens_truncated（截斷 JSON 不可信）', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () =>
      anthropicResponse({
        content: [{ text: '{"action":"appro' }],
        usage: { input_tokens: 100, output_tokens: 256 },
        stop_reason: 'max_tokens',
      })
    )
    const source = createAnthropicApprovalIntentSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await expect(source(REQUEST)).rejects.toThrow(/max_tokens_truncated/)
    // 已經打了就要記 — throw 前 spend 必須已入帳
    expect(costCap.spends).toHaveLength(1)
    expect(costCap.spends[0]).toBeGreaterThan(0)
  })

  it('transport throw → anthropic_api_error（raw error 不外洩）', async () => {
    const transport = vi.fn(async () => {
      throw new Error('x-api-key=SECRET leaked in stack')
    })
    const source = createAnthropicApprovalIntentSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap: okCostCap(),
    })
    await expect(source(REQUEST)).rejects.toThrow(/anthropic_api_error/)
    await expect(source(REQUEST)).rejects.not.toThrow(/SECRET/)
  })

  it('non-200 → anthropic_non_200（不帶 upstream body）', async () => {
    const transport = vi.fn(async () => new Response('upstream secret', { status: 500 }))
    const source = createAnthropicApprovalIntentSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap: okCostCap(),
    })
    await expect(source(REQUEST)).rejects.toThrow(/anthropic_non_200/)
    await expect(source(REQUEST)).rejects.not.toThrow(/upstream secret/)
  })

  it('content[0].text 缺 → anthropic_parse_error，但 spend 已記（已付費）', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () =>
      anthropicResponse({ content: [], usage: { input_tokens: 10, output_tokens: 1 } })
    )
    const source = createAnthropicApprovalIntentSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await expect(source(REQUEST)).rejects.toThrow(/anthropic_parse_error/)
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
    const source = createAnthropicApprovalIntentSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await expect(source(REQUEST)).rejects.toThrow(/anthropic_parse_error/)
    expect(costCap.spends).toHaveLength(1)
  })

  it('response body 非 JSON → anthropic_parse_error', async () => {
    const transport = vi.fn(async () => new Response('not json', { status: 200 }))
    const source = createAnthropicApprovalIntentSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap: okCostCap(),
    })
    await expect(source(REQUEST)).rejects.toThrow(/anthropic_parse_error/)
  })

  it('成功回 raw text 原樣（不在 adapter 解析 JSON）', async () => {
    const raw = '  前綴雜訊 {"action":"approve","indices":[2]} 後綴'
    const transport = vi.fn(async () => anthropicOkResponse(raw))
    const source = createAnthropicApprovalIntentSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap: okCostCap(),
    })
    await expect(source(REQUEST)).resolves.toBe(raw)
  })
})

// ---------------------------------------------------------------------------
// System prompt — 批准解析規則鎖定（防止 prompt 被無聲改壞）
// ---------------------------------------------------------------------------

describe('APPROVAL_INTENT_SYSTEM_INSTRUCTION', () => {
  it('carries the approval intent hard rules', () => {
    expect(APPROVAL_INTENT_SYSTEM_INSTRUCTION).toContain('approve_all')
    expect(APPROVAL_INTENT_SYSTEM_INSTRUCTION).toContain('not_approval')
    expect(APPROVAL_INTENT_SYSTEM_INSTRUCTION).toContain('modify')
    expect(APPROVAL_INTENT_SYSTEM_INSTRUCTION).toContain('不得腦補')
    expect(APPROVAL_INTENT_SYSTEM_INSTRUCTION).toContain('編號只能用候選清單裡存在的編號')
    expect(APPROVAL_INTENT_SYSTEM_INSTRUCTION).toContain('confidence')
    expect(APPROVAL_INTENT_SYSTEM_INSTRUCTION).toContain('code fence')
  })

  it('三動作必帶 confidence 是明文規則（零信任 parser 缺 confidence 即 fallback）', () => {
    expect(APPROVAL_INTENT_SYSTEM_INSTRUCTION).toContain('必須帶 confidence')
    expect(APPROVAL_INTENT_SYSTEM_INSTRUCTION).toContain('not_approval 不需要 confidence')
  })

  it('沉澱語境裡「行號」指 transcript 行 — 本 prompt 一律用「編號」', () => {
    expect(APPROVAL_INTENT_SYSTEM_INSTRUCTION).not.toContain('行號')
  })
})
