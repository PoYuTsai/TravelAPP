// src/lib/itinerary/types.ts
// 行程相關型別定義

export interface ParsedActivity {
  time?: string
  content: string
}

export interface ParsedDay {
  date: string // YYYY-MM-DD
  dayNumber: number
  title: string
  morning: string
  afternoon: string
  evening: string
  lunch?: string
  dinner?: string
  accommodation?: string
  activities: ParsedActivity[]
  rawText: string
}

export interface ParseResult {
  success: boolean
  days: ParsedDay[]
  errors: string[]
  year: number
}

export interface ParsedBasicInfo {
  clientName?: string
  startDate?: string
  endDate?: string
  adults?: number
  children?: number
  childrenAges?: string
  groupType?: string
  totalPeople?: number
  luggageNote?: string
  vehicleNote?: string
  guideNote?: string
}

export interface ParsedQuotationItem {
  date?: string
  description: string
  unitPrice: number
  quantity: number
  unit?: string
}

export interface ParsedQuotation {
  items: ParsedQuotationItem[]
  total?: number
  note?: string
}

export interface HotelBooking {
  hotelName: string
  startDate: string
  endDate: string
  guests: string
  color: string
}

// 星期對照表
export const WEEKDAY_MAP: Record<string, number> = {
  '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
  'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
}

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
