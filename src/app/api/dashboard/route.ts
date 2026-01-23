// src/app/api/dashboard/route.ts

import { NextResponse } from 'next/server'
import { fetchDashboardData } from '@/lib/notion'
import type { DashboardQuery } from '@/lib/notion'
import { validateDashboardAccess, checkRateLimit, getClientIP } from '@/lib/api-auth'

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
      query.year = parseInt(yearParam, 10)
    }
    if (monthParam) {
      query.month = parseInt(monthParam, 10)
    }

    const data = await fetchDashboardData(query)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Dashboard API Error:', error)
    return NextResponse.json(
      { error: '無法取得資料' },
      { status: 500 }
    )
  }
}
