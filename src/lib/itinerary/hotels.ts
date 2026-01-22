// src/lib/itinerary/hotels.ts
// 飯店記錄處理

import type { HotelBooking } from './types'

// 顏色輪替
const HOTEL_COLORS = ['yellow', 'green', 'blue', 'orange', 'pink', 'purple']

/**
 * 從每日住宿資料自動產生飯店記錄
 * 將連續住同一飯店的日期合併成一筆記錄
 */
export function generateHotelsFromDays(days: Array<{
  date: string
  accommodation?: string
}>): HotelBooking[] {
  const hotels: HotelBooking[] = []

  let colorIndex = 0
  let currentHotel: string | null = null
  let currentStartDate: string | null = null
  let currentEndDate: string | null = null

  for (const day of days) {
    const accommodation = day.accommodation?.trim()

    if (accommodation) {
      if (accommodation === currentHotel) {
        // 同一間飯店，延長住宿
        currentEndDate = day.date
      } else {
        // 換飯店了，儲存前一間
        if (currentHotel && currentStartDate && currentEndDate) {
          const checkoutDate = new Date(currentEndDate + 'T00:00:00')
          checkoutDate.setDate(checkoutDate.getDate() + 1)
          const checkoutStr = checkoutDate.toISOString().split('T')[0]

          hotels.push({
            hotelName: currentHotel,
            startDate: currentStartDate,
            endDate: checkoutStr,
            guests: '全團',
            color: HOTEL_COLORS[colorIndex % HOTEL_COLORS.length],
          })
          colorIndex++
        }

        // 開始新飯店
        currentHotel = accommodation
        currentStartDate = day.date
        currentEndDate = day.date
      }
    }
  }

  // 儲存最後一間飯店
  if (currentHotel && currentStartDate && currentEndDate) {
    const checkoutDate = new Date(currentEndDate + 'T00:00:00')
    checkoutDate.setDate(checkoutDate.getDate() + 1)
    const checkoutStr = checkoutDate.toISOString().split('T')[0]

    hotels.push({
      hotelName: currentHotel,
      startDate: currentStartDate,
      endDate: checkoutStr,
      guests: '全團',
      color: HOTEL_COLORS[colorIndex % HOTEL_COLORS.length],
    })
  }

  return hotels
}
