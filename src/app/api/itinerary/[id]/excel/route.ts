// src/app/api/itinerary/[id]/excel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getItineraryById } from '@/lib/sanity/queries'
import { generateItineraryExcel } from '@/lib/excel/itinerary-template'
import { validateApiKey, checkRateLimit, getClientIP } from '@/lib/api-auth'

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

  // API key validation
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const { id } = await params

    // 從 Sanity 取得資料
    const itinerary = await getItineraryById(id)

    if (!itinerary) {
      return NextResponse.json(
        { error: 'Itinerary not found' },
        { status: 404 }
      )
    }

    // Debug log
    console.log('=== Excel Debug ===')
    console.log('Document ID:', id)
    console.log('Days count:', itinerary?.days?.length)
    console.log('Hotels count:', itinerary?.hotels?.length)

    // 產生 Excel
    const excel = await generateItineraryExcel(itinerary)

    // 回傳 Excel - 加入時間戳記確保每次都是新檔案
    const now = new Date()
    const timeStr = `${now.getHours()}h${now.getMinutes()}m${now.getSeconds()}s`
    const filename = `${itinerary.clientName}-行程表-${timeStr}.xlsx`
    console.log('Generated filename:', filename)

    return new NextResponse(new Uint8Array(excel), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Excel generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate Excel' },
      { status: 500 }
    )
  }
}
