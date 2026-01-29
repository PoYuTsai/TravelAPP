// src/app/api/itinerary/[id]/excel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getItineraryById } from '@/lib/sanity/queries'
import { generateItineraryExcel } from '@/lib/excel/itinerary-template'
import { checkRateLimit, getClientIP } from '@/lib/api-auth'
import { apiLogger } from '@/lib/logger'
import { verifySignedToken, getSigningSecret } from '@/lib/signed-url'

const log = apiLogger.child('itinerary:excel')

// 禁用 Next.js 路由快取
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const rateLimitError = checkRateLimit(clientIP, 20, 60000) // 20 requests per minute
  if (rateLimitError) return rateLimitError

  try {
    const { id } = await params

    // Verify signed URL token
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const expires = searchParams.get('expires')

    if (!token || !expires) {
      return NextResponse.json({ error: '缺少授權參數' }, { status: 401 })
    }

    const secret = getSigningSecret()
    const verification = verifySignedToken(id, 'excel', token, expires, secret)
    if (!verification.valid) {
      log.warn('Invalid token attempt', { id, error: verification.error })
      return NextResponse.json({ error: verification.error || '授權無效' }, { status: 401 })
    }

    // 從 Sanity 取得資料
    const itinerary = await getItineraryById(id)

    if (!itinerary) {
      return NextResponse.json(
        { error: 'Itinerary not found' },
        { status: 404 }
      )
    }

    log.debug('Generating Excel', {
      id,
      daysCount: itinerary?.days?.length,
      hotelsCount: itinerary?.hotels?.length,
    })

    // 產生 Excel
    const excel = await generateItineraryExcel(itinerary)

    // 回傳 Excel - 加入時間戳記確保每次都是新檔案
    const now = new Date()
    const timeStr = `${now.getHours()}h${now.getMinutes()}m${now.getSeconds()}s`
    const filename = `${itinerary.clientName}-行程表-${timeStr}.xlsx`
    log.debug('Excel generated', { filename })

    return new NextResponse(new Uint8Array(excel), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    log.error('Excel generation failed', error)
    return NextResponse.json(
      { error: 'Failed to generate Excel' },
      { status: 500 }
    )
  }
}
