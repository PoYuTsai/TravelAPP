export const TWD_TRANSFER_ACCOUNT = {
  accountName: '蔡柏裕',
  bankName: '彰化銀行',
  bankCode: '009',
  accountNumber: '51619501772100',
} as const

export const DEFAULT_FORMAL_QUOTE_OPTIONS = {
  includeGuide: false,
  includeInsurance: false,
} as const

export function resolveSavedGuideSelection(savedIncludeGuide?: boolean) {
  return savedIncludeGuide ?? true
}

export function getExternalQuoteTotalCopy(
  totalTHB: number,
  totalTWD: number,
  format: (value: number) => string,
) {
  return {
    primary: `THB ${format(totalTHB)}`,
    twdReference: `約 NT$ ${format(totalTWD)}`,
  }
}

export const EXTERNAL_QUOTE_BRAND = {
  brandName: '清微旅行 Chiangway Travel',
  subtitle: '在地清邁包車與客製旅遊報價',
  supportLine: '台灣爸爸 × 泰國媽媽｜清邁在地親子旅遊',
} as const

export const EXTERNAL_QUOTE_LAYOUT = {
  maxWidth: 640,
  headerPaddingDesktop: 28,
  headerPaddingMobile: 20,
  headerContentMaxWidth: 460,
} as const

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

export function getExternalQuoteHeaderCopy(tripDays: number, tripNights: number) {
  return {
    ...EXTERNAL_QUOTE_BRAND,
    title: `清邁 ${tripDays} 天 ${tripNights} 夜 行程報價`,
  }
}

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
  includeInQuote?: boolean
}

function isHotelIncludedInQuote(hotel: QuoteDetailHotel): boolean {
  return hotel.includeInQuote !== false
}

function shouldShowHotelInQuote(hotelName: string | null, hotels: QuoteDetailHotel[]): boolean {
  if (!hotelName) return false

  const matchedHotel = hotels.find((hotel) => hotel.name === hotelName)
  return matchedHotel ? isHotelIncludedInQuote(matchedHotel) : true
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
      hotel: includeAccommodation && shouldShowHotelInQuote(day.hotel, hotels) ? day.hotel ?? null : null,
    }))
  }

  const includedHotels = hotels.filter(isHotelIncludedInQuote)

  return carFees.map((carFee, index) => ({
    day: `DAY ${index + 1}${carFee.date ? ` (${carFee.date})` : ''}`,
    title: carFee.name || `第 ${index + 1} 天`,
    items: [],
    hotel: includeAccommodation ? includedHotels[0]?.name ?? null : null,
  }))
}
