import { describe, expect, it } from 'vitest'

import {
  clampGuideServiceDays,
  getChildSeatChargeDays,
} from '@/sanity/tools/pricing/serviceDays'

describe('pricing service day helpers', () => {
  it('clamps guide days to the available trip days', () => {
    expect(clampGuideServiceDays(5, 4, 5)).toBe(4)
    expect(clampGuideServiceDays(2, 5, 5)).toBe(2)
  })

  it('falls back to a valid default when guide days are missing', () => {
    expect(clampGuideServiceDays(undefined, 3, 5)).toBe(3)
    expect(clampGuideServiceDays(Number.NaN, 6, 5)).toBe(5)
    expect(clampGuideServiceDays(undefined, 0, 5)).toBe(0)
  })

  it('keeps child seat billing tied to car days', () => {
    expect(getChildSeatChargeDays(5)).toBe(5)
    expect(getChildSeatChargeDays(0)).toBe(0)
  })
})
