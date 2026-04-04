import { describe, expect, it } from 'vitest'

import {
  getInsuranceCost,
  resolveSavedInsuranceSelection,
} from '@/sanity/tools/pricing/insurance'

describe('pricing insurance helpers', () => {
  it('only charges insurance when the manual toggle is on', () => {
    expect(getInsuranceCost({ includeInsurance: true, people: 6, insurancePerPerson: 100 })).toBe(600)
    expect(getInsuranceCost({ includeInsurance: false, people: 6, insurancePerPerson: 100 })).toBe(0)
  })

  it('preserves explicit saved insurance choices', () => {
    expect(
      resolveSavedInsuranceSelection({
        savedIncludeInsurance: true,
        includeAccommodation: false,
        includeMeals: false,
        hasSelectedTickets: false,
      })
    ).toBe(true)

    expect(
      resolveSavedInsuranceSelection({
        savedIncludeInsurance: false,
        includeAccommodation: true,
        includeMeals: true,
        hasSelectedTickets: true,
      })
    ).toBe(false)
  })

  it('falls back to the old auto-insurance rule for legacy saved quotes', () => {
    expect(
      resolveSavedInsuranceSelection({
        savedIncludeInsurance: undefined,
        includeAccommodation: true,
        includeMeals: false,
        hasSelectedTickets: false,
      })
    ).toBe(true)

    expect(
      resolveSavedInsuranceSelection({
        savedIncludeInsurance: undefined,
        includeAccommodation: false,
        includeMeals: false,
        hasSelectedTickets: false,
      })
    ).toBe(false)
  })
})
