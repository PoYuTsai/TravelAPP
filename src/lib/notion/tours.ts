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

/**
 * 狀態優先權：旅遊中 > 即將出發 > 已完成
 */
function getStatusPriority(status: TourCase['status']): number {
  switch (status) {
    case 'traveling': return 0
    case 'upcoming': return 1
    case 'completed': return 2
    default: return 3
  }
}

/**
 * 取得最近案例（跨年份，狀態優先排序）
 * 排序邏輯：
 * 1. 旅遊中 → 全部顯示
 * 2. 即將出發 → 未來 60 天內，按日期排序
 * 3. 已完成 → 按完成日期倒序，填滿剩餘位置
 */
export async function fetchRecentTourCases(limit: number = 8): Promise<TourCasesResponse> {
  const currentYear = new Date().getFullYear()
  const availableYears = [currentYear, currentYear - 1]

  // 取得當年和去年的資料
  const [currentYearOrders, lastYearOrders] = await Promise.all([
    fetchNotionOrdersByYear(currentYear),
    fetchNotionOrdersByYear(currentYear - 1),
  ])

  // 合併並轉換為案例
  const allOrders = [...currentYearOrders, ...lastYearOrders]
  const allCases = allOrders
    .map(orderToCase)
    .filter((c): c is TourCase => c !== null)

  const today = getThailandToday()
  const sixtyDaysLater = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)

  // 分類案例
  const traveling: TourCase[] = []
  const upcoming: TourCase[] = []
  const completed: TourCase[] = []

  for (const c of allCases) {
    if (c.status === 'traveling') {
      traveling.push(c)
    } else if (c.status === 'upcoming') {
      // 只取未來 60 天內的
      const startDate = parseDate(c.startDate)
      if (startDate <= sixtyDaysLater) {
        upcoming.push(c)
      }
    } else {
      completed.push(c)
    }
  }

  // 排序
  // 旅遊中：按開始日期排序
  traveling.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  // 即將出發：按開始日期排序（最近的先）
  upcoming.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  // 已完成：按結束日期倒序（最近完成的先）
  completed.sort((a, b) => {
    const aEnd = a.endDate || a.startDate
    const bEnd = b.endDate || b.startDate
    return new Date(bEnd).getTime() - new Date(aEnd).getTime()
  })

  // 組合結果：旅遊中 + 即將出發 + 已完成，取前 limit 個
  const combined = [...traveling, ...upcoming, ...completed]
  const cases = combined.slice(0, limit)

  return {
    cases,
    total: combined.length,
    year: currentYear,
    availableYears,
  }
}

/**
 * 取得所有歷史案例（按年份分組）
 */
export interface TourCasesGroupedByYear {
  [year: number]: TourCase[]
}

export async function fetchAllTourCasesGroupedByYear(): Promise<{
  grouped: TourCasesGroupedByYear
  years: number[]
}> {
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1]

  const results = await Promise.all(
    years.map(async (year) => ({
      year,
      orders: await fetchNotionOrdersByYear(year),
    }))
  )

  const grouped: TourCasesGroupedByYear = {}

  for (const { year, orders } of results) {
    const cases = orders
      .map(orderToCase)
      .filter((c): c is TourCase => c !== null)
      // 按旅遊日期排序（最新的在前面）
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())

    if (cases.length > 0) {
      grouped[year] = cases
    }
  }

  // 只回傳有資料的年份
  const availableYears = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a) // 新的年份在前

  return { grouped, years: availableYears }
}
