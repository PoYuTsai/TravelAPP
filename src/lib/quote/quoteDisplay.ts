import type {
  ExternalQuoteBreakdown,
  ExternalQuoteBreakdownItem,
} from '@/sanity/tools/pricing/externalQuote'

type QuoteDisplayRoom = {
  quantity?: number
}

type QuoteDisplayHotel = {
  includeInQuote?: boolean
  startNight?: number
  nights?: number
  rooms?: Record<string, QuoteDisplayRoom[]>
}

interface EnhanceQuoteBreakdownOptions {
  hotels?: QuoteDisplayHotel[]
  includeAccommodation?: boolean
  travelerCount?: number
}

const ACCOMMODATION_LABEL = '住宿'
const LUGGAGE_LABEL = '行李加大車'
const INSURANCE_LABEL = '旅遊保險'

function countHotelRooms(hotel: QuoteDisplayHotel) {
  return Object.values(hotel.rooms ?? {}).reduce((total, rooms) => {
    return total + rooms.reduce((roomTotal, room) => roomTotal + Math.max(0, room.quantity ?? 0), 0)
  }, 0)
}

function getIncludedHotels(options: EnhanceQuoteBreakdownOptions) {
  if (options.includeAccommodation === false) return []
  return (options.hotels ?? []).filter((hotel) => hotel.includeInQuote !== false)
}

function countIncludedAccommodationNights(hotels: QuoteDisplayHotel[]) {
  const indexedNights = new Set<number>()
  let fallbackNights = 0

  for (const hotel of hotels) {
    const nights = Math.max(0, hotel.nights ?? 0)
    if (nights === 0) continue

    if (Number.isFinite(hotel.startNight)) {
      const startNight = Math.max(1, hotel.startNight ?? 1)
      for (let i = 0; i < nights; i += 1) {
        indexedNights.add(startNight + i)
      }
    } else {
      fallbackNights += nights
    }
  }

  return indexedNights.size || fallbackNights
}

function extractNightCount(description?: string) {
  if (!description) return 0
  const match = description.match(/(\d+)\s*晚/)
  return match ? Number(match[1]) : 0
}

function formatAccommodationDescription(nights: number, rooms: number) {
  if (nights <= 0 && rooms <= 0) return undefined
  if (nights <= 0) return `住宿，共 ${rooms} 間房`
  return `${nights} 晚住宿${rooms > 0 ? `，共 ${rooms} 間房` : ''}`
}

function enhanceQuoteItem(
  item: ExternalQuoteBreakdownItem,
  options: EnhanceQuoteBreakdownOptions
): ExternalQuoteBreakdownItem {
  if (item.label === ACCOMMODATION_LABEL) {
    const includedHotels = getIncludedHotels(options)
    const nights = countIncludedAccommodationNights(includedHotels) || extractNightCount(item.description)
    const rooms = includedHotels.reduce((total, hotel) => total + countHotelRooms(hotel), 0)
    const description = formatAccommodationDescription(nights, rooms)

    return description ? { ...item, description } : item
  }

  if (item.label === LUGGAGE_LABEL) {
    return {
      ...item,
      description:
        item.description && !item.description.includes('加大行李空間')
          ? item.description
          : '行李車放置行李',
    }
  }

  if (item.label === INSURANCE_LABEL && options.travelerCount && options.travelerCount > 0) {
    return {
      ...item,
      description: `共 ${options.travelerCount} 位旅客`,
    }
  }

  return item
}

export function enhanceQuoteBreakdown(
  quote: ExternalQuoteBreakdown | null,
  options: EnhanceQuoteBreakdownOptions
) {
  if (!quote) return null

  return {
    ...quote,
    items: quote.items.map((item) => enhanceQuoteItem(item, options)),
  }
}

export function getIncludedDisplayLabel(
  label: string,
  items: Pick<ExternalQuoteBreakdownItem, 'label' | 'description'>[]
) {
  if (label !== ACCOMMODATION_LABEL) return label

  const item = items.find((candidate) => candidate.label === label)
  const nights = extractNightCount(item?.description)

  return nights > 0 ? `${label}（${nights}晚）` : label
}
