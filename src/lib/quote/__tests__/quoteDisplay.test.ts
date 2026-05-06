import { describe, expect, it } from 'vitest'

import type { ExternalQuoteBreakdown } from '@/sanity/tools/pricing/externalQuote'
import { enhanceQuoteBreakdown, getIncludedDisplayLabel } from '@/lib/quote/quoteDisplay'

describe('quote display helpers', () => {
  it('enhances old public quote snapshots with concise included labels and detail descriptions', () => {
    const quote: ExternalQuoteBreakdown = {
      items: [
        { label: '住宿', amountTHB: 3000, amountTWD: 3000, description: '1 晚' },
        { label: '行李加大車', amountTHB: 1200, amountTWD: 1200 },
        { label: '旅遊保險', amountTHB: 800, amountTWD: 800 },
      ],
      included: ['住宿', '行李加大車', '旅遊保險'],
      excluded: [],
      paymentNotes: [],
      totalTHB: 5000,
      totalTWD: 5000,
    }

    const enhanced = enhanceQuoteBreakdown(quote, {
      includeAccommodation: true,
      travelerCount: 8,
      hotels: [
        {
          includeInQuote: true,
          startNight: 1,
          nights: 1,
          rooms: {
            double: [{ quantity: 2 }],
            family: [{ quantity: 3 }],
          },
        },
      ],
    })

    expect(enhanced.items.find((item) => item.label === '住宿')?.description).toBe(
      '1 晚住宿，共 5 間房'
    )
    expect(enhanced.items.find((item) => item.label === '行李加大車')?.description).toBe(
      '行李車放置行李'
    )
    expect(enhanced.items.find((item) => item.label === '旅遊保險')?.description).toBe(
      '共 8 位旅客'
    )
    expect(getIncludedDisplayLabel('住宿', enhanced.items)).toBe('住宿（1晚）')
    expect(getIncludedDisplayLabel('行李加大車', enhanced.items)).toBe('行李加大車')
  })
})
