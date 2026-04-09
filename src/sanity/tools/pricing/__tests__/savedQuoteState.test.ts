import { describe, expect, it } from 'vitest'

import {
  getNextHotelIdFromSavedHotels,
  resolveSavedParseState,
} from '@/sanity/tools/pricing/savedQuoteState'

describe('saved quote parse state', () => {
  it('restores saved parser snapshot for reloading a shared example', () => {
    const restored = resolveSavedParseState({
      itineraryText: 'D1 古城\nD2 大象營',
      parsedItinerary: [
        {
          day: 'DAY 1',
          title: '清邁古城',
          items: ['塔佩門', '古城散步'],
          hotel: '香格里拉酒店',
        },
      ],
      parseResult: {
        matched: [
          {
            activityId: 'ticket-1',
            activityName: '大象營',
            matchedText: '大象營',
            dayNumber: 2,
            price: 2500,
            rebate: 0,
            splitRebate: false,
            confidence: 'high',
          },
        ],
        unmatched: [
          {
            text: '秘密咖啡店',
            dayNumber: 1,
            suggestedKeywords: ['秘密', '咖啡店'],
          },
        ],
        dates: [
          {
            dayNumber: 1,
            date: '2026-04-01',
            dayLabel: 'D1',
          },
        ],
        hotels: [
          {
            name: '香格里拉酒店',
            dayNumber: 1,
          },
        ],
      },
      parseWarnings: [{ type: 'date', message: '第一天缺少日期，已推估。' }],
      isParseConfirmed: true,
      thaiDressDay: 2,
      useDefaultTickets: true,
      tickets: [{ id: 1, name: '預設票券' }],
      savedParsedTickets: [{ id: 2, name: '解析票券' }],
    })

    expect(restored).toEqual({
      parsedItinerary: [
        {
          day: 'DAY 1',
          title: '清邁古城',
          items: ['塔佩門', '古城散步'],
          hotel: '香格里拉酒店',
        },
      ],
      parseResult: {
        matched: [
          {
            activityId: 'ticket-1',
            activityName: '大象營',
            matchedText: '大象營',
            dayNumber: 2,
            price: 2500,
            rebate: 0,
            splitRebate: false,
            confidence: 'high',
          },
        ],
        unmatched: [
          {
            text: '秘密咖啡店',
            dayNumber: 1,
            suggestedKeywords: ['秘密', '咖啡店'],
          },
        ],
        dates: [
          {
            dayNumber: 1,
            date: '2026-04-01',
            dayLabel: 'D1',
          },
        ],
        hotels: [
          {
            name: '香格里拉酒店',
            dayNumber: 1,
          },
        ],
      },
      parseWarnings: [{ type: 'date', message: '第一天缺少日期，已推估。' }],
      isParseConfirmed: true,
      shouldShowParser: true,
      savedParsedTickets: [{ id: 2, name: '解析票券' }],
      thaiDressDay: 2,
    })
  })

  it('falls back to current tickets for legacy parsed quotes and clears empty parser snapshots', () => {
    const restored = resolveSavedParseState({
      itineraryText: '',
      useDefaultTickets: false,
      tickets: [{ id: 3, name: '舊解析票券' }],
    })

    expect(restored).toEqual({
      parsedItinerary: [],
      parseResult: null,
      parseWarnings: [],
      isParseConfirmed: false,
      shouldShowParser: false,
      savedParsedTickets: [{ id: 3, name: '舊解析票券' }],
      thaiDressDay: null,
    })
  })

  it('derives the next hotel id from restored hotels', () => {
    expect(
      getNextHotelIdFromSavedHotels([
        { id: 2 },
        { id: 5 },
        { id: 9 },
      ])
    ).toBe(10)

    expect(getNextHotelIdFromSavedHotels([])).toBe(1)
  })
})
