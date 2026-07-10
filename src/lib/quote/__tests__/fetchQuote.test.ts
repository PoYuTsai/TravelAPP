import { describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock('next-sanity', () => ({
  createClient: () => ({ fetch: fetchMock }),
}))

import { fetchQuoteBySlug } from '../fetchQuote'

function buildDoc(snapshot: Record<string, unknown> | undefined) {
  return {
    name: '測試報價',
    publicSlug: 'test-quote',
    createdAt: '2026-07-10T00:00:00Z',
    payload: JSON.stringify({
      data: {
        adults: 4,
        children: 2,
        carFees: [{ type: 'city', price: 4500 }],
        itineraryText: '',
        _quoteSnapshot: snapshot,
      },
    }),
    photos: [],
  }
}

describe('fetchQuoteBySlug pricingModel passthrough', () => {
  it('exposes pricingModel perPerson from new snapshots', async () => {
    fetchMock.mockResolvedValueOnce(
      buildDoc({ pricingModel: 'perPerson', externalQuote: null })
    )
    const quote = await fetchQuoteBySlug('test-quote')
    expect(quote?.pricingModel).toBe('perPerson')
  })

  it('leaves pricingModel undefined for legacy snapshots', async () => {
    fetchMock.mockResolvedValueOnce(buildDoc({ externalQuote: null }))
    const quote = await fetchQuoteBySlug('test-quote')
    expect(quote).not.toBeNull()
    expect(quote?.pricingModel).toBeUndefined()
  })

  it('leaves pricingModel undefined when snapshot is missing entirely', async () => {
    fetchMock.mockResolvedValueOnce(buildDoc(undefined))
    const quote = await fetchQuoteBySlug('test-quote')
    expect(quote).not.toBeNull()
    expect(quote?.pricingModel).toBeUndefined()
  })
})
