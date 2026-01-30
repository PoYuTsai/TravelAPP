// src/app/api/tours/cases/route.ts

import { NextResponse } from 'next/server'
import { fetchTourCases, fetchRecentTourCases, fetchAllTourCasesGroupedByYear } from '@/lib/notion'
import { apiLogger } from '@/lib/logger'
import { checkRateLimit, getClientIP } from '@/lib/api-auth'

export async function GET(request: Request) {
  // Rate limiting: 30 requests per minute per IP
  const clientIP = getClientIP(request)
  const rateLimitError = checkRateLimit(clientIP, 30, 60000)
  if (rateLimitError) return rateLimitError

  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') // 'recent' | 'history' | null (default)
    const yearParam = searchParams.get('year')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')

    // Mode: recent - 取得最近案例（跨年份，狀態優先排序）
    if (mode === 'recent') {
      const rawLimit = limitParam ? parseInt(limitParam, 10) : 8
      if (isNaN(rawLimit)) {
        return NextResponse.json({ error: '無效的參數格式' }, { status: 400 })
      }
      const limit = Math.min(Math.max(rawLimit, 1), 20)
      const data = await fetchRecentTourCases(limit)
      return NextResponse.json(data)
    }

    // Mode: history - 取得所有歷史案例（按年份分組）
    if (mode === 'history') {
      const data = await fetchAllTourCasesGroupedByYear()
      return NextResponse.json(data)
    }

    // Default mode: 取得指定年份的案例
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
    apiLogger.error('Tours Cases API Error', error)
    return NextResponse.json(
      { error: '無法取得資料' },
      { status: 500 }
    )
  }
}
