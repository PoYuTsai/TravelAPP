import { describe, expect, it } from 'vitest'

import {
  EXTERNAL_QUOTE_LAYOUT,
  buildQuoteItinerary,
  resolveQuotePdfRenderScale,
  TWD_TRANSFER_ACCOUNT,
} from '@/sanity/tools/pricing/quoteDetails'

describe('pricing quote details', () => {
  it('keeps the correct Taiwan transfer account info', () => {
    expect(TWD_TRANSFER_ACCOUNT).toEqual({
      accountName: '蔡柏裕',
      bankName: '彰化銀行',
      bankCode: '009',
      accountNumber: '51619501772100',
    })
  })

  it('removes hotel names from parsed itinerary when accommodation is excluded', () => {
    const itinerary = buildQuoteItinerary({
      parsedItinerary: [
        {
          day: 'DAY 1',
          title: '抵達清邁',
          items: ['接機'],
          hotel: '香格里拉酒店',
        },
      ],
      carFees: [],
      tripDays: 1,
      includeAccommodation: false,
      hotels: [{ name: '香格里拉酒店' }],
    })

    expect(itinerary[0]?.hotel).toBeNull()
  })

  it('uses the first hotel only when accommodation is included and no parsed itinerary exists', () => {
    const itinerary = buildQuoteItinerary({
      parsedItinerary: [],
      carFees: [{ date: '2/12', name: '接機日' }],
      tripDays: 1,
      includeAccommodation: true,
      hotels: [{ name: '香格里拉酒店' }],
    })

    expect(itinerary).toEqual([
      {
        day: 'DAY 1 (2/12)',
        title: '接機日',
        items: [],
        hotel: '香格里拉酒店',
      },
    ])
  })

  it('keeps external quote layout dimensions shared between page and pdf', () => {
    expect(EXTERNAL_QUOTE_LAYOUT).toEqual({
      maxWidth: 640,
      heroHeightDesktop: 210,
      heroHeightMobile: 154,
    })
  })

  it('limits pdf render scale to the image natural resolution', () => {
    expect(resolveQuotePdfRenderScale({ imageNaturalWidth: 1256, renderWidth: 640 })).toBe(1.96)
    expect(resolveQuotePdfRenderScale({ imageNaturalWidth: 2400, renderWidth: 640 })).toBe(2)
    expect(resolveQuotePdfRenderScale({ renderWidth: 640 })).toBe(2)
  })
})
