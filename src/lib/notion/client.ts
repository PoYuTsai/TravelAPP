// src/lib/notion/client.ts

import type { NotionOrder, DashboardData, DashboardQuery, MonthlyStats, YearComparison } from './types'
import { parseNumberText } from './profit-parser'
import { dbLogger } from '@/lib/logger'

const log = dbLogger.child('notion')

const NOTION_TOKEN = process.env.NOTION_TOKEN

// 資料庫 ID 對應表
const DATABASE_IDS: Record<number, string> = {
  2025: '15c37493475d80a5aa89ef025244dc7b',
  2026: '26037493475d80baa727dd3323f2aad8',
}

// 可用年份
const AVAILABLE_YEARS = [2025, 2026]

if (!NOTION_TOKEN) {
  log.warn('NOTION_TOKEN 未設定')
}

function extractYearMonth(dateValue: { start: string; end?: string | null } | null): { year: number; month: number } | null {
  if (!dateValue?.start) return null
  const match = dateValue.start.match(/(\d{4})[-\/](\d{2})/)
  if (match) {
    return { year: parseInt(match[1]), month: parseInt(match[2]) }
  }
  return null
}

// In-memory cache for Notion data
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache
const MAX_CACHE_SIZE = 50 // 最多快取 50 筆，避免記憶體無限增長

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T
  }
  // 清除過期的快取
  if (entry) {
    cache.delete(key)
  }
  return null
}

function setCache<T>(key: string, data: T): void {
  // 如果達到上限，移除最舊的項目（Map 保持插入順序）
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value
    if (oldestKey) {
      cache.delete(oldestKey)
    }
  }
  cache.set(key, { data, timestamp: Date.now() })
}

/**
 * 直接呼叫 Notion REST API 查詢資料庫
 * @param databaseId - Notion 資料庫 ID
 * @param startCursor - 分頁游標
 * @param sorts - 排序設定 (保留 Notion 手動排序)
 */
async function queryNotionDatabase(
  databaseId: string,
  startCursor?: string,
  sorts?: Array<{ timestamp: string; direction: 'ascending' | 'descending' }>
): Promise<any> {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      page_size: 100,
      ...(startCursor ? { start_cursor: startCursor } : {}),
      // Sort by created_time ascending to preserve manual order in Notion
      ...(sorts ? { sorts } : {}),
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Notion API 錯誤')
  }

  return response.json()
}

/**
 * 從指定年份的資料庫取得訂單 (with caching)
 */
export async function fetchNotionOrdersByYear(year: number): Promise<NotionOrder[]> {
  if (!NOTION_TOKEN) {
    throw new Error('Notion token not configured')
  }

  const databaseId = DATABASE_IDS[year]
  if (!databaseId) {
    log.warn(`找不到 ${year} 年的資料庫`, { year })
    return []
  }

  // Check cache first
  const cacheKey = `orders_${year}`
  const cached = getCached<NotionOrder[]>(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const pages: any[] = []
    let cursor: string | undefined = undefined

    do {
      // Don't specify sort - let Notion return in its default/manual order
      const response = await queryNotionDatabase(databaseId, cursor)
      pages.push(...response.results)
      cursor = response.has_more ? response.next_cursor : undefined
    } while (cursor)

    const orders = pages.map((page: any) => {
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

    // Cache the result
    setCache(cacheKey, orders)
    return orders
  } catch (error) {
    log.error(`無法取得 ${year} 年的資料`, error instanceof Error ? error : new Error(String(error)), { year })
    return []
  }
}

/**
 * 取得所有年份的家庭總數 (for 114+ families display)
 */
export async function fetchTotalFamilyCount(): Promise<number> {
  // Check cache first
  const cacheKey = 'total_family_count'
  const cached = getCached<number>(cacheKey)
  if (cached !== null) {
    return cached
  }

  try {
    const allYearData = await fetchAllOrders()
    let total = 0

    for (const { orders } of allYearData) {
      // Count unique customers with valid names and travel dates
      for (const order of orders) {
        if (order.customerName && order.travelDate?.start) {
          total++
        }
      }
    }

    // If no data found, use fallback (Notion token might not be configured)
    if (total === 0) {
      return 114
    }

    // Cache the result
    setCache(cacheKey, total)
    return total
  } catch (error) {
    log.error('無法取得家庭總數', error instanceof Error ? error : new Error(String(error)))
    return 114 // Fallback to default
  }
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
