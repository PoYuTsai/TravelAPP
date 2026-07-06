/**
 * case-intake-llm-adapter.test.ts — 客需三分流 enrichment 真 adapter
 * （design 2026-06-10 §1 LLM 刀）.
 *
 * 鎖住：
 *   - prompt 安全邊界：只有客人原文＋summary＋缺項模板進 prompt
 *   - cost cap 紀律：非 ok 一律不打 transport；打完必 recordSpend
 *   - 錯誤一律 fixed-code CaseIntakeLlmError（永不帶 key / 內文）
 *   - model resolution：explicit > env > default
 */

import { describe, expect, it, vi } from 'vitest'
import {
  buildQuestionPolishPrompt,
  buildItineraryDraftPrompt,
  createAnthropicCaseIntakeSources,
  resolveCaseIntakeLlmModel,
  CASE_INTAKE_LLM_MODEL_DEFAULT,
  CaseIntakeLlmError,
} from '../partner-group/case-intake-llm-adapter'
import type { DailyCostCap } from '../observability/daily-cost-cap'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const QUESTION_REQ = {
  requirementText: '客人說 12 月想去清邁玩',
  summary: '尚未取得可整理的客需重點',
  missingFields: ['travelDates', 'partySize'],
}

const DRAFT_REQ = {
  requirementText: '客人 12/20 出發，2大2小，住古城',
  summary: '日期：12/20；人數：2大2小',
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

function anthropicOkResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      content: [{ text }],
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
    { status: 200 }
  )
}

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

describe('resolveCaseIntakeLlmModel', () => {
  it('explicit > env > default', () => {
    expect(resolveCaseIntakeLlmModel({ model: 'claude-x' })).toBe('claude-x')
    expect(
      resolveCaseIntakeLlmModel({ env: { AI_AGENT_CASE_INTAKE_LLM_MODEL: 'claude-y' } })
    ).toBe('claude-y')
    expect(resolveCaseIntakeLlmModel()).toBe(CASE_INTAKE_LLM_MODEL_DEFAULT)
  })
})

// ---------------------------------------------------------------------------
// Prompt builders — 安全邊界
// ---------------------------------------------------------------------------

describe('prompt builders', () => {
  it('question prompt carries requirement text + summary + baseline questions only', () => {
    const p = buildQuestionPolishPrompt(QUESTION_REQ)
    expect(p.user).toContain('客人說 12 月想去清邁玩')
    expect(p.user).toContain('travelDates')
    expect(p.system).toContain('JSON')
    // 不得出現價格／案例語彙（prompt 模板自身乾淨）
    expect(p.system).toContain('不得提到價格')
  })

  it('draft prompt demands strict JSON with the composer schema', () => {
    const p = buildItineraryDraftPrompt(DRAFT_REQ)
    expect(p.user).toContain('客人 12/20 出發')
    expect(p.system).toContain('"requirements"')
    expect(p.system).toContain('constraints.days')
    expect(p.system).toContain('chiangmai_old_city')
  })
})

// ---------------------------------------------------------------------------
// createAnthropicCaseIntakeSources — cost cap 紀律 + fixed codes
// ---------------------------------------------------------------------------

describe('createAnthropicCaseIntakeSources', () => {
  it('returns model text and records spend on success', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () => anthropicOkResponse('[{"field":"x","question":"？"}]'))
    const sources = createAnthropicCaseIntakeSources({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    const text = await sources.questionSource(QUESTION_REQ)
    expect(text).toBe('[{"field":"x","question":"？"}]')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(costCap.spends).toHaveLength(1)
    expect(costCap.spends[0]).toBeGreaterThan(0)
    // request 用的是 Haiku default model + messages endpoint
    const [url, init] = transport.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('api.anthropic.com')
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe(CASE_INTAKE_LLM_MODEL_DEFAULT)
  })

  it.each(['over_cap', 'disabled', 'kv_unavailable'] as const)(
    'budget %s → transport 永不被呼叫，throw fixed code',
    async (outcome) => {
      const transport = vi.fn()
      const sources = createAnthropicCaseIntakeSources({
        transport: transport as unknown as typeof fetch,
        apiKey: 'k',
        costCap: blockedCostCap(outcome),
      })
      await expect(sources.draftSource(DRAFT_REQ)).rejects.toThrow(CaseIntakeLlmError)
      expect(transport).not.toHaveBeenCalled()
    }
  )

  it('non-200 → fixed-code throw（不帶 body）', async () => {
    const transport = vi.fn(async () => new Response('upstream secret', { status: 500 }))
    const sources = createAnthropicCaseIntakeSources({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap: okCostCap(),
    })
    await expect(sources.questionSource(QUESTION_REQ)).rejects.toThrow(
      /anthropic_non_200/
    )
  })

  it('transport throw → fixed-code throw（raw error 不外洩）', async () => {
    const transport = vi.fn(async () => {
      throw new Error('x-api-key=SECRET leaked in stack')
    })
    const sources = createAnthropicCaseIntakeSources({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap: okCostCap(),
    })
    await expect(sources.questionSource(QUESTION_REQ)).rejects.toThrow(CaseIntakeLlmError)
    await expect(sources.questionSource(QUESTION_REQ)).rejects.not.toThrow(/SECRET/)
  })

  it('empty content → anthropic_parse_error，但 spend 已記（已付費）', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ content: [{ text: '' }], usage: { input_tokens: 10, output_tokens: 1 } }),
          { status: 200 }
        )
    )
    const sources = createAnthropicCaseIntakeSources({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await expect(sources.draftSource(DRAFT_REQ)).rejects.toThrow(/anthropic_parse_error/)
    expect(costCap.spends).toHaveLength(1)
  })
})
