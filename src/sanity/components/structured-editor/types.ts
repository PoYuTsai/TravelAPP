// src/sanity/components/structured-editor/types.ts
import { resolveFleet } from '@/lib/pricing/perPersonRates'

export interface FlightInfo {
  preset: string
  custom?: string
}

export interface ServiceOption {
  required: boolean
  quantity: number
  days: number
}

export interface BasicInfo {
  clientName: string
  startDate: string
  endDate: string
  arrivalFlight: FlightInfo
  departureFlight: FlightInfo
  adults: number
  children: number
  infants: number
  childrenAges: string
  guideService: ServiceOption
  childSeat: ServiceOption
  extraVehicle: ServiceOption
  vehicleCount: number
  vehicleType: string
  luggageNote: string
}

export interface DailyQuotationItem {
  date: string
  weekday: string
  description: string
  price: number
}

export interface OtherQuotationItem {
  type: 'guide' | 'childSeat' | 'extraVehicle' | 'insurance' | 'outOfTownStay' | 'custom'
  description: string
  unitPrice: number
  quantity: number
  days: number
  subtotal: number
}

export interface QuotationState {
  dailyItems: DailyQuotationItem[]
  otherItems: OtherQuotationItem[]
  dailyTotal: number
  otherTotal: number
  grandTotal: number
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface EditorState {
  basicInfo: BasicInfo
  itineraryText: string
  quotation: QuotationState
  notes: string
  validation: ValidationResult
}

/** Keep the editor preview on the same public fleet that will be persisted. */
export function alignLegacyBasicInfoFleet(basicInfo: BasicInfo): BasicInfo {
  const occupiedSeats = Math.max(
    1,
    basicInfo.adults + basicInfo.children + basicInfo.infants,
  )
  const fleet = resolveFleet(occupiedSeats)

  return {
    ...basicInfo,
    vehicleCount: fleet.carCount,
    vehicleType: fleet.vehicle,
  }
}

// 從 Sanity 文件轉換成 EditorState
export function documentToEditorState(doc: any): EditorState {
  const days = doc?.days || []
  const startDate = doc?.startDate || ''
  const endDate = doc?.endDate || ''
  const adults = doc?.adults || 2
  const children = doc?.children || 0
  // `infantCount` is accepted as a read alias for serialized pre-schema documents.
  const infants = doc?.infants ?? doc?.infantCount ?? 0

  // 基本資訊
  const basicInfo = alignLegacyBasicInfoFleet({
    clientName: doc?.clientName || '',
    startDate,
    endDate,
    arrivalFlight: doc?.arrivalFlight || { preset: '', custom: '' },
    departureFlight: doc?.departureFlight || { preset: '', custom: '' },
    adults,
    children,
    infants,
    childrenAges: doc?.childrenAges || '',
    guideService: doc?.guideService || { required: false, quantity: 1, days: days.length || 1 },
    childSeat: doc?.childSeat || { required: false, quantity: 0, days: 0 },
    extraVehicle: doc?.extraVehicle || { required: false, quantity: 0, days: 0 },
    vehicleCount: 1,
    vehicleType: 'sedan',
    luggageNote: doc?.luggageNote || '',
  })

  // 報價
  const quotationItems = doc?.quotationItems || []
  const dailyItems: DailyQuotationItem[] = []
  const otherItems: OtherQuotationItem[] = []

  // 將現有報價分類
  quotationItems.forEach((item: any) => {
    if (item.date) {
      // 每日包車項目（使用 getWeekday 避免時區問題）
      dailyItems.push({
        date: item.date,
        weekday: getWeekday(item.date),
        description: item.description || '',
        price: item.unitPrice || 0,
      })
    } else {
      // 其他費用
      let type: OtherQuotationItem['type'] = 'custom'
      if (item.description?.includes('導遊')) type = 'guide'
      else if (item.description?.includes('座椅')) type = 'childSeat'
      else if (/雙條車|額外行李車/.test(item.description || '')) type = 'extraVehicle'
      else if (item.description?.includes('保險')) {
        // Old versions created an insurance row on every quote. Only the new
        // explicit selection marker is allowed to opt a migrated document in.
        if (!item.description.includes('選配')) return
        type = 'insurance'
      }
      else if (item.description?.includes('外地住宿') || item.description?.includes('住宿補貼'))
        type = 'outOfTownStay'

      const rawQuantity = item.quantity || 1
      const staffCount =
        basicInfo.vehicleCount +
        (basicInfo.guideService.required ? basicInfo.guideService.quantity : 0)
      const quantity = type === 'outOfTownStay' ? staffCount : rawQuantity
      const itemDays =
        type === 'outOfTownStay'
          ? Math.max(1, Math.ceil(rawQuantity / Math.max(1, staffCount)))
          : 1

      otherItems.push({
        type,
        description: item.description || '',
        unitPrice: item.unitPrice || 0,
        quantity,
        days: itemDays,
        subtotal: (item.unitPrice || 0) * quantity * itemDays,
      })
    }
  })

  const dailyTotal = dailyItems.reduce((sum, item) => sum + item.price, 0)
  const otherTotal = otherItems.reduce((sum, item) => sum + item.subtotal, 0)

  return {
    basicInfo,
    itineraryText: doc?.rawItineraryText || '',
    quotation: {
      dailyItems,
      otherItems,
      dailyTotal,
      otherTotal,
      grandTotal: dailyTotal + otherTotal,
    },
    notes: doc?.travelRemarks || '',
    validation: { isValid: true, errors: [] },
  }
}

// 取得星期幾（使用 T00:00:00 避免時區問題）
export function getWeekday(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return weekdays[date.getDay()]
}

// 產生日期範圍內的所有日期
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  while (start <= end) {
    dates.push(start.toISOString().split('T')[0])
    start.setDate(start.getDate() + 1)
  }

  return dates
}
