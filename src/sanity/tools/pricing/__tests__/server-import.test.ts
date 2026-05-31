import { describe, expect, it } from 'vitest'

describe('pricing tools server imports', () => {
  it('imports pricing tools without requiring browser globals', async () => {
    const pricingModule = await import('@/sanity/tools/pricing')

    expect(pricingModule.pricingTool).toBeDefined()
    expect(pricingModule.formalPricingTool).toBeDefined()
    // Importing the barrel eagerly transforms the full Sanity + PricingCalculator
    // tree. On native CI this is seconds; on a WSL /mnt/c mount it can take ~90s.
    // Generous timeout accommodates the slow-FS case without skipping the guard.
  }, 120000)
})
