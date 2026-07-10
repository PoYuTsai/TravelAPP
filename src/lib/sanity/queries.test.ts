import { afterEach, describe, expect, it, vi } from 'vitest'
import { getItineraryById } from './queries'

describe('getItineraryById', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests canonical THB quotation fields and infant count without legacy prices', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ result: { _id: 'itinerary-1' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await getItineraryById('itinerary-1')

    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string)
    const query = requestedUrl.searchParams.get('query') ?? ''

    expect(query).toMatch(/\binfants\b/)
    expect(query).toMatch(/quotationItems\[\]\s*\{[^}]*description[^}]*unitPrice[^}]*quantity[^}]*unit[^}]*subtotal/)
    expect(query).toMatch(/\bquotationTotal\b/)
    expect(query).not.toMatch(/\bcarPrice\b/)
    expect(query).not.toMatch(/\bguidePrice\b/)
    expect(query).not.toMatch(/\btotalPrice\b/)
  })
})
