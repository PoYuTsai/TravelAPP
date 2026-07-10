import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FORMAL_QUOTE_OPTIONS,
  EXTERNAL_QUOTE_LAYOUT,
  getExternalQuoteTotalCopy,
  getExternalQuoteHeaderCopy,
  resolveSavedGuideSelection,
  buildQuoteItinerary,
  TWD_TRANSFER_ACCOUNT,
} from '@/sanity/tools/pricing/quoteDetails'

describe('pricing quote details', () => {
  it('defaults new formal quotes to optional guide and insurance', () => {
    expect(DEFAULT_FORMAL_QUOTE_OPTIONS).toEqual({
      includeGuide: false,
      includeInsurance: false,
    })
  })

  it('presents THB as the formal quote total and keeps TWD as an approximate reference', () => {
    expect(getExternalQuoteTotalCopy(62_500, 67_204, (value: number) => value.toLocaleString('en-US'))).toEqual({
      primary: 'THB 62,500',
      twdReference: '約 NT$ 67,204',
    })
  })

  it('preserves guide selection when loading quotes saved before the field existed', () => {
    expect(resolveSavedGuideSelection(undefined)).toBe(true)
    expect(resolveSavedGuideSelection(true)).toBe(true)
    expect(resolveSavedGuideSelection(false)).toBe(false)
  })

  it('wires the optional defaults into both initial and reset state', () => {
    const source = readFileSync(new URL('../PricingCalculator.tsx', import.meta.url), 'utf8')

    expect(source.includes('useState<boolean>(DEFAULT_FORMAL_QUOTE_OPTIONS.includeInsurance)')).toBe(true)
    expect(source.includes('useState<boolean>(DEFAULT_FORMAL_QUOTE_OPTIONS.includeGuide)')).toBe(true)
    expect(source.includes('setIncludeInsurance(DEFAULT_FORMAL_QUOTE_OPTIONS.includeInsurance)')).toBe(true)
    expect(source.includes('setIncludeGuide(DEFAULT_FORMAL_QUOTE_OPTIONS.includeGuide)')).toBe(true)
  })

  it('uses the compatibility resolver when loading a saved guide selection', () => {
    const source = readFileSync(new URL('../PricingCalculator.tsx', import.meta.url), 'utf8')

    expect(source.includes('setIncludeGuide(resolveSavedGuideSelection(quote.data.includeGuide))')).toBe(true)
  })

  it('uses the same THB-first total copy in the PDF and Studio customer quote', () => {
    const source = readFileSync(new URL('../PricingCalculator.tsx', import.meta.url), 'utf8')

    expect(source.match(/getExternalQuoteTotalCopy\(/g) ?? []).toHaveLength(2)
    expect(source.match(/totalPriceCopy\.primary/g) ?? []).toHaveLength(2)
    expect(source.match(/totalPriceCopy\.twdReference/g) ?? []).toHaveLength(2)
  })

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

  it('only shows hotels that are included in the quote', () => {
    const itinerary = buildQuoteItinerary({
      parsedItinerary: [
        {
          day: 'DAY 1',
          title: 'First night',
          items: [],
          hotel: 'Included Hotel',
        },
        {
          day: 'DAY 2',
          title: 'Self booked night',
          items: [],
          hotel: 'Self Booked Hotel',
        },
      ],
      carFees: [],
      tripDays: 2,
      includeAccommodation: true,
      hotels: [
        { name: 'Included Hotel', includeInQuote: true },
        { name: 'Self Booked Hotel', includeInQuote: false },
      ],
    })

    expect(itinerary[0]?.hotel).toBe('Included Hotel')
    expect(itinerary[1]?.hotel).toBeNull()
  })

  it('keeps external quote layout dimensions shared between page and pdf', () => {
    expect(EXTERNAL_QUOTE_LAYOUT).toEqual({
      maxWidth: 640,
      headerPaddingDesktop: 28,
      headerPaddingMobile: 20,
      headerContentMaxWidth: 460,
    })
  })

  it('returns shared brand header copy for page and pdf', () => {
    expect(getExternalQuoteHeaderCopy(5, 4)).toEqual({
      brandName: '清微旅行 Chiangway Travel',
      subtitle: '在地清邁包車與客製旅遊報價',
      title: '清邁 5 天 4 夜 行程報價',
      supportLine: '台灣爸爸 × 泰國媽媽｜清邁在地親子旅遊',
    })
  })
})
