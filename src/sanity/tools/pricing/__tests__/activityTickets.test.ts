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
})
