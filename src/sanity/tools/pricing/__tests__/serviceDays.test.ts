import { describe, expect, it } from 'vitest'

import {
  clampChildSeatServiceDays,
  clampGuideServiceDays,
  clampMealServiceDays,
} from '@/sanity/tools/pricing/serviceDays'

describe('pricing service day helpers', () => {
  it('clamps guide days to the available trip days', () => {
    expect(clampGuideServiceDays(5, 4, 5)).toBe(4)
    expect(clampGuideServiceDays(2, 5, 5)).toBe(2)
  })

  it('falls back to a valid default when guide days are missing', () => {
    expect(clampGuideServiceDays(undefined, 3, 5)).toBe(3)
    expect(clampGuideServiceDays(Number.NaN, 6, 5)).toBe(5)
    expect(clampGuideServiceDays(0, 6, 5)).toBe(5)
    expect(clampGuideServiceDays(undefined, 0, 5)).toBe(0)
  })

  it('lets meal days be adjusted while staying within the trip length', () => {
    expect(clampMealServiceDays(undefined, 6, 5)).toBe(5)
    expect(clampMealServiceDays(3, 6, 5)).toBe(3)
    expect(clampMealServiceDays(8, 6, 5)).toBe(6)
    expect(clampMealServiceDays(undefined, 0, 5)).toBe(0)
  })

  it('lets child seat billing use custom days with a full-trip fallback', () => {
    expect(clampChildSeatServiceDays(undefined, 5, 5)).toBe(5)
    expect(clampChildSeatServiceDays(2, 5, 5)).toBe(2)
    expect(clampChildSeatServiceDays(9, 5, 5)).toBe(5)
    expect(clampChildSeatServiceDays(undefined, 0, 5)).toBe(0)
  })
})
