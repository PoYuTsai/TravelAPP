import { describe, expect, it } from 'vitest'
import { matchReturningCustomer } from '@/lib/line-assistant/notion/match-returning-customer'
import type { NotionOrder } from '@/lib/notion/types'

const orders: NotionOrder[] = [
  {
    id: 'notion-1',
    customerName: '王先生',
    travelDate: {
      start: '2025-12-10',
      end: null,
    },
    travelers: '2大2小',
    profit: { raw: '1000', value: 1000, confident: true },
    revenue: { raw: '5000', value: 5000, confident: true },
    paymentStatus: '已付款',
    updateStatus: '已完成',
  },
]

describe('matchReturningCustomer', () => {
  it('returns a high-confidence notion hint without replacing the system identity', async () => {
    const hint = await matchReturningCustomer(
      {
        customerName: '王先生',
        rawMessage: '你好，我們 4/12-16 2大2小想問清邁包車',
        travelDates: '4/12-16',
      },
      {
        hasSeenBeforeInSystem: false,
        fetchOrders: async () => orders,
      }
    )

    expect(hint.hasSeenBeforeInSystem).toBe(false)
    expect(hint.notionMatchConfidence).toBe('high')
    expect(hint.matchedNotionRecordIds).toEqual(['notion-1'])
    expect(hint.previousInquiryDate).toBe('2025-12-10')
  })

  it('returns none when no matching notion orders are found', async () => {
    const hint = await matchReturningCustomer(
      {
        customerName: '李小姐',
        rawMessage: '想問 5 月清邁包車',
        travelDates: null,
      },
      {
        hasSeenBeforeInSystem: true,
        fetchOrders: async () => orders,
      }
    )

    expect(hint.hasSeenBeforeInSystem).toBe(true)
    expect(hint.notionMatchConfidence).toBe('none')
    expect(hint.matchedNotionRecordIds).toEqual([])
  })
})
