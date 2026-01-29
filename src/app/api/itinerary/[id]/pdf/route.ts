// src/app/api/itinerary/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import puppeteerCore from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'
import { getItineraryById } from '@/lib/sanity/queries'
import { generateItineraryHTML } from '@/lib/pdf/itinerary-template'
import { checkRateLimit, getClientIP } from '@/lib/api-auth'
import { apiLogger } from '@/lib/logger'
import { verifySignedToken, getSigningSecret } from '@/lib/signed-url'

const log = apiLogger.child('itinerary:pdf')

// 禁用 Next.js 路由快取，確保每次都取得最新資料
export const dynamic = 'force-dynamic'

// Vercel serverless 需要更長的執行時間
export const maxDuration = 60

// Chromium 下載 URL (使用官方 CDN)
const CHROMIUM_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting (stricter for PDF generation - resource intensive)
  const clientIP = getClientIP(request)
  const rateLimitError = checkRateLimit(clientIP, 10, 60000) // 10 requests per minute
  if (rateLimitError) return rateLimitError

  let browser = null

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
    const verification = verifySignedToken(id, 'pdf', token, expires, secret)
    if (!verification.valid) {
      log.warn('Invalid token attempt', { id, error: verification.error })
      return NextResponse.json({ error: verification.error || '授權無效' }, { status: 401 })
    }

    // 從 Sanity 取得資料
    const itinerary = await getItineraryById(id)

    log.debug('Generating PDF', { id, daysCount: itinerary?.days?.length })

    if (!itinerary) {
      return NextResponse.json(
        { error: 'Itinerary not found' },
        { status: 404 }
      )
    }

    // 產生 HTML
    const html = generateItineraryHTML(itinerary)

    // 取得 executablePath (從外部 URL 下載)
    const executablePath = await chromium.executablePath(CHROMIUM_URL)
    log.debug('Chromium executable path resolved', { executablePath })

    // 使用 Puppeteer 產生 PDF (支援 Vercel serverless)
    browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: { width: 1200, height: 800 },
      executablePath,
      headless: true,
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    await browser.close()
    browser = null

    // 回傳 PDF
    const filename = `${itinerary.clientName}-行程表.pdf`

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    log.error('PDF generation failed', error)

    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  } finally {
    if (browser) {
      await browser.close().catch((err) => log.error('Failed to close browser', err))
    }
  }
}
