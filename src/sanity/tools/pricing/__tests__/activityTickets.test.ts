import { describe, expect, it } from 'vitest'

import { buildParsedActivityTickets } from '../activityTickets'
import type { MatchedActivity } from '@/lib/itinerary'

const baseTicket = {
  price: 0,
  rebate: 0,
  split: false,
  checked: false,
  source: 'default' as const,
}

function match(overrides: Partial<MatchedActivity> & Pick<MatchedActivity, 'activityId' | 'activityName'>): MatchedActivity {
  return {
    matchedText: '',
    dayNumber: 1,
    price: 0,
    rebate: 0,
    splitRebate: false,
    confidence: 'high',
    ...overrides,
  }
}

describe('activity ticket builder', () => {
  it('uses exact activity ids so elephant poop does not select elephant camp', () => {
    const tickets = buildParsedActivityTickets(
      [
        match({
          activityId: 'elephantPoop',
          activityName: '大象粑粑造紙公園',
          dayNumber: 3,
          price: 200,
        }),
      ],
      [
        { id: 'elephant-meal', name: '大象保護營（含餐）', exclusiveGroup: 'elephant', ...baseTicket },
        { id: 'elephant', name: '大象保護營（不含餐）', exclusiveGroup: 'elephant', ...baseTicket },
        { id: 'elephantPoop', name: '大象粑粑造紙公園', price: 200, ...baseTicket },
      ]
    )

    expect(tickets).toEqual([
      expect.objectContaining({
        id: 'elephantPoop',
        name: '大象粑粑造紙公園',
        checked: true,
        dayNumber: 3,
      }),
    ])
  })

  it('deduplicates same-name non-exclusive tickets on the same day', () => {
    const tickets = buildParsedActivityTickets(
      [
        match({
          activityId: 'customDoiInthanon',
          activityName: '茵他儂國家公園門票',
          dayNumber: 1,
          price: 300,
        }),
        match({
          activityId: 'doiInthanon',
          activityName: '茵他儂國家公園門票',
          dayNumber: 1,
          price: 300,
        }),
        match({
          activityId: 'twoChedis',
          activityName: '國王皇后雙塔',
          dayNumber: 1,
          price: 100,
        }),
      ],
      [
        { id: 'customDoiInthanon', name: '茵他儂國家公園門票', price: 300, ...baseTicket },
        { id: 'doiInthanon', name: '茵他儂國家公園門票', price: 300, ...baseTicket },
        { id: 'twoChedis', name: '國王皇后雙塔', price: 100, ...baseTicket },
      ]
    )

    expect(tickets.map((ticket) => ticket.name)).toEqual([
      '茵他儂國家公園門票',
      '國王皇后雙塔',
    ])
  })

  it('deduplicates generic ticket suffix variants and keeps the child-price template', () => {
    const tickets = buildParsedActivityTickets(
      [
        match({
          activityId: 'customDoiInthanon',
          activityName: '茵他儂國家公園',
          dayNumber: 1,
          price: 300,
        }),
        match({
          activityId: 'doiInthanon',
          activityName: '茵他儂國家公園門票',
          dayNumber: 1,
          price: 300,
        }),
        match({
          activityId: 'twoChedis',
          activityName: '國王皇后雙塔',
          dayNumber: 1,
          price: 100,
        }),
      ],
      [
        { id: 'customDoiInthanon', name: '茵他儂國家公園', price: 300, ...baseTicket },
        { id: 'doiInthanon', name: '茵他儂國家公園門票', price: 300, childPrice: 150, ...baseTicket },
        { id: 'twoChedis', name: '國王皇后雙塔', price: 100, ...baseTicket },
      ]
    )

    expect(tickets).toEqual([
      expect.objectContaining({
        id: 'doiInthanon',
        name: '茵他儂國家公園門票',
        childPrice: 150,
      }),
      expect.objectContaining({
        id: 'twoChedis',
        name: '國王皇后雙塔',
      }),
    ])
  })

  it('allows train upper and lower bunk tickets to be selected together with parsed counts', () => {
    const matchedText = '火車票代訂：先以「二等臥鋪冷氣」估算，建議配置為 5 個下舖 + 5 個上舖，共 10 個床位。'
    const tickets = buildParsedActivityTickets(
      [
        match({
          activityId: 'trainSecondLower',
          activityName: '代訂｜曼谷－清邁夜火車 二等臥鋪冷氣 下鋪',
          matchedText,
          price: 1041,
          exclusiveGroup: 'bangkokChiangMaiTrain',
        }),
        match({
          activityId: 'trainSecondUpper',
          activityName: '代訂｜曼谷－清邁夜火車 二等臥鋪冷氣 上鋪',
          matchedText,
          price: 941,
          exclusiveGroup: 'bangkokChiangMaiTrain',
        }),
      ],
      [
        { id: 'trainSecondLower', name: '代訂｜曼谷－清邁夜火車 二等臥鋪冷氣 下鋪', price: 1041, exclusiveGroup: 'bangkokChiangMaiTrain', ...baseTicket },
        { id: 'trainSecondUpper', name: '代訂｜曼谷－清邁夜火車 二等臥鋪冷氣 上鋪', price: 941, exclusiveGroup: 'bangkokChiangMaiTrain', ...baseTicket },
      ]
    )

    expect(tickets).toEqual([
      expect.objectContaining({
        id: 'trainSecondLower',
        checked: true,
        adultCount: 5,
        childCount: 0,
      }),
      expect.objectContaining({
        id: 'trainSecondUpper',
        checked: true,
        adultCount: 5,
        childCount: 0,
      }),
    ])
  })
})
