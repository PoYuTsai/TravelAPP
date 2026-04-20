import { client } from '@/sanity/client'
import { inferTimelineItem } from './inferTimelineItem'
import { buildQuoteItinerary } from '@/sanity/tools/pricing/quoteDetails'
import type { QuoteData, QuotePhoto } from './types'

const SAMPLE_SLUG = 'sample'

const QUERY = `*[_type == "pricingExample" && publicSlug.current == $slug][0]{
  name,
  "publicSlug": publicSlug.current,
  createdAt,
  updatedAt,
  payload,
  "photos": photos[]{
    dayIndex,
    "images": images[]{
      "url": asset->url,
      hotspot
    }
  }
}`

export async function fetchQuoteBySlug(
  slug: string
): Promise<QuoteData | null> {
  const doc = await client.fetch(QUERY, { slug })
  if (!doc?.payload) return null

  const saved = JSON.parse(doc.payload)
  const data = saved.data ?? saved

  const adults = data.adults ?? data.people ?? 2
  const children = data.children ?? 0
  const carFees = data.carFees ?? []
  const tripDays = carFees.length || 1
  const tripNights = Math.max(tripDays - 1, 0)
  const exchangeRate = data.exchangeRate ?? 1.1
  const hotels = data.hotels ?? []
  const includeAccommodation = data.includeAccommodation ?? false

  // Build itinerary with smart inference
  const rawItinerary = buildQuoteItinerary({
    parsedItinerary: data.parsedItinerary ?? [],
    carFees,
    tripDays,
    includeAccommodation,
    hotels,
  })

  const itinerary = rawItinerary.map((day) => ({
    ...day,
    items: day.items.map((item, itemIndex) =>
      inferTimelineItem(item, itemIndex)
    ),
  }))

  // Read pre-computed quote snapshot if available
  const snapshot = data._quoteSnapshot ?? null
  const quote = snapshot?.externalQuote ?? null

  const isSample = slug === SAMPLE_SLUG

  return {
    name: doc.name,
    publicSlug: doc.publicSlug,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    adults,
    children,
    tripDays,
    tripNights,
    exchangeRate,
    itinerary,
    quote,
    collectDeposit: snapshot?.collectDeposit ?? false,
    hotelsWithDeposit: snapshot?.hotelsWithDeposit ?? [],
    totalDeposit: snapshot?.totalDeposit ?? 0,
    carCount: snapshot?.carCount ?? (carFees.length > 0 ? 1 : 0),
    photos: (doc.photos ?? []).filter(
      (p: QuotePhoto) => p.images?.length > 0
    ),
    isSample,
  }
}
