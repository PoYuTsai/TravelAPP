import { describe, expect, it } from 'vitest'

import {
  calculateFormalProfitShares,
  getPricingVariantUi,
  normalizePricingConfigForVariant,
  normalizeTicketsForVariant,
} from '@/sanity/tools/pricing/variants'

describe('pricing variants', () => {
  it('keeps legacy ticket rebate settings intact', () => {
    const [ticket] = normalizeTicketsForVariant(
      [{ id: 'elephant', price: 1600, rebate: 1000, split: true }],
      'legacy'
    )

    expect(ticket.rebate).toBe(1000)
    expect(ticket.split).toBe(true)
  })

  it('removes rebate sharing from formal tickets', () => {
    const [ticket] = normalizeTicketsForVariant(
      [{ id: 'elephant', price: 1600, rebate: 1000, split: true }],
      'formal'
    )

    expect(ticket.rebate).toBe(0)
    expect(ticket.split).toBe(false)
  })

  it('removes thai dress rebates from the formal variant config', () => {
    const config = normalizePricingConfigForVariant(
      {
        thaiDress: {
          cloth: { price: 500, rebate: 200 },
          makeup: { price: 1000, rebate: 500 },
          photo: { price: 2500, rebate: 500 },
        },
      },
      'formal'
    )

    expect(config.thaiDress).toEqual({
      cloth: { price: 500, rebate: 0 },
      makeup: { price: 1000, rebate: 0 },
      photo: { price: 2500, rebate: 0 },
    })
  })

  it('splits total profit 70/15/15 for the formal summary', () => {
    expect(calculateFormalProfitShares(1000)).toEqual([
      { label: '柏裕 70%', amount: 700 },
      { label: 'Lulu 15%', amount: 150 },
      { label: '彥君 15%', amount: 150 },
    ])
  })

  it('flags the formal UI to hide rebate controls and legacy split notes', () => {
    expect(getPricingVariantUi('legacy')).toMatchObject({
      showTicketRebateInput: true,
      showTicketSplitInput: true,
      showTicketRefundSplitNote: true,
      showLegacyPartnerProfitRows: true,
    })

    expect(getPricingVariantUi('formal')).toMatchObject({
      showTicketRebateInput: false,
      showTicketSplitInput: false,
      showTicketRefundSplitNote: false,
      showLegacyPartnerProfitRows: false,
    })
  })
})
