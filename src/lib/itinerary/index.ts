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
  ParseWarning,
  HotelBooking,
} from './types'

export { WEEKDAY_MAP, WEEKDAYS } from './types'

// 解析函數
export {
  parseItineraryText,
  parseBasicInfoText,
  parseQuotationText,
  getDaysInMonth,
  getNextDate,
  generateConsecutiveDates,
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

// 活動匹配器
export type {
  ActivityRecord,
  MatchedActivity,
  UnmatchedActivity,
  ExtractedDate,
  ExtractedHotel,
  ActivityMatchResult,
} from './activity-matcher'

export {
  matchActivitiesToDatabase,
  parseAndMatchActivities,
  handleExclusiveGroup,
  getDefaultSelections,
} from './activity-matcher'
