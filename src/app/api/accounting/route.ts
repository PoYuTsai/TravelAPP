// src/app/api/accounting/route.ts

import { NextResponse } from 'next/server'
import { validateDashboardAccess, checkRateLimit, getClientIP } from '@/lib/api-auth'
import { apiLogger } from '@/lib/logger'
import type { OrderCost, AccountingQuery } from '@/lib/accounting'

const log = apiLogger.child('accounting')

const NOTION_TOKEN = process.env.NOTION_TOKEN

// 資料庫 ID 對應表
const DATABASE_IDS: Record<number, string> = {
  2025: '15c37493475d80a5aa89ef025244dc7b',
  2026: '26037493475d80baa727dd3323f2aad8',
}

/**
 * 解析成本文字
 * 優先找明確的總計，否則嘗試計算
 */
function parseCostText(text: string): { value: number; confident: boolean; warning?: string } {
  if (!text || text.trim() === '') {
    return { value: 0, confident: true }
  }

  const cleanText = text.trim()

  // 檢查是否有不確定的關鍵字
  const hasUncertainty = /不知道|可能|special case|待確認|到時付/.test(cleanText)

  // 規則 1：找最後一個明確的「= 數字」或「共: 數字」
  const totalPatterns = [
    /=\s*([\d,]+)\s*$/m,                    // = 數字（在行尾）
    /共[：:]\s*([\d,]+)/g,                   // 共: 數字
    /total[：:]\s*([\d,]+)/gi,              // total: 數字
    /成本總共[：:][^=]*=\s*([\d,]+)/g,      // 成本總共: ... = 數字
  ]

  // 檢查是否有「以上調整」，如果有則找調整後的值
  const hasAdjustment = /以上調整|調整後/.test(cleanText)
  let textToSearch = cleanText

  if (hasAdjustment) {
    // 找「以上調整」之後的文字
    const adjustmentIndex = cleanText.search(/以上調整|調整後/)
    if (adjustmentIndex !== -1) {
      textToSearch = cleanText.substring(adjustmentIndex)
    }
  }

  // 嘗試各種模式
  for (const pattern of totalPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags)
    const matches: RegExpExecArray[] = []
    let match: RegExpExecArray | null
    while ((match = regex.exec(textToSearch)) !== null) {
      matches.push(match)
      if (!pattern.flags.includes('g')) break
    }
    if (matches.length > 0) {
      // 取最後一個匹配
      const lastMatch = matches[matches.length - 1]
      const value = parseInt(lastMatch[1].replace(/,/g, ''), 10)
      if (!isNaN(value) && value > 0) {
        return {
          value,
          confident: !hasUncertainty,
          warning: hasUncertainty ? '含不確定描述' : undefined,
        }
      }
    }
  }

  // 規則 2：找最後一行的獨立數字
  const lines = cleanText.split('\n').filter(l => l.trim())
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    // 檢查是否是純數字行（可能有千分位）
    const pureNumberMatch = line.match(/^([\d,]+)$/)
    if (pureNumberMatch) {
      const value = parseInt(pureNumberMatch[1].replace(/,/g, ''), 10)
      if (!isNaN(value) && value > 0) {
        return {
          value,
          confident: !hasUncertainty,
          warning: hasUncertainty ? '含不確定描述' : undefined,
        }
      }
    }
  }

  // 規則 3：嘗試找「= 數字+數字」的格式並計算
  const additionMatch = cleanText.match(/=\s*([\d,]+)\s*\+\s*([\d,]+)(?:\s*\+\s*([\d,]+))?/)
  if (additionMatch) {
    let sum = 0
    for (let i = 1; i < additionMatch.length; i++) {
      if (additionMatch[i]) {
        sum += parseInt(additionMatch[i].replace(/,/g, ''), 10) || 0
      }
    }
    if (sum > 0) {
      return {
        value: sum,
        confident: false,
        warning: '由算式計算',
      }
    }
  }

  // 規則 4：嘗試解析開頭的簡單算式
  const simpleCalcMatch = cleanText.match(/^([\d,]+)\s*[\+]\s*([\d,]+)/)
  if (simpleCalcMatch) {
    const a = parseInt(simpleCalcMatch[1].replace(/,/g, ''), 10) || 0
    const b = parseInt(simpleCalcMatch[2].replace(/,/g, ''), 10) || 0
    if (a > 0 && b > 0) {
      return {
        value: a + b,
        confident: false,
        warning: '由算式推算',
      }
    }
  }

  // 找不到，回傳 0
  return {
    value: 0,
    confident: false,
    warning: '無法解析',
  }
}

/**
 * 從 Notion 取得指定日期範圍的訂單成本
 */
async function fetchOrderCosts(query: AccountingQuery): Promise<OrderCost[]> {
  if (!NOTION_TOKEN) {
    throw new Error('Notion token not configured')
  }

  const startYear = parseInt(query.startDate.substring(0, 4), 10)
  const endYear = parseInt(query.endDate.substring(0, 4), 10)

  // 收集需要查詢的年份
  const yearsToQuery: number[] = []
  for (let year = startYear; year <= endYear; year++) {
    if (DATABASE_IDS[year] && !yearsToQuery.includes(year)) {
      yearsToQuery.push(year)
    }
  }

  const allOrders: OrderCost[] = []

  for (const year of yearsToQuery) {
    const databaseId = DATABASE_IDS[year]

    try {
      let cursor: string | undefined = undefined
      let hasMore = true

      while (hasMore) {
        const response: Response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            page_size: 100,
            ...(cursor ? { start_cursor: cursor } : {}),
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Notion API 錯誤')
        }

        const data: { results: any[]; has_more: boolean; next_cursor?: string } = await response.json()

        for (const page of data.results) {
          const props = page.properties

          const customerName = props['客戶名稱']?.title?.[0]?.plain_text || ''
          const travelDate = props['旅遊日期']?.date?.start || ''
          const costRaw = props['總成本']?.rich_text?.[0]?.plain_text || ''

          // 檢查日期是否在範圍內
          if (travelDate && travelDate >= query.startDate && travelDate <= query.endDate) {
            const parsed = parseCostText(costRaw)

            allOrders.push({
              id: page.id,
              customerName,
              travelDate,
              costRaw,
              costValue: parsed.value,
              confident: parsed.confident,
              warning: parsed.warning,
            })
          }
        }

        cursor = data.has_more ? data.next_cursor : undefined
        hasMore = data.has_more && !!cursor
      }
    } catch (error) {
      log.error(`無法取得 ${year} 年的資料`, error, { year })
    }
  }

  // 按日期排序
  allOrders.sort((a, b) => a.travelDate.localeCompare(b.travelDate))

  return allOrders
}

export async function POST(request: Request) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const rateLimitError = checkRateLimit(clientIP, 30, 60000) // 30 requests per minute
  if (rateLimitError) return rateLimitError

  // Dashboard access validation (同樣的白名單)
  const authError = validateDashboardAccess(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { startDate, endDate } = body as AccountingQuery

    // 驗證參數
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '需要起始日期和結束日期', code: 'MISSING_DATES' },
        { status: 400 }
      )
    }

    // 驗證日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: '日期格式錯誤，需要 YYYY-MM-DD', code: 'INVALID_DATE_FORMAT' },
        { status: 400 }
      )
    }

    // 驗證日期順序
    if (startDate >= endDate) {
      return NextResponse.json(
        { error: '起始日期必須早於結束日期', code: 'INVALID_DATE_RANGE' },
        { status: 400 }
      )
    }

    log.debug('Fetching order costs', { startDate, endDate, clientIP })

    const orders = await fetchOrderCosts({ startDate, endDate })

    return NextResponse.json({
      orders,
      totalCost: orders.reduce((sum, o) => sum + o.costValue, 0),
      hasUncertainCosts: orders.some(o => !o.confident),
    })
  } catch (error) {
    log.error('Failed to fetch order costs', error, { clientIP })
    return NextResponse.json(
      { error: '無法取得資料' },
      { status: 500 }
    )
  }
}
