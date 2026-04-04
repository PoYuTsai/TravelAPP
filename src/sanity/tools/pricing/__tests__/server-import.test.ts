import { describe, expect, it } from 'vitest'

describe('pricing tools server imports', () => {
  it('imports pricing tools without requiring browser globals', async () => {
    const pricingModule = await import('@/sanity/tools/pricing')

    expect(pricingModule.pricingTool).toBeDefined()
    expect(pricingModule.formalPricingTool).toBeDefined()
  }, 20000)
})
