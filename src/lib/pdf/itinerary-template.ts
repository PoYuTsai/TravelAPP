// src/lib/pdf/itinerary-template.ts

interface Activity {
  time?: string
  content: string
}

interface DayItem {
  date: string
  title: string
  activities?: Activity[]
  lunch?: string
  dinner?: string
  accommodation?: string
  carPrice?: number
  guidePrice?: number
}

interface ItineraryData {
  clientName: string
  startDate: string
  endDate: string
  adults: number
  children: number
  childrenAges?: string
  days: DayItem[]
  totalPrice?: number
  priceIncludes?: string
  priceExcludes?: string
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[date.getDay()]
  return `${month}/${day} (${weekday})`
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const startMonth = startDate.getMonth() + 1
  const startDay = startDate.getDate()
  const endMonth = endDate.getMonth() + 1
  const endDay = endDate.getDate()
  return `${startDate.getFullYear()}/${startMonth}/${startDay} - ${endMonth}/${endDay}`
}

function formatPeople(adults: number, children: number, childrenAges?: string): string {
  let result = `${adults} 大`
  if (children > 0) {
    result += ` ${children} 小`
    if (childrenAges) {
      result += `（${childrenAges}）`
    }
  }
  return result
}

function parseList(text?: string): string[] {
  if (!text) return []
  return text.split('\n').filter((line) => line.trim()).map((line) => line.replace(/^[-•]\s*/, '').trim())
}

export function generateItineraryHTML(data: ItineraryData): string {
  const { clientName, startDate, endDate, adults, children, childrenAges, days, totalPrice, priceIncludes, priceExcludes } = data

  const includesList = parseList(priceIncludes)
  const excludesList = parseList(priceExcludes)

  // 計算每日費用總和
  const totalCarPrice = days.reduce((sum, day) => sum + (day.carPrice || 0), 0)
  const totalGuidePrice = days.reduce((sum, day) => sum + (day.guidePrice || 0), 0)
  const calculatedTotal = totalCarPrice + totalGuidePrice
  const finalTotal = totalPrice || calculatedTotal

  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Noto Sans TC', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      background: #fff;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      margin: 0 auto;
    }

    /* 封面 */
    .cover {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 257mm;
      text-align: center;
    }

    .cover-logo {
      font-size: 28px;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 10mm;
    }

    .cover-title {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8mm;
    }

    .cover-dates {
      font-size: 18px;
      color: #666;
      margin-bottom: 15mm;
    }

    .cover-client {
      font-size: 20px;
      margin-bottom: 3mm;
    }

    .cover-people {
      font-size: 16px;
      color: #666;
      margin-bottom: 20mm;
    }

    .cover-subtitle {
      font-size: 14px;
      color: #999;
      border-top: 1px solid #ddd;
      padding-top: 5mm;
    }

    /* 每日行程 */
    .day {
      margin-bottom: 10mm;
      page-break-inside: avoid;
    }

    .day-header {
      display: flex;
      align-items: baseline;
      gap: 10px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 3mm;
      margin-bottom: 4mm;
    }

    .day-number {
      font-size: 18px;
      font-weight: 700;
      color: #2563eb;
    }

    .day-date {
      font-size: 14px;
      color: #666;
    }

    .day-title {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 4mm;
    }

    .activities {
      margin-left: 5mm;
    }

    .activity {
      display: flex;
      margin-bottom: 2mm;
    }

    .activity-time {
      width: 15mm;
      color: #666;
      flex-shrink: 0;
    }

    .activity-content {
      flex: 1;
    }

    .meals {
      margin-top: 4mm;
      padding-top: 3mm;
      border-top: 1px dashed #ddd;
      display: flex;
      flex-direction: column;
      gap: 1.5mm;
      font-size: 13px;
    }

    .meal-label {
      color: #666;
      display: inline-block;
      min-width: 12mm;
    }

    /* 費用說明 */
    .pricing {
      margin-top: 10mm;
      page-break-inside: avoid;
    }

    .pricing-title {
      font-size: 18px;
      font-weight: 700;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 3mm;
      margin-bottom: 5mm;
    }

    .total-price {
      font-size: 20px;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 5mm;
    }

    .price-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 5mm;
      font-size: 13px;
    }

    .price-table th,
    .price-table td {
      padding: 2mm 3mm;
      text-align: left;
      border-bottom: 1px solid #eee;
    }

    .price-table th {
      background: #f8fafc;
      font-weight: 500;
      color: #666;
    }

    .price-table td.number {
      text-align: right;
      font-family: monospace;
    }

    .price-table tr.subtotal {
      background: #f8fafc;
      font-weight: 500;
    }

    .price-table tr.total {
      background: #2563eb;
      color: white;
      font-weight: 700;
    }

    .price-section {
      margin-bottom: 5mm;
    }

    .price-section-title {
      font-weight: 500;
      margin-bottom: 2mm;
    }

    .price-list {
      list-style: none;
      margin-left: 5mm;
    }

    .price-list li {
      margin-bottom: 1mm;
    }

    .price-list li::before {
      content: "• ";
      color: #2563eb;
    }

    .payment-note {
      margin-top: 5mm;
      padding: 3mm;
      background: #f0f9ff;
      border-radius: 2mm;
      font-size: 13px;
      color: #0369a1;
    }

    /* 頁尾 */
    .footer {
      margin-top: 15mm;
      padding-top: 5mm;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 12px;
      color: #666;
    }

    .footer-brand {
      font-weight: 500;
      color: #2563eb;
    }

    .footer-contact {
      margin-top: 2mm;
    }
  </style>
</head>
<body>
  <!-- 封面 -->
  <div class="page cover">
    <div class="cover-logo">清微旅行</div>
    <div class="cover-title">清邁親子包車行程</div>
    <div class="cover-dates">${formatDateRange(startDate, endDate)}</div>
    <div class="cover-client">${clientName}</div>
    <div class="cover-people">${formatPeople(adults, children, childrenAges)}</div>
    <div class="cover-subtitle">專屬行程規劃</div>
  </div>

  <!-- 每日行程 -->
  <div class="page">
    ${days.map((day, index) => `
      <div class="day">
        <div class="day-header">
          <span class="day-number">Day ${index + 1}</span>
          <span class="day-date">${formatDate(day.date)}</span>
        </div>
        <div class="day-title">${day.title}</div>
        ${day.activities && day.activities.length > 0 ? `
          <div class="activities">
            ${day.activities.map((act) => `
              <div class="activity">
                <span class="activity-time">${act.time || ''}</span>
                <span class="activity-content">${act.content}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="meals">
          <div><span class="meal-label">午餐：</span>${day.lunch || ''}</div>
          <div><span class="meal-label">晚餐：</span>${day.dinner || ''}</div>
          <div><span class="meal-label">住宿：</span>${day.accommodation || ''}</div>
        </div>
      </div>
    `).join('')}
  </div>

  <!-- 費用說明 -->
  ${finalTotal > 0 || includesList.length > 0 || excludesList.length > 0 ? `
    <div class="page">
      <div class="pricing">
        <div class="pricing-title">費用說明</div>

        ${calculatedTotal > 0 ? `
          <table class="price-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>行程</th>
                <th style="text-align: right;">車費</th>
                <th style="text-align: right;">導遊費</th>
                <th style="text-align: right;">小計</th>
              </tr>
            </thead>
            <tbody>
              ${days.map((day, index) => {
                const dayTotal = (day.carPrice || 0) + (day.guidePrice || 0)
                if (dayTotal === 0) return ''
                return `
                  <tr>
                    <td>Day ${index + 1}</td>
                    <td>${day.title}</td>
                    <td class="number">${day.carPrice ? `NT$${day.carPrice.toLocaleString()}` : '-'}</td>
                    <td class="number">${day.guidePrice ? `NT$${day.guidePrice.toLocaleString()}` : '-'}</td>
                    <td class="number">NT$${dayTotal.toLocaleString()}</td>
                  </tr>
                `
              }).join('')}
              <tr class="subtotal">
                <td colspan="2">小計</td>
                <td class="number">NT$${totalCarPrice.toLocaleString()}</td>
                <td class="number">NT$${totalGuidePrice.toLocaleString()}</td>
                <td class="number">NT$${calculatedTotal.toLocaleString()}</td>
              </tr>
              <tr class="total">
                <td colspan="4">總費用</td>
                <td class="number">NT$${finalTotal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        ` : (finalTotal > 0 ? `<div class="total-price">總費用：NT$${finalTotal.toLocaleString()}</div>` : '')}

        <div class="payment-note">
          付款方式：台幣轉帳
        </div>

        ${includesList.length > 0 ? `
          <div class="price-section">
            <div class="price-section-title">費用包含：</div>
            <ul class="price-list">
              ${includesList.map((item) => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${excludesList.length > 0 ? `
          <div class="price-section">
            <div class="price-section-title">費用不包含：</div>
            <ul class="price-list">
              ${excludesList.map((item) => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>

      <div class="footer">
        <div class="footer-brand">清微旅行 Chiangway Travel</div>
        <div class="footer-contact">LINE: @037nyuwk | chiangway-travel.com</div>
      </div>
    </div>
  ` : ''}
</body>
</html>
  `.trim()
}
