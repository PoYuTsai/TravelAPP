import { describe, expect, it } from 'vitest'
import {
  countGuideServiceDays,
  getCharterOvertimePolicyCopy,
  getGuideControlPolicy,
  getLockedGuideServiceDays,
  resolveGuideService,
  resolveCustomerQuoteGate,
} from '../quotePolicy'

describe('resolveCustomerQuoteGate', () => {
  it('allows automatic protected fares, including two-Van quotes', () => {
    expect(
      resolveCustomerQuoteGate({
        manualQuoteRequired: false,
        manualQuoteReason: null,
      }),
    ).toEqual({ blocked: false, message: null })
  })

  it('still blocks a serialized legacy guided-sedan manual state', () => {
    const gate = resolveCustomerQuoteGate({
      manualQuoteRequired: true,
      manualQuoteReason: 'guided-sedan-requires-vehicle-confirmation',
    })

    expect(gate.blocked).toBe(true)
    expect(gate.message).toMatch(/2.?3 人.*導遊.*車型.*人工確認/)
  })

  it('blocks 19+ quotes with a clear group-size reason', () => {
    const gate = resolveCustomerQuoteGate({
      manualQuoteRequired: true,
      manualQuoteReason: 'group-size-requires-manual-quote',
    })

    expect(gate.blocked).toBe(true)
    expect(gate.message).toMatch(/19 人以上.*人工報價/)
  })

  it('blocks a single-traveler quote with a clear minimum-size reason', () => {
    const gate = resolveCustomerQuoteGate({
      manualQuoteRequired: true,
      manualQuoteReason: 'minimum-group-size-required',
    })

    expect(gate.blocked).toBe(true)
    expect(gate.message).toMatch(/至少 2 位旅客.*自動報價.*人工確認/)
  })
})

describe('getGuideControlPolicy', () => {
  it.each([2, 3, 4, 8, 9, 10, 18])('keeps guide optional for %i guests without a manual vehicle note', (occupiedSeats) => {
    const policy = getGuideControlPolicy(occupiedSeats)

    expect(policy.disabled).toBe(false)
    expect(policy.note).toBeNull()
  })
})

describe('getLockedGuideServiceDays', () => {
  const mixedDays = [
    { type: 'city' },
    { type: 'suburban' },
    { type: 'chiangrai' },
    { type: 'suburban' },
    { type: 'goldentriangle' },
    { type: 'airport' },
  ]

  it('counts only non-transfer itinerary day types', () => {
    expect(countGuideServiceDays(mixedDays)).toBe(5)
  })

  it('locks guide service to non-transfer itinerary days when selected', () => {
    expect(getLockedGuideServiceDays(true, mixedDays)).toBe(5)
    expect(getLockedGuideServiceDays(false, mixedDays)).toBe(0)
  })

  it('separates a saved guide selection from actual service on transfer-only days', () => {
    const transferOnly = [{ type: 'airport' }, { type: 'airport' }]

    expect(resolveGuideService(true, transferOnly)).toEqual({
      days: 0,
      active: false,
    })
    expect(resolveGuideService(true, mixedDays)).toEqual({
      days: 5,
      active: true,
    })
    expect(resolveGuideService(false, mixedDays)).toEqual({
      days: 0,
      active: false,
    })
  })
})

describe('getCharterOvertimePolicyCopy', () => {
  it('keeps customer and internal quote outputs on the full overtime policy', () => {
    expect(getCharterOvertimePolicyCopy(2)).toEqual({
      serviceHours: '清邁行程：每日 10 小時；清萊／金三角行程：每日 12 小時',
      grace: '基本用車時間用完後，另有 30 分鐘彈性',
      fee: '超過後按 THB 300／小時／台計收（2 台車按台計）；中文導遊不另收超時費',
      excludedLabel: '超時費（30 分鐘彈性後，THB 300／小時／台；中文導遊不另收）',
    })
  })
})
