// src/lib/notion/client.ts

import { Client } from '@notionhq/client'
import type { NotionOrder, DashboardData, DashboardQuery, MonthlyStats, YearComparison } from './types'
import { parseNumberText } from './profit-parser'

const NOTION_TOKEN = process.env.NOTION_TOKEN

// 資料庫 ID 對應表
const DATABASE_IDS: Record<number, string> = {
  2025: '15c37493475d80a5aa89ef025244dc7b',
  2026: '26037493475d8115bb53000ba2f98287',
}

// 可用年份
const AVAILABLE_YEARS = [2025, 2026]

if (!NOTION_TOKEN) {
  console.warn('NOTION_TOKEN 未設定')
}

const notion = NOTION_TOKEN ? new Client({ auth: NOTION_TOKEN }) : null

function extractYearMonth(dateValue: { start: string; end?: string | null } | null): { year: number; month: number } | null {
  if (!dateValue?.start) return null
  const match = dateValue.start.match(/(\d{4})[-\/](\d{2})/)
  if (match) {
    return { year: parseInt(match[1]), month: parseInt(match[2]) }
  }
  return null
}

/**
 * 從指定年份的資料庫取得訂單
 */
export async function fetchNotionOrdersByYear(year: number): Promise<NotionOrder[]> {
  if (!notion) {
    throw new Error('Notion client not initialized')
  }

  const databaseId = DATABASE_IDS[year]
  if (!databaseId) {
    console.warn(`找不到 ${year} 年的資料庫`)
    return []
  }

  const pages: any[] = []
  let cursor: string | undefined = undefined

  do {
    const response = await notion.dataSources.query({
      data_source_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    })
    pages.push(...response.results)
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (cursor)

  return pages.map((page: any) => {
    const props = page.properties

    const customerName = props['客戶名稱']?.title?.[0]?.plain_text || ''
    const travelDate = props['旅遊日期']?.date || null
    const travelers = props['旅遊人數']?.rich_text?.[0]?.plain_text || ''
    const profitRaw = props['利潤']?.rich_text?.[0]?.plain_text || ''
    const profit = parseNumberText(profitRaw)
    const revenueRaw = props['總收入']?.rich_text?.[0]?.plain_text || ''
    const revenue = parseNumberText(revenueRaw)
    const paymentStatus = props['支付狀態']?.status?.name || ''
    const updateStatus = props['更新進度']?.status?.name || ''

    return {
      id: page.id,
      customerName,
      travelDate,
      travelers,
      profit: { raw: profitRaw, ...profit },
      revenue: { raw: revenueRaw, ...revenue },
      paymentStatus,
      updateStatus,
    }
  })
}

/**
 * 取得所有年份的訂單
 */
export async function fetchAllOrders(): Promise<{ year: number; orders: NotionOrder[] }[]> {
  const results = await Promise.all(
    AVAILABLE_YEARS.map(async (year) => ({
      year,
      orders: await fetchNotionOrdersByYear(year),
    }))
  )
  return results
}

/**
 * 計算年度月趨勢（指定年份的 12 個月）
 */
function calculateYearlyTrend(orders: NotionOrder[], year: number): MonthlyStats[] {
  const monthlyStats: Record<number, { profit: number; count: number }> = {}

  // 初始化 12 個月
  for (let m = 1; m <= 12; m++) {
    monthlyStats[m] = { profit: 0, count: 0 }
  }

  for (const order of orders) {
    const ym = extractYearMonth(order.travelDate)
    if (ym && ym.year === year) {
      monthlyStats[ym.month].profit += order.profit.value
      monthlyStats[ym.month].count += 1
    }
  }

  return Object.entries(monthlyStats).map(([month, stats]) => ({
    month: `${year}-${month.padStart(2, '0')}`,
    profit: stats.profit,
    count: stats.count,
  }))
}

/**
 * 計算年度比較（累計到指定月份）
 */
function calculateYearComparison(
  currentYearOrders: NotionOrder[],
  lastYearOrders: NotionOrder[],
  currentYear: number,
  upToMonth: number
): YearComparison {
  let currentYearProfit = 0
  let currentYearCount = 0
  let lastYearProfit = 0
  let lastYearCount = 0

  // 計算今年累計（1月到指定月份）
  for (const order of currentYearOrders) {
    const ym = extractYearMonth(order.travelDate)
    if (ym && ym.year === currentYear && ym.month <= upToMonth) {
      currentYearProfit += order.profit.value
      currentYearCount += 1
    }
  }

  // 計算去年同期累計
  const lastYear = currentYear - 1
  for (const order of lastYearOrders) {
    const ym = extractYearMonth(order.travelDate)
    if (ym && ym.year === lastYear && ym.month <= upToMonth) {
      lastYearProfit += order.profit.value
      lastYearCount += 1
    }
  }

  // 計算成長率
  let growthPercent: number | null = null
  if (lastYearProfit > 0) {
    growthPercent = Math.round(((currentYearProfit - lastYearProfit) / lastYearProfit) * 100)
  }

  return {
    currentYear,
    currentYearProfit,
    currentYearCount,
    lastYear,
    lastYearProfit,
    lastYearCount,
    growthPercent,
  }
}

/**
 * 取得 Dashboard 資料
 */
export async function fetchDashboardData(query?: DashboardQuery): Promise<DashboardData> {
  const now = new Date()
  const selectedYear = query?.year || now.getFullYear()
  const selectedMonth = query?.month || (now.getMonth() + 1)

  // 取得選擇年份和去年的資料
  const [currentYearOrders, lastYearOrders] = await Promise.all([
    fetchNotionOrdersByYear(selectedYear),
    fetchNotionOrdersByYear(selectedYear - 1),
  ])

  // 計算選擇月份的數據
  let monthlyProfit = 0
  let monthlyOrderCount = 0
  let hasUncertainValues = false

  for (const order of currentYearOrders) {
    const ym = extractYearMonth(order.travelDate)
    if (ym && ym.year === selectedYear && ym.month === selectedMonth) {
      monthlyProfit += order.profit.value
      monthlyOrderCount += 1
      if (!order.profit.confident) {
        hasUncertainValues = true
      }
    }
  }

  // 待收款（從所有年份）
  const allOrders = [...currentYearOrders, ...lastYearOrders]
  let pendingPayment = 0
  let pendingPaymentCount = 0
  const pendingOrders: NotionOrder[] = []

  for (const order of allOrders) {
    if (order.paymentStatus === '未付款') {
      pendingPayment += order.profit.value
      pendingPaymentCount += 1
      pendingOrders.push(order)
    }
  }

  // 年度比較
  const yearComparison = calculateYearComparison(
    currentYearOrders,
    lastYearOrders,
    selectedYear,
    selectedMonth
  )

  // 年度月趨勢
  const yearlyTrend = calculateYearlyTrend(currentYearOrders, selectedYear)

  return {
    selectedYear,
    selectedMonth,
    monthlyProfit,
    monthlyOrderCount,
    hasUncertainValues,
    pendingPayment,
    pendingPaymentCount,
    pendingOrders,
    yearComparison,
    yearlyTrend,
    availableYears: AVAILABLE_YEARS,
    lastUpdated: new Date().toISOString(),
  }
}

// 向後相容：保留舊函數
export async function fetchNotionOrders(): Promise<NotionOrder[]> {
  const currentYear = new Date().getFullYear()
  return fetchNotionOrdersByYear(currentYear)
}
