// src/lib/itinerary/index.ts
// 行程模組統一匯出

// 類型
export type {
  ParsedActivity,
  ParsedDay,
  ParseResult,
  ParsedBasicInfo,
  ParsedQuotationItem,
  ParsedQuotation,
  HotelBooking,
} from './types'

export { WEEKDAY_MAP, WEEKDAYS } from './types'

// 解析函數
export {
  parseItineraryText,
  parseBasicInfoText,
  parseQuotationText,
} from './parser'

// 格式化函數
export {
  formatToLineText,
  sanityToLineText,
  sanityToBasicInfoText,
  sanityToQuotationText,
} from './formatter'

// 飯店處理
export { generateHotelsFromDays } from './hotels'
