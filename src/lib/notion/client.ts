// src/lib/notion/client.ts

import { Client } from '@notionhq/client'
import type { NotionOrder, DashboardData } from './types'
import { parseNumberText } from './profit-parser'

const NOTION_TOKEN = process.env.NOTION_TOKEN
const DATABASE_ID = process.env.NOTION_DATABASE_ID || '26037493-475d-8115-bb53-000ba2f98287'

if (!NOTION_TOKEN) {
  console.warn('NOTION_TOKEN 未設定')
}

const notion = NOTION_TOKEN ? new Client({ auth: NOTION_TOKEN }) : null

function extractMonth(dateValue: { start: string; end?: string | null } | null): string | null {
  if (!dateValue?.start) return null
  const match = dateValue.start.match(/(\d{4})[-\/](\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}`
  }
  return null
}

export async function fetchNotionOrders(): Promise<NotionOrder[]> {
  if (!notion) {
    throw new Error('Notion client not initialized')
  }

  const pages: any[] = []
  let cursor: string | undefined = undefined

  do {
    // Notion SDK v5 uses dataSources.query instead of databases.query
    const response = await notion.dataSources.query({
      data_source_id: DATABASE_ID,
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

export async function fetchDashboardData(): Promise<DashboardData> {
  const orders = await fetchNotionOrders()

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  let monthlyProfit = 0
  let monthlyOrderCount = 0
  let hasUncertainValues = false
  let pendingPayment = 0
  let pendingPaymentCount = 0
  const pendingOrders: NotionOrder[] = []
  const monthlyStats: Record<string, { profit: number; count: number }> = {}

  for (const order of orders) {
    const month = extractMonth(order.travelDate)

    if (month) {
      if (!monthlyStats[month]) {
        monthlyStats[month] = { profit: 0, count: 0 }
      }
      monthlyStats[month].profit += order.profit.value
      monthlyStats[month].count += 1

      if (month === currentMonth) {
        monthlyProfit += order.profit.value
        monthlyOrderCount += 1
        if (!order.profit.confident) {
          hasUncertainValues = true
        }
      }
    }

    if (order.paymentStatus === '未付款') {
      pendingPayment += order.profit.value
      pendingPaymentCount += 1
      pendingOrders.push(order)
    }
  }

  const sortedMonths = Object.keys(monthlyStats).sort().slice(-6)
  const monthlyTrend = sortedMonths.map(month => ({
    month,
    profit: monthlyStats[month].profit,
    count: monthlyStats[month].count,
  }))

  return {
    monthlyProfit,
    monthlyOrderCount,
    pendingPayment,
    pendingPaymentCount,
    pendingOrders,
    monthlyTrend,
    lastUpdated: new Date().toISOString(),
    hasUncertainValues,
  }
}
