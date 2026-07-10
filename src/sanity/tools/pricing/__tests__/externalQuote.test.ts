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
      childSeatDays: 2,
      totalChildSeatCount: 1,
      selectedTicketCount: 2,
      hasThaiDress: true,
      travelerCount: 8,
    })

    expect(breakdown.items.map((item) => item.label)).toEqual([
      '包車費用',
      '中文導遊',
      '行李加大車',
      '兒童安全座椅',
      '住宿',
      '票券 / 活動 / 代訂',
      '旅遊保險',
    ])
    expect(
      breakdown.items.find((item) => item.label === '票券 / 活動 / 代訂')?.description
    ).toBe('2 項票券 / 活動 / 代訂 + 泰服體驗')
    expect(
      breakdown.items.find((item) => item.label === '兒童安全座椅')?.description
    ).toBe('1 張 / 2 天')
    expect(
      breakdown.items.find((item) => item.label === '行李加大車')?.description
    ).toBe('行李車放置行李')
    expect(
      breakdown.items.find((item) => item.label === '旅遊保險')?.description
    ).toBe('共 8 位旅客')
    expect(breakdown.included).toContain('中文導遊')
    expect(breakdown.excluded).toContain('餐食')
    expect(breakdown.excluded).not.toContain('旅遊保險')
    expect(breakdown.paymentNotes.join(' ')).toContain('票券、活動或代訂')
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
      childSeatDays: 0,
      totalChildSeatCount: 0,
      selectedTicketCount: 0,
      hasThaiDress: false,
    })

    expect(breakdown.totalTHB).toBe(9301)
    expect(breakdown.totalTWD).toBe(Math.round(9301 / 0.93))
    expect(breakdown.items.map((item) => item.label)).toEqual(['包車費用'])
    expect(breakdown.paymentNotes.join(' ')).not.toContain('30%')
    expect(breakdown.paymentNotes.join(' ')).not.toContain('70%')
  })

  it('perPerson 模式：items 改售價結構（大人/兒童/接送機），不出現成本拆項', () => {
    const breakdown = buildExternalQuoteBreakdown({
      pricingModel: 'perPerson',
      perPersonItems: [
        { label: '大人', quantity: 6, unitPriceThb: 7750, subtotalThb: 46500 },
        { label: '兒童（3-11歲）', quantity: 2, unitPriceThb: 6200, subtotalThb: 12400 },
      ],
      transferFee: 1400,
      transferTrips: 1,
      includeAccommodation: false,
      includeMeals: false,
      includeGuide: true,
      includeInsurance: true,
      accommodationCost: 0,
      mealCost: 0,
      carPriceTotal: 60300,
      guidePrice: 0,
      luggageCost: 0,
      childSeatCost: 2500,
      ticketPrice: 0,
      thaiDressPrice: 0,
      insuranceCost: 800,
      totalPrice: 63600,
      exchangeRate: 1.1,
      totalNights: 0,
      mealDays: 0,
      guideDays: 5,
      carServiceDays: 6,
      carCount: 1,
      childSeatDays: 5,
      totalChildSeatCount: 1,
      selectedTicketCount: 0,
      hasThaiDress: false,
      travelerCount: 8,
    })

    const labels = breakdown.items.map((item) => item.label)
    expect(labels).toEqual(['大人', '兒童（3-11歲）', '接送機', '兒童安全座椅', '旅遊保險'])
    expect(labels).not.toContain('包車費用')
    expect(labels).not.toContain('中文導遊')
    expect(labels).not.toContain('行李加大車')

    const adult = breakdown.items.find((item) => item.label === '大人')
    expect(adult?.amountTHB).toBe(46500)
    expect(adult?.amountTWD).toBe(Math.round(46500 / 1.1))
    expect(adult?.description).toBe('6 位 × 7,750')
    expect(
      breakdown.items.find((item) => item.label === '接送機')?.description
    ).toBe('1 趟（按車計）')

    // included 是服務清單而不是計價人頭（對齊黃表：含超時費）
    expect(breakdown.included).toContain('中文導遊')
    expect(breakdown.included).toContain('車資、油費、過路費、停車費')
    expect(breakdown.included).toContain('超時費')
    expect(breakdown.included).not.toContain('大人')
    expect(breakdown.excluded).not.toContain('中文導遊')
    expect(breakdown.totalTHB).toBe(63600)
  })

  it('perPerson 模式：不含導遊時 included 無導遊、excluded 有導遊', () => {
    const breakdown = buildExternalQuoteBreakdown({
      pricingModel: 'perPerson',
      perPersonItems: [
        { label: '大人', quantity: 4, unitPriceThb: 6000, subtotalThb: 24000 },
      ],
      transferFee: 0,
      transferTrips: 0,
      includeAccommodation: false,
      includeMeals: false,
      includeGuide: false,
      includeInsurance: false,
      accommodationCost: 0,
      mealCost: 0,
      carPriceTotal: 24000,
      guidePrice: 0,
      luggageCost: 0,
      childSeatCost: 0,
      ticketPrice: 0,
      thaiDressPrice: 0,
      insuranceCost: 0,
      totalPrice: 24000,
      exchangeRate: 1.1,
      totalNights: 0,
      mealDays: 0,
      guideDays: 0,
      carServiceDays: 4,
      carCount: 1,
      childSeatDays: 0,
      totalChildSeatCount: 0,
      selectedTicketCount: 0,
      hasThaiDress: false,
    })

    expect(breakdown.items.map((item) => item.label)).toEqual(['大人'])
    expect(breakdown.included).not.toContain('中文導遊')
    expect(breakdown.excluded).toContain('中文導遊')
  })

  it('keeps self-booked accommodation nights out of the included accommodation total', () => {
    const breakdown = buildExternalQuoteBreakdown({
      includeAccommodation: true,
      includeMeals: false,
      includeGuide: false,
      includeInsurance: false,
      accommodationCost: 2500,
      mealCost: 0,
      carPriceTotal: 10000,
      guidePrice: 0,
      luggageCost: 0,
      childSeatCost: 0,
      ticketPrice: 0,
      thaiDressPrice: 0,
      insuranceCost: 0,
      totalPrice: 12500,
      exchangeRate: 0.93,
      totalNights: 1,
      accommodationRoomCount: 5,
      selfBookedAccommodationNights: 2,
      mealDays: 0,
      guideDays: 0,
      carServiceDays: 3,
      carCount: 1,
      childSeatDays: 0,
      totalChildSeatCount: 0,
      selectedTicketCount: 0,
      hasThaiDress: false,
    })

    const accommodationItem = breakdown.items.find((item) => item.amountTHB === 2500)
    expect(accommodationItem?.description).toBe('1 晚住宿，共 5 間房')
    expect(breakdown.excluded.some((item) => item.includes('自理'))).toBe(true)
  })
})
