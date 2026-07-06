/**
 * customer-itinerary-roundtrip.test.ts — parser round-trip 閘（design 2026-06-10
 * §1 格式閘）.
 *
 * The gate feeds a would-be customer_itinerary_v1 draft back through the REAL
 * parsers（parseBasicInfoText + parseItineraryText）. Anything not perfectly
 * clean fails the gate — the caller then degrades fail-closed instead of ever
 * posting text that would break when pasted into the quote tool.
 *
 * Golden 李家 7D6N is the regression baseline: it MUST pass forever.
 */

import { describe, expect, it } from 'vitest'
import { checkCustomerItineraryRoundTrip } from '../notion/customer-itinerary-roundtrip'
import { LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY, withMissingDayHeading } from '../notion/__fixtures__/customer-itinerary-golden'

const GOLDEN = LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY

describe('checkCustomerItineraryRoundTrip — golden baseline', () => {
  it('golden 7D6N round-trips perfectly clean', () => {
    const result = checkCustomerItineraryRoundTrip(GOLDEN, { days: 7 })
    expect(result.problems).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.parsedDays).toBe(7)
  })
})

describe('checkCustomerItineraryRoundTrip — fail-closed on dirty parses', () => {
  it('fails when a Day heading is missing（day count + skip）', () => {
    const result = checkCustomerItineraryRoundTrip(withMissingDayHeading(), { days: 7 })
    expect(result.ok).toBe(false)
    expect(result.problems.length).toBeGreaterThan(0)
  })

  it('fails when the 日期 header line is missing（no parseable date range）', () => {
    const noDateHeader = GOLDEN.replace(/^📅 日期：.*$/m, '')
    const result = checkCustomerItineraryRoundTrip(noDateHeader, { days: 7 })
    expect(result.ok).toBe(false)
    expect(result.problems.join('\n')).toMatch(/日期/)
  })

  it('fails when the 人數 header line is missing', () => {
    const noPartyHeader = GOLDEN.replace(/^👨‍👩‍👧‍👦 人數：.*$/m, '')
    const result = checkCustomerItineraryRoundTrip(noPartyHeader, { days: 7 })
    expect(result.ok).toBe(false)
    expect(result.problems.join('\n')).toMatch(/人數/)
  })

  it('fails on a non-consecutive date（date_skip warning）', () => {
    const dateSkip = GOLDEN.replace('8/6 (四)', '8/8 (四)')
    const result = checkCustomerItineraryRoundTrip(dateSkip, { days: 7 })
    expect(result.ok).toBe(false)
  })

  it('fails when parsed day count does not match the expected day count', () => {
    const result = checkCustomerItineraryRoundTrip(GOLDEN, { days: 8 })
    expect(result.ok).toBe(false)
    expect(result.problems.join('\n')).toMatch(/天數/)
  })

  it('fails on empty text（never throws）', () => {
    const result = checkCustomerItineraryRoundTrip('', { days: 7 })
    expect(result.ok).toBe(false)
  })

  it('cross-checks header date range against parsed day dates', () => {
    // Header says 08/05 起，但 Day 1 是 8/4 → 不一致必擋。
    const mismatch = GOLDEN.replace('日期：2025/08/04～2025/08/10', '日期：2025/08/05～2025/08/10')
    const result = checkCustomerItineraryRoundTrip(mismatch, { days: 7 })
    expect(result.ok).toBe(false)
  })
})
