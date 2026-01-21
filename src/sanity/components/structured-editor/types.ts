// src/sanity/components/structured-editor/types.ts

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

// 從 Sanity 文件轉換成 EditorState
export function documentToEditorState(doc: any): EditorState {
  const days = doc?.days || []
  const startDate = doc?.startDate || ''
  const endDate = doc?.endDate || ''

  // 基本資訊
  const basicInfo: BasicInfo = {
    clientName: doc?.clientName || '',
    startDate,
    endDate,
    arrivalFlight: doc?.arrivalFlight || { preset: '', custom: '' },
    departureFlight: doc?.departureFlight || { preset: '', custom: '' },
    adults: doc?.adults || 2,
    children: doc?.children || 0,
    childrenAges: doc?.childrenAges || '',
    guideService: doc?.guideService || { required: true, quantity: 1, days: days.length || 1 },
    childSeat: doc?.childSeat || { required: false, quantity: 0, days: 0 },
    extraVehicle: doc?.extraVehicle || { required: false, quantity: 0, days: 0 },
    vehicleCount: doc?.vehicleCount || 1,
    vehicleType: doc?.vehicleType || 'van',
    luggageNote: doc?.luggageNote || '',
  }

  // 報價
  const quotationItems = doc?.quotationItems || []
  const dailyItems: DailyQuotationItem[] = []
  const otherItems: OtherQuotationItem[] = []

  // 將現有報價分類
  quotationItems.forEach((item: any) => {
    if (item.date) {
      // 每日包車項目
      const date = new Date(item.date)
      const weekdays = ['日', '一', '二', '三', '四', '五', '六']
      dailyItems.push({
        date: item.date,
        weekday: weekdays[date.getDay()],
        description: item.description || '',
        price: item.unitPrice || 0,
      })
    } else {
      // 其他費用
      let type: OtherQuotationItem['type'] = 'custom'
      if (item.description?.includes('導遊')) type = 'guide'
      else if (item.description?.includes('座椅')) type = 'childSeat'
      else if (item.description?.includes('雙條車')) type = 'extraVehicle'
      else if (item.description?.includes('保險')) type = 'insurance'
      else if (item.description?.includes('外地住宿') || item.description?.includes('住宿補貼'))
        type = 'outOfTownStay'

      otherItems.push({
        type,
        description: item.description || '',
        unitPrice: item.unitPrice || 0,
        quantity: item.quantity || 1,
        days: 1,
        subtotal: (item.unitPrice || 0) * (item.quantity || 1),
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

// 取得星期幾
export function getWeekday(dateStr: string): string {
  const date = new Date(dateStr)
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
