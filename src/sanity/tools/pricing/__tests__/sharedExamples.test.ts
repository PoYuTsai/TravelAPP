import { describe, expect, it } from 'vitest'

import {
  buildPricingExampleDocument,
  getPricingExampleDocumentId,
  mergeSavedQuoteRecords,
  parsePricingExampleDocument,
} from '@/sanity/tools/pricing/sharedExamples'

describe('pricing shared examples', () => {
  it('serializes a shared quote into a Sanity document', () => {
    const doc = buildPricingExampleDocument(
      'formal',
      {
        id: 'quote-1',
        name: '王先生 6天5夜',
        createdAt: '2026-04-04T10:00:00.000Z',
        updatedAt: '2026-04-04T11:00:00.000Z',
        data: {
          itineraryText: 'Day 1 清邁古城\nDay 2 大象營',
          people: 4,
        },
      },
      {
        name: 'Eric',
        email: 'ERIC@example.com',
      }
    )

    expect(doc).toMatchObject({
      _id: getPricingExampleDocumentId('formal', 'quote-1'),
      _type: 'pricingExample',
      variant: 'formal',
      name: '王先生 6天5夜',
      createdByName: 'Eric',
      createdByEmail: 'eric@example.com',
      itineraryPreview: 'Day 1 清邁古城 Day 2 大象營',
    })

    expect(JSON.parse(doc.payload)).toEqual({
      itineraryText: 'Day 1 清邁古城\nDay 2 大象營',
      people: 4,
    })
  })

  it('parses a Sanity document back into a saved quote', () => {
    const parsed = parsePricingExampleDocument<{
      itineraryText: string
      people: number
    }>({
      _id: 'pricingExample.formal.quote-1',
      _type: 'pricingExample',
      name: '共享案例',
      variant: 'formal',
      createdAt: '2026-04-04T10:00:00.000Z',
      updatedAt: '2026-04-04T11:00:00.000Z',
      createdByName: 'Lulu',
      createdByEmail: 'moon12sun20@yahoo.com.tw',
      payload: JSON.stringify({
        itineraryText: '共享行程',
        people: 6,
      }),
    })

    expect(parsed).toEqual({
      id: 'quote-1',
      name: '共享案例',
      createdAt: '2026-04-04T10:00:00.000Z',
      updatedAt: '2026-04-04T11:00:00.000Z',
      createdByName: 'Lulu',
      createdByEmail: 'moon12sun20@yahoo.com.tw',
      data: {
        itineraryText: '共享行程',
        people: 6,
      },
    })
  })

  it('deduplicates quote records while keeping the newest list order', () => {
    const merged = mergeSavedQuoteRecords(
      [
        {
          id: 'remote-1',
          name: '遠端案例',
          createdAt: '2026-04-04T09:00:00.000Z',
          updatedAt: '2026-04-04T12:00:00.000Z',
          data: { itineraryText: 'remote' },
        },
      ],
      [
        {
          id: 'remote-1',
          name: '本機重複案例',
          createdAt: '2026-04-04T09:00:00.000Z',
          updatedAt: '2026-04-04T11:00:00.000Z',
          data: { itineraryText: 'local-duplicate' },
        },
        {
          id: 'local-2',
          name: '本機案例',
          createdAt: '2026-04-04T08:00:00.000Z',
          updatedAt: '2026-04-04T10:00:00.000Z',
          data: { itineraryText: 'local-only' },
        },
      ]
    )

    expect(merged.map((quote) => quote.id)).toEqual(['remote-1', 'local-2'])
    expect(merged[0].name).toBe('遠端案例')
  })
})
