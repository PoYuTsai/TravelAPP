// src/app/api/dashboard/route.ts

import { NextResponse } from 'next/server'
import { fetchDashboardData } from '@/lib/notion'

// Email 白名單
const ALLOWED_EMAILS = [
  // 在此加入允許存取的 Email
  // 'eric@example.com',
  // 'min@example.com',
]

export async function GET(request: Request) {
  try {
    // 從 header 取得使用者 email（由 Sanity 傳入）
    const userEmail = request.headers.get('x-user-email')

    // 白名單檢查（如果白名單為空，允許所有人）
    if (ALLOWED_EMAILS.length > 0 && userEmail) {
      if (!ALLOWED_EMAILS.includes(userEmail)) {
        return NextResponse.json(
          { error: '無權限存取 Dashboard' },
          { status: 403 }
        )
      }
    }

    const data = await fetchDashboardData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Dashboard API Error:', error)
    return NextResponse.json(
      { error: '無法取得資料' },
      { status: 500 }
    )
  }
}
