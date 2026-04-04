export const TWD_TRANSFER_ACCOUNT = {
  accountName: '蔡柏裕',
  bankName: '彰化銀行',
  bankCode: '009',
  accountNumber: '51619501772100',
} as const

export const QUOTE_HERO_IMAGE_SRC = '/images/quote-hero-eric-min.jpg'

export const EXTERNAL_QUOTE_THEME = {
  pageBackground: '#f7f1e6',
  surface: '#fffaf2',
  surfaceStrong: '#f5ecdc',
  surfaceWarm: '#f4e4c5',
  accent: '#d89b47',
  accentDeep: '#c57c35',
  accentSoft: '#ecd2a4',
  border: '#e7d7c2',
  text: '#5c4338',
  textSoft: '#7a6255',
  textMuted: '#9a826f',
  shadow: 'rgba(110, 77, 49, 0.08)',
} as const

export interface QuoteDetailDay {
  day: string
  title: string
  items: string[]
  hotel: string | null
}

interface QuoteDetailCarFee {
  date?: string
  name?: string
}

interface QuoteDetailHotel {
  name: string
}

export function buildQuoteItinerary(params: {
  parsedItinerary: QuoteDetailDay[]
  carFees: QuoteDetailCarFee[]
  tripDays: number
  includeAccommodation: boolean
  hotels: QuoteDetailHotel[]
}): QuoteDetailDay[] {
  const { parsedItinerary, carFees, tripDays, includeAccommodation, hotels } = params

  if (parsedItinerary.length > 0) {
    return parsedItinerary.slice(0, tripDays).map((day) => ({
      ...day,
      hotel: includeAccommodation ? day.hotel ?? null : null,
    }))
  }

  return carFees.map((carFee, index) => ({
    day: `DAY ${index + 1}${carFee.date ? ` (${carFee.date})` : ''}`,
    title: carFee.name || `第 ${index + 1} 天`,
    items: [],
    hotel: includeAccommodation ? hotels[0]?.name ?? null : null,
  }))
}
