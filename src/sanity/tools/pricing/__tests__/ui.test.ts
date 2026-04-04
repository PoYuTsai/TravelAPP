import { describe, expect, it } from 'vitest'

import { getPricingResponsiveLayout } from '@/sanity/tools/pricing/ui'

describe('pricing responsive layout', () => {
  it('uses compact layout rules on phone-sized viewports', () => {
    expect(getPricingResponsiveLayout(375)).toMatchObject({
      isCompact: true,
      containerPadding: 12,
      sectionPadding: 14,
      carFeeGridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      internalTableMinWidth: 560,
      serviceToggleGridColumns: 'repeat(2, minmax(0, 1fr))',
      savedQuoteCardDirection: 'column',
    })
  })

  it('keeps desktop layout rules on wider viewports', () => {
    expect(getPricingResponsiveLayout(1024)).toMatchObject({
      isCompact: false,
      containerPadding: 20,
      sectionPadding: 20,
      carFeeGridTemplateColumns: '50px 60px minmax(180px, 1fr) 80px 80px 30px',
      internalTableMinWidth: 0,
      serviceToggleGridColumns: 'repeat(4, max-content)',
      savedQuoteCardDirection: 'row',
    })
  })
})
