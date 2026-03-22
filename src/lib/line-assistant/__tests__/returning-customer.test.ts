import { describe, expect, it } from 'vitest'
import { buildReturningCustomerHint } from '@/lib/line-assistant/domain/returning-customer'

describe('buildReturningCustomerHint', () => {
  it('returns a high-confidence notion hint without changing system identity', () => {
    const hint = buildReturningCustomerHint({
      hasSeenBeforeInSystem: false,
      matches: [
        {
          recordId: 'notion-1',
          score: 0.91,
          inquiryDate: '2025-12-10',
        },
      ],
    })

    expect(hint.hasSeenBeforeInSystem).toBe(false)
    expect(hint.notionMatchConfidence).toBe('high')
    expect(hint.matchedNotionRecordIds).toEqual(['notion-1'])
    expect(hint.previousInquiryDate).toBe('2025-12-10')
  })

  it('returns none when no matches are found', () => {
    const hint = buildReturningCustomerHint({
      hasSeenBeforeInSystem: true,
      matches: [],
    })

    expect(hint.hasSeenBeforeInSystem).toBe(true)
    expect(hint.notionMatchConfidence).toBe('none')
    expect(hint.matchedNotionRecordIds).toEqual([])
  })
})
