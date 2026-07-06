import { describe, it, expect, vi } from 'vitest'
import { summarizeOaInquiry, isAdsSummaryEnabled } from '../summary-adapter'
import type { OaContactMessage } from '../oa-contact-record'

const msgs: OaContactMessage[] = [
  { ts: 1, text: '你好，7 月想帶爸媽 4 大 2 小去清邁玩五天，想問包車' },
  { ts: 2, text: '大概預算兩萬台幣' },
]

const ON = { AI_AGENT_ADS_SUMMARY_ENABLED: 'true' }

describe('isAdsSummaryEnabled', () => {
  it('gate off unless env flag === "true"', () => {
    expect(isAdsSummaryEnabled({})).toBe(false)
    expect(isAdsSummaryEnabled({ AI_AGENT_ADS_SUMMARY_ENABLED: 'false' })).toBe(false)
    expect(isAdsSummaryEnabled({ AI_AGENT_ADS_SUMMARY_ENABLED: '' })).toBe(false)
    expect(isAdsSummaryEnabled({ AI_AGENT_ADS_SUMMARY_ENABLED: 'TRUE' })).toBe(true)
    expect(isAdsSummaryEnabled({ AI_AGENT_ADS_SUMMARY_ENABLED: ' true ' })).toBe(true)
  })
})

describe('summarizeOaInquiry', () => {
  it('gate off → returns 原文節錄 fallback, no LLM call', async () => {
    const llm = vi.fn()
    const out = await summarizeOaInquiry({ messages: msgs }, { env: {}, llm })
    expect(llm).not.toHaveBeenCalled()
    expect(out.inquiry).toContain('清邁')
  })

  it('gate on → uses LLM JSON output', async () => {
    const llm = vi.fn(async () =>
      JSON.stringify({ inquiry: '清邁親子包車 5 天', headcount: '4大2小', amount: 'NT$20000' }),
    )
    const out = await summarizeOaInquiry({ messages: msgs }, { env: ON, llm })
    expect(out).toEqual({ inquiry: '清邁親子包車 5 天', headcount: '4大2小', amount: 'NT$20000' })
  })

  it('LLM throws → falls back to 原文節錄, never throws', async () => {
    const llm = vi.fn(async () => {
      throw new Error('anthropic 500')
    })
    const out = await summarizeOaInquiry({ messages: msgs }, { env: ON, llm })
    expect(out.inquiry).toContain('清邁')
  })

  it('LLM returns non-JSON → fallback', async () => {
    const llm = vi.fn(async () => 'sorry I cannot')
    const out = await summarizeOaInquiry({ messages: msgs }, { env: ON, llm })
    expect(out.inquiry).toContain('清邁')
  })

  it('cap exceeded → skips LLM, fallback', async () => {
    const llm = vi.fn()
    const costCap = { checkBudget: async () => 'exceeded' as const, recordSpend: async () => {} }
    const out = await summarizeOaInquiry({ messages: msgs }, { env: ON, llm, costCap })
    expect(llm).not.toHaveBeenCalled()
    expect(out.inquiry).toContain('清邁')
  })

  it('cap ok → calls LLM', async () => {
    const llm = vi.fn(async () =>
      JSON.stringify({ inquiry: '清邁包車', headcount: '', amount: '' }),
    )
    const costCap = { checkBudget: async () => 'ok' as const, recordSpend: async () => {} }
    const out = await summarizeOaInquiry({ messages: msgs }, { env: ON, llm, costCap })
    expect(llm).toHaveBeenCalledTimes(1)
    expect(out).toEqual({ inquiry: '清邁包車', headcount: '', amount: '' })
  })

  it('LLM JSON with extra prose around object → still parsed', async () => {
    const llm = vi.fn(async () =>
      '好的，這是結果：\n{"inquiry":"清邁包車 5 天","headcount":"4大2小","amount":""}\n希望有幫助',
    )
    const out = await summarizeOaInquiry({ messages: msgs }, { env: ON, llm })
    expect(out).toEqual({ inquiry: '清邁包車 5 天', headcount: '4大2小', amount: '' })
  })

  it('LLM JSON missing inquiry → fallback', async () => {
    const llm = vi.fn(async () => JSON.stringify({ headcount: '4大2小', amount: '' }))
    const out = await summarizeOaInquiry({ messages: msgs }, { env: ON, llm })
    expect(out.inquiry).toContain('清邁')
  })

  it('empty messages → fallback with empty inquiry, no throw', async () => {
    const llm = vi.fn()
    const out = await summarizeOaInquiry({ messages: [] }, { env: {}, llm })
    expect(out).toEqual({ inquiry: '', headcount: '', amount: '' })
  })

  it('messages undefined → fallback, never throws (fail-open)', async () => {
    const llm = vi.fn()
    await expect(
      summarizeOaInquiry({ messages: undefined } as any, { env: {}, llm }),
    ).resolves.toEqual({ inquiry: '', headcount: '', amount: '' })
    expect(llm).not.toHaveBeenCalled()
  })

  it('message with null text → fallback, never throws', async () => {
    const llm = vi.fn()
    await expect(
      summarizeOaInquiry(
        { messages: [{ ts: 1, text: null }, { ts: 2, text: '清邁包車' }] } as any,
        { env: {}, llm },
      ),
    ).resolves.toEqual({ inquiry: '清邁包車', headcount: '', amount: '' })
    expect(llm).not.toHaveBeenCalled()
  })

  it('long first message → excerpt truncated with ellipsis', async () => {
    const long = '一'.repeat(100)
    const out = await summarizeOaInquiry(
      { messages: [{ ts: 1, text: long }] },
      { env: {}, llm: vi.fn() },
    )
    expect(out.inquiry.endsWith('…')).toBe(true)
    expect(out.inquiry.length).toBeLessThanOrEqual(61)
  })
})
