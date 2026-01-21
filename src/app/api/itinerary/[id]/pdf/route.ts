// src/app/api/itinerary/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import puppeteerCore from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { getItineraryById } from '@/lib/sanity/queries'
import { generateItineraryHTML } from '@/lib/pdf/itinerary-template'

// 禁用 Next.js 路由快取，確保每次都取得最新資料
export const dynamic = 'force-dynamic'

// Vercel serverless 需要更長的執行時間
export const maxDuration = 30

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 從 Sanity 取得資料
    const itinerary = await getItineraryById(id)

    // Debug: 印出從 Sanity 取得的資料
    console.log('=== PDF Debug ===')
    console.log('Document ID:', id)
    console.log('Days count:', itinerary?.days?.length)

    if (!itinerary) {
      return NextResponse.json(
        { error: 'Itinerary not found' },
        { status: 404 }
      )
    }

    // 產生 HTML
    const html = generateItineraryHTML(itinerary)

    // 使用 Puppeteer 產生 PDF (支援 Vercel serverless)
    const browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: { width: 1200, height: 800 },
      executablePath: await chromium.executablePath(),
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
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
