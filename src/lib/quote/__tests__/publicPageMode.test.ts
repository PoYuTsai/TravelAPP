import { describe, expect, it } from 'vitest'

import {
  formatPackageEstimateBasis,
  resolveQuotePublicPageMode,
} from '@/lib/quote/publicPageMode'

describe('quote public page mode', () => {
  it('defaults legacy and unknown saved values to the formal quote mode', () => {
    expect(resolveQuotePublicPageMode(undefined)).toBe('quote')
    expect(resolveQuotePublicPageMode(null)).toBe('quote')
    expect(resolveQuotePublicPageMode('wrong')).toBe('quote')
  })

  it('preserves the package showcase mode when explicitly saved', () => {
    expect(resolveQuotePublicPageMode('package')).toBe('package')
  })

  it('formats a concise estimate basis for package showcase pages', () => {
    expect(
      formatPackageEstimateBasis({
        adults: 7,
        children: 3,
        tripDays: 5,
        tripNights: 4,
        carCount: 2,
      })
    ).toBe('以 7 大 3 小 / 2 台車 / 5 天 4 夜估算')
  })

  it('uses the saved traveler label when available', () => {
    expect(
      formatPackageEstimateBasis({
        adults: 7,
        children: 3,
        tripDays: 5,
        tripNights: 4,
        carCount: 2,
        travelerLabel: '7大3小',
      })
    ).toBe('以 7大3小 / 2 台車 / 5 天 4 夜估算')
  })
})
