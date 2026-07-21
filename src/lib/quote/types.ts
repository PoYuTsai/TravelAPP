import type { TimelineItem } from './inferTimelineItem'
import type { ExternalQuoteBreakdown } from '@/sanity/tools/pricing/externalQuote'
import type { QuotePublicPageMode } from './publicPageMode'

export interface QuotePhoto {
  dayIndex: number
  images: {
    url: string
    hotspot?: { x: number; y: number }
  }[]
}

export interface QuoteItineraryDay {
  day: string
  title: string
  items: TimelineItem[]
  hotel: string | null
}

export interface QuoteData {
  name: string
  publicSlug: string
  createdAt: string
  updatedAt?: string

  adults: number
  children: number
  infants: number
  tripDays: number
  tripNights: number
  exchangeRate: number

  itinerary: QuoteItineraryDay[]

  quote: ExternalQuoteBreakdown | null
  /** 無此欄位＝舊成本拆項快照，前台走現行渲染 */
  pricingModel?: 'perPerson'

  collectDeposit: boolean
  hotelsWithDeposit: { name: string; deposit: number; rooms: number }[]
  totalDeposit: number
  carCount: number

  photos: QuotePhoto[]

  travelerLabel?: string
  publicPageMode: QuotePublicPageMode
  isSample: boolean
}
