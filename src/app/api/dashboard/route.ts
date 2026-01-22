// src/app/api/dashboard/route.ts

import { NextResponse } from 'next/server'
import { fetchDashboardData } from '@/lib/notion'
import type { DashboardQuery } from '@/lib/notion'

// Email 白名單
const ALLOWED_EMAILS: string[] = [
  // 在此加入允許存取的 Email
  // 'eric@example.com',
  // 'min@example.com',
]

export async function GET(request: Request) {
  try {
    // 從 header 取得使用者 email（由 Sanity 傳入）
    const userEmail = request.headers.get('x-user-email')

    // 白名單檢查（如果白名單為空，允許所有人）
    if (ALLOWED_EMAILS.length > 0) {
      if (!userEmail || !ALLOWED_EMAILS.includes(userEmail)) {
        return NextResponse.json(
          { error: '無權限存取 Dashboard' },
          { status: 403 }
        )
      }
    }

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
