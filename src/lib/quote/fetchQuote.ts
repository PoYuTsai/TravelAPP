import { createClient } from 'next-sanity'
import { projectId, dataset, apiVersion } from '@/sanity/config'

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
})
import { inferTimelineItem } from './inferTimelineItem'
import { buildQuoteItinerary } from '@/sanity/tools/pricing/quoteDetails'
import type { QuoteData, QuotePhoto } from './types'

const SAMPLE_SLUG = 'sample'

/**
 * Fallback: parse itineraryText into per-day items when parsedItinerary is empty.
 * Handles format like: "Day 1｜title\n・item1\n午餐：item2\n..."
 */
function parseItineraryTextFallback(
  text: string
): { day: string; title: string; items: string[]; hotel: string | null }[] {
  if (!text?.trim()) return []

  const dayRegex = /Day\s*(\d+)\s*[｜|]\s*(.+)/gi
  const markers: { dayNum: string; title: string; pos: number; len: number }[] = []
  let m: RegExpExecArray | null
  while ((m = dayRegex.exec(text)) !== null) {
    markers.push({ dayNum: m[1], title: m[2].trim(), pos: m.index, len: m[0].length })
  }
  if (markers.length === 0) return []

  return markers.map((mk, i) => {
    const start = mk.pos + mk.len
    const end = i < markers.length - 1 ? markers[i + 1].pos : text.length
    const section = text.slice(start, end)

    const items: string[] = []
    let hotel: string | null = null

    for (const raw of section.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      if (/住宿[：:]/.test(line)) {
        const name = line.replace(/^[・·\-*]?\s*住宿[：:]\s*/, '').trim()
        if (name) hotel = name
        continue
      }
      if (/^[📅👨<]/.test(line)) continue
      if (/^[・·\-*]/.test(line)) {
        items.push(line.replace(/^[・·\-*]\s*/, '').trim())
      } else if (/^(午餐|晚餐|早餐|下午茶)[：:]/.test(line)) {
        items.push(line)
      } else if (/^\*\*/.test(line)) {
        items.push(line.replace(/\*\*/g, '').trim())
      }
    }

    return { day: `DAY ${mk.dayNum}`, title: mk.title, items, hotel }
  })
}

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

  // Build itinerary — use parsedItinerary if available, otherwise fallback parse from text
  const hasParsedItinerary = Array.isArray(data.parsedItinerary) && data.parsedItinerary.length > 0
  const fallbackParsed = !hasParsedItinerary ? parseItineraryTextFallback(data.itineraryText ?? '') : []

  const rawItinerary = buildQuoteItinerary({
    parsedItinerary: hasParsedItinerary ? data.parsedItinerary : fallbackParsed,
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
