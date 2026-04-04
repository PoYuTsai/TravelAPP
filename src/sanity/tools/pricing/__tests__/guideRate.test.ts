import { describe, expect, it } from 'vitest'

import { normalizeGuidePerDayRate } from '@/sanity/tools/pricing/guideRate'

describe('pricing guide rate helpers', () => {
  it('falls back to defaults when saved guide rates are missing or invalid', () => {
    expect(
      normalizeGuidePerDayRate(undefined, { cost: 1500, price: 2500 })
    ).toEqual({ cost: 1500, price: 2500 })

    expect(
      normalizeGuidePerDayRate(
        { cost: Number.NaN, price: undefined },
        { cost: 1500, price: 2500 }
      )
    ).toEqual({ cost: 1500, price: 2500 })
  })

  it('keeps explicit guide rates and clamps negatives to zero', () => {
    expect(
      normalizeGuidePerDayRate(
        { cost: 2200, price: 3200 },
        { cost: 1500, price: 2500 }
      )
    ).toEqual({ cost: 2200, price: 3200 })

    expect(
      normalizeGuidePerDayRate(
        { cost: -300, price: -100 },
        { cost: 1500, price: 2500 }
      )
    ).toEqual({ cost: 0, price: 0 })
  })
})
