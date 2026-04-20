import type { TimelineItem } from './inferTimelineItem'
import type { ExternalQuoteBreakdown } from '@/sanity/tools/pricing/externalQuote'

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
  tripDays: number
  tripNights: number
  exchangeRate: number

  itinerary: QuoteItineraryDay[]

  quote: ExternalQuoteBreakdown | null

  collectDeposit: boolean
  hotelsWithDeposit: { name: string; deposit: number; rooms: number }[]
  totalDeposit: number
  carCount: number

  photos: QuotePhoto[]

  isSample: boolean
}
