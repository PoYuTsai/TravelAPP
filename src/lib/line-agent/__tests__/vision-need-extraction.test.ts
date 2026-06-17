import { describe, it, expect } from 'vitest'
import { parseVisionNeedBrief } from '../partner-group/vision-need-extraction'
import {
  VISION_NEED_SYSTEM_INSTRUCTION,
  createAnthropicVisionNeedSource,
} from '../partner-group/vision-need-extraction'
import type { LineImageContent } from '../line/content-client'
import type { DailyCostCap } from '../observability/daily-cost-cap'

const okCap: DailyCostCap = {
  checkBudget: async () => ({ outcome: 'ok', dailySpendMicroUsd: 0 }),
  recordSpend: async () => ({ recorded: true }),
} as unknown as DailyCostCap

describe('parseVisionNeedBrief', () => {
  it('parses well-formed JSON into a brief', () => {
    const raw = JSON.stringify({
      isConversation: true,
      summary: '4大2小想玩大象、玩水、看動物、吃美食',
      knownFacts: ['7/1-7/5', '4大2小', '小孩4歲與6歲'],
      gaps: ['航班時間', '住宿區域', '上車點'],
    })
    const brief = parseVisionNeedBrief(raw)
    expect(brief.isConversation).toBe(true)
    expect(brief.summary).toContain('大象')
    expect(brief.knownFacts).toHaveLength(3)
    expect(brief.gaps).toContain('航班時間')
  })

  it('fail-closed: non-JSON becomes summary, never throws, never loses text', () => {
    const brief = parseVisionNeedBrief('客人問清邁雨季幾月適合去')
    expect(brief.isConversation).toBe(true)
    expect(brief.summary).toBe('客人問清邁雨季幾月適合去')
    expect(brief.knownFacts).toEqual([])
    expect(brief.gaps).toEqual([])
  })

  it('honours isConversation:false for non-chat screenshots', () => {
    const brief = parseVisionNeedBrief(
      JSON.stringify({ isConversation: false, summary: '這張圖不是客人對話截圖', knownFacts: [], gaps: [] })
    )
    expect(brief.isConversation).toBe(false)
  })

  it('coerces non-array fields fail-closed (defensive against model drift)', () => {
    const brief = parseVisionNeedBrief(JSON.stringify({ isConversation: true, summary: 'x', knownFacts: 'oops', gaps: null }))
    expect(brief.knownFacts).toEqual([])
    expect(brief.gaps).toEqual([])
  })

  it('strips ```json fences before parsing (model drift)', () => {
    const brief = parseVisionNeedBrief('```json\n{"isConversation":true,"summary":"想去清邁","knownFacts":[],"gaps":[]}\n```')
    expect(brief.summary).toBe('想去清邁')
  })
})

describe('VISION_NEED_SYSTEM_INSTRUCTION (tripwire)', () => {
  it('要求 JSON 結構並列出四個欄位', () => {
    for (const f of ['isConversation', 'summary', 'knownFacts', 'gaps'])
      expect(VISION_NEED_SYSTEM_INSTRUCTION).toContain(f)
  })
  it('保留誠實邊界：不腦補、不提價格', () => {
    expect(VISION_NEED_SYSTEM_INSTRUCTION).toMatch(/不得腦補|不要猜/)
    expect(VISION_NEED_SYSTEM_INSTRUCTION).toMatch(/價格|報價/)
  })
  it('含斜線日期防跨月規則（M/D 視為月/日，不誤判跨月跨年）', () => {
    expect(VISION_NEED_SYSTEM_INSTRUCTION).toMatch(/月\/日|M\/D/)
    expect(VISION_NEED_SYSTEM_INSTRUCTION).toMatch(/跨月|跨年/)
  })
})

describe('createAnthropicVisionNeedSource', () => {
  it('把 vision 回的 JSON parse 成 brief', async () => {
    const fakeTransport = (async () =>
      new Response(
        JSON.stringify({
          content: [{ text: JSON.stringify({ isConversation: true, summary: '想去清邁玩水', knownFacts: ['7/1-7/5'], gaps: ['航班'] }) }],
          usage: { input_tokens: 1500, output_tokens: 80 },
        }),
        { status: 200 }
      )) as unknown as typeof fetch
    const source = createAnthropicVisionNeedSource({ transport: fakeTransport, apiKey: 'k', costCap: okCap })
    const brief = await source({ base64: 'AAAA', mediaType: 'image/jpeg' } as LineImageContent)
    expect(brief.summary).toContain('玩水')
    expect(brief.gaps).toEqual(['航班'])
  })

  it('vision 回非 JSON 也 fail-closed（原文當 summary）', async () => {
    const fakeTransport = (async () =>
      new Response(
        JSON.stringify({ content: [{ text: '客人想問清邁天氣' }], usage: { input_tokens: 1500, output_tokens: 20 } }),
        { status: 200 }
      )) as unknown as typeof fetch
    const source = createAnthropicVisionNeedSource({ transport: fakeTransport, apiKey: 'k', costCap: okCap })
    const brief = await source({ base64: 'AAAA', mediaType: 'image/jpeg' } as LineImageContent)
    expect(brief.summary).toBe('客人想問清邁天氣')
    expect(brief.isConversation).toBe(true)
  })

  // 回歸網（Task 4）：抽取層必須原樣保留模型回的 7/1-7/5 同月區間，
  // 不得在 parse 過程把斜線日期竄改成跨月（如 1月7日–7月5日）。
  // 鎖的是抽取層不破壞已正確日期，不是測模型本身。
  it('7/1-7/5 抽成同月 5 天區間，不誤判跨月', async () => {
    const fakeTransport = (async () =>
      new Response(
        JSON.stringify({
          content: [
            {
              text: JSON.stringify({
                isConversation: true,
                summary: '客人要 7/1 到 7/5 清邁親子行程',
                knownFacts: ['日期：7/1-7/5（5 天）'],
                gaps: ['航班', '住宿'],
              }),
            },
          ],
          usage: { input_tokens: 1500, output_tokens: 60 },
        }),
        { status: 200 }
      )) as unknown as typeof fetch
    const source = createAnthropicVisionNeedSource({ transport: fakeTransport, apiKey: 'k', costCap: okCap })
    const brief = await source({ base64: 'AAAA', mediaType: 'image/jpeg' } as LineImageContent)
    expect(brief.knownFacts.join()).toContain('7/1-7/5')
    expect(brief.knownFacts.join()).not.toMatch(/1月7日|跨.*月|7月5日.*1月/)
  })
})
