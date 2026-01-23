// src/lib/notion/tours.ts

import type { NotionOrder } from './types'
import { fetchNotionOrdersByYear } from './client'

export interface TourCase {
  id: string
  name: string
  days: number
  startDate: string  // ISO format: 2026-02-20
  endDate: string | null  // ISO format or null for single day
  status: 'completed' | 'upcoming'
}

export interface TourCasesResponse {
  cases: TourCase[]
  total: number
  year: number
  availableYears: number[]
}

/**
 * 從 Notion 訂單轉換為行程案例（公開顯示用）
 */
function orderToCase(order: NotionOrder): TourCase | null {
  if (!order.customerName || !order.travelDate?.start) {
    return null
  }

  const startDateObj = new Date(order.travelDate.start)
  const now = new Date()
  // 設定為今天的開始時間（0:00:00）以便正確比較日期
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // 計算天數
  let days = 1
  let endDateObj = startDateObj
  if (order.travelDate.end) {
    endDateObj = new Date(order.travelDate.end)
    days = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  // 判斷狀態：用結束日期判斷（如果行程還沒結束就是「即將出發」）
  // 如果結束日期 < 今天 → 已完成
  // 如果開始日期 >= 今天 → 即將出發
  const status: 'completed' | 'upcoming' = endDateObj < today ? 'completed' : 'upcoming'

  return {
    id: order.id,
    name: order.customerName,
    days,
    startDate: order.travelDate.start,  // ISO format from Notion
    endDate: order.travelDate.end || null,  // ISO format or null
    status,
  }
}

/**
 * 取得指定年份的行程案例（公開 API 用）
 */
export async function fetchTourCases(
  year: number,
  limit: number = 20,
  offset: number = 0
): Promise<TourCasesResponse> {
  const orders = await fetchNotionOrdersByYear(year)

  // 轉換並過濾有效案例
  const allCases = orders
    .map(orderToCase)
    .filter((c): c is TourCase => c !== null)
    // 按旅遊日期排序（最早的在前面）
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

  const total = allCases.length
  const cases = allCases.slice(offset, offset + limit)

  // 動態計算可用年份（當前年 + 前一年）
  const currentYear = new Date().getFullYear()
  const availableYears = [currentYear, currentYear - 1]

  return {
    cases,
    total,
    year,
    availableYears,
  }
}
