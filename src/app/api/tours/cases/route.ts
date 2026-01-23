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
    const rawLimit = limitParam ? parseInt(limitParam, 10) : 20
    const rawOffset = offsetParam ? parseInt(offsetParam, 10) : 0

    // 驗證並限制參數範圍
    if (isNaN(year) || isNaN(rawLimit) || isNaN(rawOffset)) {
      return NextResponse.json(
        { error: '無效的參數格式' },
        { status: 400 }
      )
    }

    // 年份範圍驗證
    if (year < 2025 || year > currentYear + 1) {
      return NextResponse.json(
        { error: '無效的年份' },
        { status: 400 }
      )
    }

    // 限制 limit 和 offset 範圍（防止過大查詢）
    const limit = Math.min(Math.max(rawLimit, 1), 100)
    const offset = Math.max(rawOffset, 0)

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
