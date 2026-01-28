// src/app/api/revalidate/route.ts
// Sanity Webhook 觸發的 On-demand Revalidation

import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

// 設定一個 secret 來驗證 webhook 請求
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET

// 簡易 Rate Limiting（每分鐘最多 10 次）
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 分鐘
const RATE_LIMIT_MAX = 10
const requestLog: number[] = []

function checkRateLimit(): boolean {
  const now = Date.now()
  // 清除過期的請求記錄
  while (requestLog.length > 0 && requestLog[0] < now - RATE_LIMIT_WINDOW) {
    requestLog.shift()
  }
  // 檢查是否超過限制
  if (requestLog.length >= RATE_LIMIT_MAX) {
    return false
  }
  requestLog.push(now)
  return true
}

// Timing-safe secret 比較，防止 timing attack
function isValidSecret(provided: string | null): boolean {
  if (!REVALIDATE_SECRET || !provided) return false
  if (provided.length !== REVALIDATE_SECRET.length) return false
  try {
    return timingSafeEqual(
      Buffer.from(provided),
      Buffer.from(REVALIDATE_SECRET)
    )
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate Limit 檢查
    if (!checkRateLimit()) {
      return NextResponse.json(
        { message: 'Too many requests' },
        {
          status: 429,
          headers: { 'Retry-After': '60' }
        }
      )
    }

    // 驗證 secret（僅支援 Authorization header，安全性更高）
    const headerSecret = request.headers.get('authorization')?.replace('Bearer ', '') ?? null

    if (!isValidSecret(headerSecret)) {
      return NextResponse.json({ message: 'Invalid secret' }, { status: 401 })
    }

    // 解析 Sanity webhook payload
    const body = await request.json().catch(() => ({}))
    const { _type } = body

    // 驗證 _type 是有效的類型
    const validTypes = ['tourPackage', 'dayTour', 'post', 'itinerary']
    const revalidatedPaths: string[] = []

    if (_type && validTypes.includes(_type)) {
      switch (_type) {
        case 'tourPackage':
          revalidatePath('/tours')
          revalidatePath('/tours/[slug]', 'page')
          revalidatePath('/', 'page')
          revalidatedPaths.push('/tours', '/tours/[slug]', '/')
          break

        case 'dayTour':
          revalidatePath('/tours')
          revalidatePath('/tours/[slug]', 'page')
          revalidatePath('/', 'page')
          revalidatedPaths.push('/tours', '/tours/[slug]', '/')
          break

        case 'post':
          revalidatePath('/blog')
          revalidatePath('/blog/[slug]', 'page')
          revalidatePath('/blog/category/[slug]', 'page')
          revalidatePath('/', 'page') // 首頁有精選文章
          revalidatedPaths.push('/blog', '/blog/[slug]', '/blog/category/[slug]', '/')
          break

        case 'itinerary':
          // itinerary 不需要 revalidate 公開頁面
          revalidatedPaths.push('(itinerary - no public pages)')
          break
      }
    } else {
      // 未知類型，revalidate 所有主要頁面
      revalidatePath('/', 'layout')
      revalidatedPaths.push('/ (all)')
    }

    return NextResponse.json({
      revalidated: true,
      type: _type || 'unknown',
      paths: revalidatedPaths,
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json(
      { message: 'Error revalidating' },
      { status: 500 }
    )
  }
}

// GET 方便手動測試
export async function GET(request: NextRequest) {
  // Rate Limit 檢查
  if (!checkRateLimit()) {
    return NextResponse.json(
      { message: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': '60' }
      }
    )
  }

  // 驗證 secret（僅支援 Authorization header，避免 secret 出現在 URL logs）
  const headerSecret = request.headers.get('authorization')?.replace('Bearer ', '') ?? null

  if (!isValidSecret(headerSecret)) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 })
  }

  // 手動 revalidate 所有頁面
  revalidatePath('/', 'layout')

  return NextResponse.json({
    revalidated: true,
    paths: ['/ (all)'],
    timestamp: new Date().toISOString(),
  })
}
