// src/lib/notion/tours.ts

import type { NotionOrder } from './types'
import { fetchNotionOrdersByYear } from './client'

export interface TourCase {
  id: string
  name: string
  month: string
  days: number
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

  const startDate = new Date(order.travelDate.start)
  const now = new Date()

  // 計算天數
  let days = 1
  if (order.travelDate.end) {
    const endDate = new Date(order.travelDate.end)
    days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  // 判斷狀態
  const status: 'completed' | 'upcoming' = startDate < now ? 'completed' : 'upcoming'

  // 格式化月份
  const year = startDate.getFullYear()
  const month = startDate.getMonth() + 1
  const monthStr = `${year}/${month}`

  return {
    id: order.id,
    name: order.customerName,
    month: monthStr,
    days,
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
    // 按日期排序（新的在前）
    .sort((a, b) => {
      const dateA = new Date(a.month.replace('/', '-') + '-01')
      const dateB = new Date(b.month.replace('/', '-') + '-01')
      return dateB.getTime() - dateA.getTime()
    })

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
