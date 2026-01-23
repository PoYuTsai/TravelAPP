// src/app/api/itinerary/[id]/text/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/client'
import { sanityToLineText } from '@/lib/itinerary-parser'
import { validateApiKey, checkRateLimit, getClientIP } from '@/lib/api-auth'

const query = `*[_type == "itinerary" && _id == $id][0]{
  _id,
  clientName,
  startDate,
  endDate,
  adults,
  children,
  days[]{
    date,
    title,
    morning,
    afternoon,
    evening,
    lunch,
    dinner
  },
  hotels[]{
    hotelName,
    startDate,
    endDate,
    guests
  }
}`

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const clientIP = getClientIP(request)
  const rateLimitError = checkRateLimit(clientIP, 30, 60000) // 30 requests per minute
  if (rateLimitError) return rateLimitError

  // API key validation
  const authError = validateApiKey(request)
  if (authError) return authError

  try {
    const { id } = await params

    const itinerary = await client.fetch(query, { id }, { cache: 'no-store' })

    if (!itinerary) {
      return new NextResponse('找不到行程', { status: 404 })
    }

    // 產生 LINE 格式文字
    const text = sanityToLineText(itinerary)

    // 加入飯店資訊
    let hotelText = ''
    if (itinerary.hotels && itinerary.hotels.length > 0) {
      hotelText = '\n\n【住宿安排】\n'
      itinerary.hotels.forEach((hotel: any) => {
        const start = hotel.startDate?.replace(/-/g, '/').substring(5)
        const end = hotel.endDate?.replace(/-/g, '/').substring(5)
        hotelText += `${hotel.hotelName}：${start} ~ ${end}`
        if (hotel.guests) hotelText += ` (${hotel.guests})`
        hotelText += '\n'
      })
    }

    // 加入人數資訊
    let peopleText = ''
    if (itinerary.adults || itinerary.children) {
      peopleText = `\n人數：${itinerary.adults || 0}大${itinerary.children || 0}小\n`
    }

    const fullText = text + hotelText + peopleText

    // 回傳純文字 HTML（方便複製）
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${itinerary.clientName || '行程'} - LINE 文字</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0;
      font-size: 18px;
    }
    button {
      background: #06c755;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover {
      background: #05b34a;
    }
    .copied {
      background: #333 !important;
    }
    pre {
      background: white;
      padding: 20px;
      border-radius: 8px;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 14px;
      line-height: 1.6;
      border: 1px solid #ddd;
    }
    .tip {
      margin-top: 15px;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 ${itinerary.clientName || '行程'} - LINE 格式</h1>
    <button onclick="copyText()" id="copyBtn">複製全部</button>
  </div>
  <pre id="content">${fullText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  <p class="tip">💡 點擊「複製全部」後，直接貼到 LINE 記事本即可</p>
  <script>
    function copyText() {
      const text = document.getElementById('content').innerText;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.textContent = '已複製 ✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = '複製全部';
          btn.classList.remove('copied');
        }, 2000);
      });
    }
  </script>
</body>
</html>
`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('匯出文字失敗:', error)
    return new NextResponse('匯出失敗', { status: 500 })
  }
}
