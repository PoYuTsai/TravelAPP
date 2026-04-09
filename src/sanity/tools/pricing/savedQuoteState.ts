import type { ActivityMatchResult } from '@/lib/itinerary'

export interface SavedParsedItineraryDay {
  day: string
  title: string
  items: string[]
  hotel: string | null
}

export interface SavedParseWarning {
  type: string
  message: string
}

interface ResolveSavedParseStateParams<TTicket> {
  itineraryText?: string | null
  parsedItinerary?: SavedParsedItineraryDay[] | null
  parseResult?: ActivityMatchResult | null
  parseWarnings?: SavedParseWarning[] | null
  isParseConfirmed?: boolean
  thaiDressDay?: number | null
  useDefaultTickets?: boolean
  tickets?: TTicket[] | null
  savedParsedTickets?: TTicket[] | null
}

function isActivityMatchResult(value: unknown): value is ActivityMatchResult {
  if (!value || typeof value !== 'object') return false

  const candidate = value as ActivityMatchResult
  return (
    Array.isArray(candidate.matched) &&
    Array.isArray(candidate.unmatched) &&
    Array.isArray(candidate.dates) &&
    Array.isArray(candidate.hotels)
  )
}

export function resolveSavedParseState<TTicket>(
  params: ResolveSavedParseStateParams<TTicket>
) {
  const parsedItinerary = Array.isArray(params.parsedItinerary)
    ? params.parsedItinerary.map((day) => ({
        day: day.day,
        title: day.title,
        items: Array.isArray(day.items) ? [...day.items] : [],
        hotel: day.hotel ?? null,
      }))
    : []

  const parseWarnings = Array.isArray(params.parseWarnings)
    ? params.parseWarnings
        .filter(
          (warning): warning is SavedParseWarning =>
            Boolean(warning) &&
            typeof warning.type === 'string' &&
            typeof warning.message === 'string'
        )
        .map((warning) => ({ ...warning }))
    : []

  const parseResult = isActivityMatchResult(params.parseResult)
    ? {
        matched: params.parseResult.matched.map((item) => ({ ...item })),
        unmatched: params.parseResult.unmatched.map((item) => ({
          ...item,
          suggestedKeywords: [...item.suggestedKeywords],
        })),
        dates: params.parseResult.dates.map((item) => ({ ...item })),
        hotels: params.parseResult.hotels.map((item) => ({ ...item })),
      }
    : null

  const savedParsedTickets = Array.isArray(params.savedParsedTickets)
    ? [...params.savedParsedTickets]
    : !params.useDefaultTickets && Array.isArray(params.tickets)
      ? [...params.tickets]
      : []

  const thaiDressDay =
    typeof params.thaiDressDay === 'number' && params.thaiDressDay > 0
      ? params.thaiDressDay
      : null

  const hasParseSnapshot =
    parsedItinerary.length > 0 ||
    parseResult !== null ||
    parseWarnings.length > 0 ||
    thaiDressDay !== null

  return {
    parsedItinerary,
    parseResult,
    parseWarnings,
    isParseConfirmed: hasParseSnapshot ? params.isParseConfirmed ?? parsedItinerary.length > 0 : false,
    shouldShowParser: Boolean(params.itineraryText?.trim()),
    savedParsedTickets,
    thaiDressDay,
  }
}

export function getNextHotelIdFromSavedHotels(
  hotels?: Array<{ id: number }> | null
) {
  const maxHotelId = (hotels ?? []).reduce((maxId, hotel) => {
    if (!hotel || typeof hotel.id !== 'number' || Number.isNaN(hotel.id)) {
      return maxId
    }

    return Math.max(maxId, hotel.id)
  }, 0)

  return maxHotelId + 1
}
