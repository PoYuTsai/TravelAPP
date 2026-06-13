import { describe, it, expect } from 'vitest'
import { gateCustomerItineraryDraft } from '../notion/customer-itinerary-gate'
import { LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY } from '../notion/__fixtures__/customer-itinerary-golden'

describe('gateCustomerItineraryDraft', () => {
  it('golden 李家 7D6N → ok', () => {
    const r = gateCustomerItineraryDraft(LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY)
    expect(r.ok).toBe(true)
    expect(r.problems).toEqual([])
  })

  it('自由 markdown 散文 → fail（推不出 Day 或 parser 不乾淨）', () => {
    const prose = '幫你排個 5 天行程：\n第一天去古城逛逛，第二天上山看大象，很棒喔！'
    const r = gateCustomerItineraryDraft(prose)
    expect(r.ok).toBe(false)
    expect(r.problems.length).toBeGreaterThan(0)
  })

  it('缺一天（Day 3 不見）→ fail', () => {
    const broken = LI_FAMILY_ELDERLY_CHIANGMAI_GOLDEN_ITINERARY.replace(/Day 3｜[^\n]*/, '')
    const r = gateCustomerItineraryDraft(broken)
    expect(r.ok).toBe(false)
  })
})
