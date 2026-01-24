// src/app/api/dashboard/route.ts

import { NextResponse } from 'next/server'
import { fetchDashboardData } from '@/lib/notion'
import type { DashboardQuery } from '@/lib/notion'
import { validateDashboardAccess, checkRateLimit, getClientIP } from '@/lib/api-auth'
import { apiLogger } from '@/lib/logger'

const log = apiLogger.child('dashboard')

export async function GET(request: Request) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const rateLimitError = checkRateLimit(clientIP, 60, 60000) // 60 requests per minute
  if (rateLimitError) return rateLimitError

  // Dashboard access validation (email whitelist)
  const authError = validateDashboardAccess(request)
  if (authError) return authError

  try {
    // 解析查詢參數
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')

    const query: DashboardQuery = {}
    if (yearParam) {
      const year = parseInt(yearParam, 10)
      if (isNaN(year) || year < 2020 || year > 2100) {
        return NextResponse.json(
          { error: '無效的年份參數', code: 'INVALID_YEAR' },
          { status: 400 }
        )
      }
      query.year = year
    }
    if (monthParam) {
      const month = parseInt(monthParam, 10)
      if (isNaN(month) || month < 1 || month > 12) {
        return NextResponse.json(
          { error: '無效的月份參數', code: 'INVALID_MONTH' },
          { status: 400 }
        )
      }
      query.month = month
    }

    log.debug('Fetching dashboard data', { query, clientIP })
    const data = await fetchDashboardData(query)
    return NextResponse.json(data)
  } catch (error) {
    log.error('Failed to fetch dashboard data', error, { clientIP })
    return NextResponse.json(
      { error: '無法取得資料' },
      { status: 500 }
    )
  }
}
