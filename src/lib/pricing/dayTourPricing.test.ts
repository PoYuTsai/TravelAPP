import { describe, expect, it } from 'vitest'
import {
  DAY_TOUR_ROUTE_TIER_PROPOSALS,
  getDayTourPricingTierLabel,
  isDayTourPricingTier,
  normalizeDayTourPricingTier,
  proposeDayTourPricingTier,
  type DayTourPricingTier,
} from './dayTourPricing'

describe('day-tour runtime pricing tier normalization', () => {
  it.each([
    ['T1', 'T1 市區'],
    ['T2', 'T2 近郊'],
    ['T3', 'T3 清萊'],
    ['T4', 'T4 金三角'],
  ] satisfies Array<[DayTourPricingTier, string]>)('keeps %s and returns its label', (tier, label) => {
    expect(isDayTourPricingTier(tier)).toBe(true)
    expect(normalizeDayTourPricingTier(tier)).toBe(tier)
    expect(getDayTourPricingTierLabel(tier)).toBe(label)
  })

  it.each([
    ['missing', undefined],
    ['unknown tier', 'T9'],
    ['prototype key', '__proto__'],
  ])('falls back safely for %s', (_label, value) => {
    expect(isDayTourPricingTier(value)).toBe(false)
    expect(normalizeDayTourPricingTier(value)).toBe('T1')
    expect(getDayTourPricingTierLabel(value)).toBe('T1 市區')
  })
})

describe('day-tour pricing tier proposals', () => {
  it.each([
    ['泰服親子體驗', 'thai-dress-family', 'T1'],
    ['大象保護營一日遊', 'elephant-sanctuary', 'T2'],
    ['茵他儂一日遊', 'doi-inthanon-day-tour', 'T2'],
    ['南邦一日遊', 'lampang-day-tour', 'T2'],
    ['南奔一日遊', 'lamphun-day-tour', 'T2'],
    ['清萊一日遊', 'chiang-rai-day-tour', 'T3'],
  ] satisfies Array<[string, string, DayTourPricingTier]>) (
    'maps %s (%s) to %s',
    (title, slug, expectedTier) => {
      expect(proposeDayTourPricingTier({ title, slug })).toMatchObject({
        status: 'proposed',
        proposedTier: expectedTier,
      })
    }
  )

  it('keeps exactly the six approved route proposals', () => {
    expect(DAY_TOUR_ROUTE_TIER_PROPOSALS.map(({ label, tier }) => [label, tier])).toEqual([
      ['泰服', 'T1'],
      ['大象', 'T2'],
      ['茵他儂', 'T2'],
      ['南邦', 'T2'],
      ['南奔', 'T2'],
      ['清萊', 'T3'],
    ])
  })

  it.each([
    { title: '素帖山一日遊', slug: 'doi-suthep' },
    { title: '清萊大象探索', slug: 'chiang-rai-elephant' },
    { title: null, slug: null },
  ])('marks unknown or ambiguous identity for manual review: $slug', (identity) => {
    expect(proposeDayTourPricingTier(identity)).toEqual({
      status: 'manual',
      route: null,
      proposedTier: null,
    })
  })
})
