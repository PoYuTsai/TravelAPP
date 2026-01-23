// src/lib/notion/tours.ts

import type { NotionOrder } from './types'
import { fetchNotionOrdersByYear } from './client'

export interface TourCase {
  id: string
  name: string
  days: number
  startDate: string  // ISO format: 2026-02-20
  endDate: string | null  // ISO format or null for single day
  status: 'completed' | 'traveling' | 'upcoming'  // 已完成 | 旅遊中 | 即將出發
}

export interface TourCasesResponse {
  cases: TourCase[]
  total: number
  year: number
  availableYears: number[]
}

/**
 * 取得泰國時區 (GMT+7) 的今天日期
 * 用於狀態判斷，確保不管 server 在哪個時區都用泰國時間
 */
function getThailandToday(): Date {
  const now = new Date()
  // 泰國時區 GMT+7，轉換為泰國當地時間
  const thailandOffset = 7 * 60 // 分鐘
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000)
  const thailandTime = new Date(utcTime + (thailandOffset * 60 * 1000))
  // 回傳泰國時間的日期部分（年月日）
  return new Date(thailandTime.getFullYear(), thailandTime.getMonth(), thailandTime.getDate())
}

/**
 * 解析日期字串為日期物件（只取年月日，忽略時區）
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * 從 Notion 訂單轉換為行程案例（公開顯示用）
 */
function orderToCase(order: NotionOrder): TourCase | null {
  if (!order.customerName || !order.travelDate?.start) {
    return null
  }

  // 解析日期（避免時區問題）
  const startDateObj = parseDate(order.travelDate.start)
  const today = getThailandToday()

  // 計算天數
  let days = 1
  let endDateObj = startDateObj
  if (order.travelDate.end) {
    endDateObj = parseDate(order.travelDate.end)
    days = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  // 判斷狀態（使用泰國時間）：
  // 如果結束日期 < 今天 → 已完成
  // 如果開始日期 <= 今天 <= 結束日期 → 旅遊中
  // 如果開始日期 > 今天 → 即將出發
  let status: 'completed' | 'traveling' | 'upcoming'
  if (endDateObj < today) {
    status = 'completed'
  } else if (startDateObj <= today && today <= endDateObj) {
    status = 'traveling'
  } else {
    status = 'upcoming'
  }

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
