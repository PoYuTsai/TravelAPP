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
 * Fallback: parse itineraryText into per-day items.
 *
 * Supports two formats:
 * 1. 標準格式：「Day 1｜title\n・item1\n午餐：item2」
 * 2. 客人格式：「6/15 (一)\n8：00 出發\n11：30-13：30 午餐」
 */
function parseItineraryTextFallback(
  text: string
): { day: string; title: string; items: string[]; hotel: string | null }[] {
  if (!text?.trim()) return []

  // 先嘗試標準格式
  const standardResult = parseStandardFormat(text)
  if (standardResult.length > 0) return standardResult

  // 再嘗試客人日期格式
  return parseDateFormat(text)
}

/** 標準格式：Day N｜標題 */
function parseStandardFormat(text: string) {
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
    return { day: `DAY ${mk.dayNum}`, title: mk.title, ...parseSection(text.slice(start, end)) }
  })
}

/** 客人日期格式：6/15 (一) 或 6/15（一）*/
function parseDateFormat(text: string) {
  const dateRegex = /(\d{1,2}\/\d{1,2})\s*[（(]\s*[一二三四五六日]\s*[）)]/g
  const markers: { date: string; pos: number; len: number }[] = []
  let m: RegExpExecArray | null
  while ((m = dateRegex.exec(text)) !== null) {
    markers.push({ date: m[1], pos: m.index, len: m[0].length })
  }
  if (markers.length === 0) return []

  return markers.map((mk, i) => {
    const start = mk.pos + mk.len
    const end = i < markers.length - 1 ? markers[i + 1].pos : text.length
    const section = text.slice(start, end)
    const parsed = parseSection(section)
    // 用第一個行程項目做標題（如果有的話）
    const title = parsed.items[0] || `${mk.date} 行程`
    return { day: `DAY ${i + 1}`, title, ...parsed }
  })
}

/** 從一段文字中提取行程項目 */
function parseSection(section: string): { items: string[]; hotel: string | null } {
  const items: string[] = []
  let hotel: string | null = null

  for (const raw of section.split('\n')) {
    const line = raw.trim()
    if (!line) continue

    // 住宿行：只有「・住宿：XXX」格式才提取為 hotel（不顯示在行程列表）
    if (/^[・·\-*]?\s*住宿[：:]\s*\S/.test(line)) {
      hotel = line.replace(/^[・·\-*]?\s*住宿[：:]\s*/, '').trim()
      continue
    }
    // 空的「・住宿：」跳過
    if (/^[・·\-*]?\s*住宿[：:]\s*$/.test(line)) continue

    // 跳過 header 行
    if (/^[📅👨<]/.test(line)) continue
    if (/^[（(]\s*[可停]/.test(line)) continue // （可停）備註行

    // ・項目符號開頭
    if (/^[・·\-*]/.test(line)) {
      items.push(line.replace(/^[・·\-*]\s*/, '').trim())
    }
    // 午餐/晚餐/早餐 開頭
    else if (/^(午餐|晚餐|早餐|下午茶)[：:]/.test(line)) {
      items.push(line)
    }
    // **粗體** 開頭
    else if (/^\*\*/.test(line)) {
      items.push(line.replace(/\*\*/g, '').trim())
    }
    // 時間開頭：8：00、11：30-13：30、14:00-15:30
    else if (/^\d{1,2}[：:]\d{2}/.test(line)) {
      // 提取時間後面的內容
      const content = line.replace(/^\d{1,2}[：:]\d{2}\s*[-~]?\s*(\d{1,2}[：:]\d{2})?\s*/, '').trim()
      if (content) items.push(content)
    }
    // 「晚餐 XXX」沒有冒號的格式
    else if (/^晚餐\s+\S/.test(line)) {
      items.push(line)
    }
    // 「早餐後退房」等無符號行
    else if (/退房|出發/.test(line)) {
      items.push(line)
    }
  }

  return { items, hotel }
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

  // Build itinerary — always prefer fallback text parser (cleaner results)
  // parsedItinerary from calculator can be corrupted (multi-line items)
  const textParsed = parseItineraryTextFallback(data.itineraryText ?? '')
  const useParsed = textParsed.length > 0 ? textParsed : (data.parsedItinerary ?? [])

  const rawItinerary = buildQuoteItinerary({
    parsedItinerary: useParsed,
    carFees,
    tripDays,
    includeAccommodation,
    hotels,
  })

  const itinerary = rawItinerary.map((day) => ({
    ...day,
    items: day.items.map((item, itemIndex) =>
      inferTimelineItem(item, itemIndex, day.items.length)
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
    travelerLabel: snapshot?.travelerLabel || data.travelerLabel || undefined,
    isSample,
  }
}
