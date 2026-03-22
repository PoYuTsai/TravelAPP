import { describe, expect, it } from 'vitest'
import { extractInquiryFromMessage } from '@/lib/line-assistant/ai/extract-inquiry'

describe('extractInquiryFromMessage', () => {
  it('extracts dates, party size, attractions, and special needs from a customer message', () => {
    const inquiry = extractInquiryFromMessage({
      lineUserId: 'line-user-1',
      customerName: '王先生',
      rawMessage:
        '你好，我們 4/12-16 2大2小想去大象營跟夜間動物園，需要2張汽座，想問包車安排',
      sourceEventId: 'evt-1',
      timestamp: '2026-03-22T00:00:00.000Z',
    })

    expect(inquiry.travelDates).toBe('4/12-16')
    expect(inquiry.adults).toBe(2)
    expect(inquiry.children).toBe(2)
    expect(inquiry.attractions).toEqual(['大象營', '夜間動物園'])
    expect(inquiry.specialNeeds).toEqual(['2張汽座'])
  })
})
