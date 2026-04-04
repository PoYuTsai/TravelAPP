import { describe, expect, it } from 'vitest'

import { buildExternalQuoteBreakdown } from '@/sanity/tools/pricing/externalQuote'

describe('pricing external quote breakdown', () => {
  it('maps enabled inputs directly to external quote items', () => {
    const breakdown = buildExternalQuoteBreakdown({
      includeAccommodation: true,
      includeMeals: false,
      includeGuide: true,
      includeInsurance: true,
      accommodationCost: 12000,
      mealCost: 0,
      carPriceTotal: 15000,
      guidePrice: 5000,
      luggageCost: 600,
      childSeatCost: 1000,
      ticketPrice: 3000,
      thaiDressPrice: 2500,
      insuranceCost: 400,
      totalPrice: 39500,
      exchangeRate: 0.93,
      totalNights: 4,
      mealDays: 0,
      guideDays: 2,
      carServiceDays: 5,
      carCount: 1,
      selectedTicketCount: 2,
      hasThaiDress: true,
    })

    expect(breakdown.items.map((item) => item.label)).toEqual([
      '包車費用',
      '中文導遊',
      '行李加大車',
      '兒童安全座椅',
      '住宿',
      '門票活動',
      '旅遊保險',
    ])
    expect(breakdown.items.find((item) => item.label === '門票活動')?.description).toBe(
      '2 項門票活動 + 泰服體驗'
    )
    expect(breakdown.included).toContain('中文導遊')
    expect(breakdown.excluded).toContain('餐食')
    expect(breakdown.excluded).not.toContain('旅遊保險')
  })

  it('uses the real total price for TWD summary and removes auto split-payment percentages', () => {
    const breakdown = buildExternalQuoteBreakdown({
      includeAccommodation: false,
      includeMeals: false,
      includeGuide: false,
      includeInsurance: false,
      accommodationCost: 0,
      mealCost: 0,
      carPriceTotal: 9301,
      guidePrice: 0,
      luggageCost: 0,
      childSeatCost: 0,
      ticketPrice: 0,
      thaiDressPrice: 0,
      insuranceCost: 0,
      totalPrice: 9301,
      exchangeRate: 0.93,
      totalNights: 0,
      mealDays: 0,
      guideDays: 0,
      carServiceDays: 3,
      carCount: 1,
      selectedTicketCount: 0,
      hasThaiDress: false,
    })

    expect(breakdown.totalTHB).toBe(9301)
    expect(breakdown.totalTWD).toBe(Math.round(9301 / 0.93))
    expect(breakdown.items.map((item) => item.label)).toEqual(['包車費用'])
    expect(breakdown.paymentNotes.join(' ')).not.toContain('30%')
    expect(breakdown.paymentNotes.join(' ')).not.toContain('70%')
  })
})
