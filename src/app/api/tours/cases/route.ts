// src/app/api/tours/cases/route.ts

import { NextResponse } from 'next/server'
import { fetchTourCases } from '@/lib/notion'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')

    const currentYear = new Date().getFullYear()
    const year = yearParam ? parseInt(yearParam, 10) : currentYear
    const limit = limitParam ? parseInt(limitParam, 10) : 20
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0

    // 驗證年份範圍
    if (year < 2025 || year > currentYear + 1) {
      return NextResponse.json(
        { error: '無效的年份' },
        { status: 400 }
      )
    }

    const data = await fetchTourCases(year, limit, offset)

    return NextResponse.json(data)
  } catch (error) {
    console.error('Tours Cases API Error:', error)
    return NextResponse.json(
      { error: '無法取得資料' },
      { status: 500 }
    )
  }
}
