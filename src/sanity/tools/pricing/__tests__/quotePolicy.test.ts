import { describe, expect, it } from 'vitest'
import {
  getGuideControlPolicy,
  getLockedGuideServiceDays,
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

  it('blocks guided sedan quotes with a clear vehicle-confirmation reason', () => {
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
})

describe('getGuideControlPolicy', () => {
  it.each([4, 8, 9, 10, 18])('keeps guide optional for %i guests', (occupiedSeats) => {
    const policy = getGuideControlPolicy(occupiedSeats)

    expect(policy.disabled).toBe(false)
    expect(policy.note).toBeNull()
  })

  it.each([2, 3])('keeps guide selectable for %i guests and explains manual vehicle confirmation', (occupiedSeats) => {
    const policy = getGuideControlPolicy(occupiedSeats)

    expect(policy.disabled).toBe(false)
    expect(policy.note).toMatch(/加導遊需確認車型/)
  })
})

describe('getLockedGuideServiceDays', () => {
  it('locks guide service to every car service day when selected', () => {
    expect(getLockedGuideServiceDays(true, 6)).toBe(6)
    expect(getLockedGuideServiceDays(false, 6)).toBe(0)
  })
})
