// src/app/api/revalidate/route.ts
// Sanity Webhook 觸發的 On-demand Revalidation

import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

// 設定一個 secret 來驗證 webhook 請求
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET

export async function POST(request: NextRequest) {
  try {
    // 驗證 secret
    const secret = request.nextUrl.searchParams.get('secret')
    if (REVALIDATE_SECRET && secret !== REVALIDATE_SECRET) {
      return NextResponse.json({ message: 'Invalid secret' }, { status: 401 })
    }

    // 解析 Sanity webhook payload
    const body = await request.json().catch(() => ({}))
    const { _type } = body

    // 根據更新的內容類型，revalidate 對應的頁面
    const revalidatedPaths: string[] = []

    switch (_type) {
      case 'tourPackage':
        revalidatePath('/tours')
        revalidatePath('/tours/[slug]', 'page')
        revalidatePath('/', 'page') // 首頁的 ToursPreview
        revalidatedPaths.push('/tours', '/tours/[slug]', '/')
        break

      case 'dayTour':
        revalidatePath('/tours')
        revalidatePath('/day-tours/[slug]', 'page')
        revalidatedPaths.push('/tours', '/day-tours/[slug]')
        break

      case 'post':
        revalidatePath('/blog')
        revalidatePath('/blog/[slug]', 'page')
        revalidatedPaths.push('/blog', '/blog/[slug]')
        break

      default:
        // 如果不確定類型，revalidate 所有主要頁面
        revalidatePath('/', 'layout')
        revalidatedPaths.push('/ (all)')
    }

    console.log(`[Revalidate] Type: ${_type}, Paths: ${revalidatedPaths.join(', ')}`)

    return NextResponse.json({
      revalidated: true,
      type: _type,
      paths: revalidatedPaths,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Revalidate] Error:', error)
    return NextResponse.json(
      { message: 'Error revalidating', error: String(error) },
      { status: 500 }
    )
  }
}

// 也支援 GET 方便手動測試
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (REVALIDATE_SECRET && secret !== REVALIDATE_SECRET) {
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
