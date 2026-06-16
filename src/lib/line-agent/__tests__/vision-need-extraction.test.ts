import { describe, it, expect } from 'vitest'
import { parseVisionNeedBrief } from '../partner-group/vision-need-extraction'

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
