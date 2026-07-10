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
}

interface QuotationItem {
  date?: string | null
  description: string
  unitPrice: number
  quantity: number
  unit?: string
  subtotal?: number
}

interface ItineraryData {
  clientName: string
  startDate: string
  endDate: string
  adults: number
  children: number
  infants?: number
  childrenAges?: string
  days: DayItem[]
  quotationItems?: QuotationItem[]
  quotationTotal?: number
  priceIncludes?: string
  priceExcludes?: string
}

// HTML 轉義函數，防止 XSS 攻擊
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 導出供測試使用
export function formatDate(dateStr: string): string {
  // 使用 T00:00:00 避免時區問題
  const date = new Date(dateStr + 'T00:00:00')
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[date.getDay()]
  return `${month}/${day} (${weekday})`
}

export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  const startMonth = startDate.getMonth() + 1
  const startDay = startDate.getDate()
  const endMonth = endDate.getMonth() + 1
  const endDay = endDate.getDate()
  return `${startDate.getFullYear()}/${startMonth}/${startDay} - ${endMonth}/${endDay}`
}

export function formatPeople(
  adults: number,
  children: number,
  childrenAges?: string,
  infants = 0
): string {
  let result = `${adults} 大`
  if (children > 0) {
    result += ` ${children} 小`
    if (childrenAges) {
      result += `（${childrenAges}）`
    }
  }
  if (infants > 0) {
    result += ` ${infants} 嬰`
  }
  return result
}

export function parseList(text?: string): string[] {
  if (!text) return []
  return text.split('\n').filter((line) => line.trim()).map((line) => line.replace(/^[-•]\s*/, '').trim())
}

function formatThb(amount: number): string {
  return `THB ${amount.toLocaleString('en-US')}`
}

function isCanonicalQuotationItem(item: QuotationItem): boolean {
  return Boolean(
    item &&
    item.description?.trim() &&
    Number.isFinite(item.unitPrice) &&
    item.unitPrice >= 0 &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0
  )
}

export function generateItineraryHTML(data: ItineraryData): string {
  const {
    clientName,
    startDate,
    endDate,
    adults,
    children,
    infants = 0,
    childrenAges,
    days,
    quotationItems: rawQuotationItems = [],
    priceIncludes,
    priceExcludes,
  } = data

  const quotationItems = rawQuotationItems.filter(isCanonicalQuotationItem)
  const hasCanonicalQuote = quotationItems.length > 0
  const calculatedTotal = quotationItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  )
  // The rows are the canonical source of truth. Sanity only warns when the
  // stored aggregate is stale, so trusting quotationTotal could expose a
  // customer-facing total that contradicts the itemized quote.
  const finalTotal = calculatedTotal
  const hasGuide = quotationItems.some((item) => /導遊/.test(item.description))
  const hasInsurance = quotationItems.some((item) => /保險/.test(item.description))
  const matchesSelectedOptions = (item: string) =>
    (!/導遊/.test(item) || hasGuide) && (!/保險/.test(item) || hasInsurance)
  const matchesUnselectedOptions = (item: string) =>
    (!/導遊/.test(item) || !hasGuide) && (!/保險/.test(item) || !hasInsurance)
  const includesList = parseList(priceIncludes).filter(matchesSelectedOptions)
  const excludesList = parseList(priceExcludes).filter(matchesUnselectedOptions)

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

    /* Pricing */
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
    <div class="cover-client">${escapeHtml(clientName)}</div>
    <div class="cover-people">${escapeHtml(formatPeople(adults, children, childrenAges, infants))}</div>
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
        <div class="day-title">${escapeHtml(day.title)}</div>
        ${day.activities && day.activities.length > 0 ? `
          <div class="activities">
            ${day.activities
              .filter((act) => {
                // 過濾掉餐點和住宿（這些會在下方摘要顯示）
                // 移除開頭可能的符號再比對
                const cleaned = act.content.replace(/^[・\-•·]\s*/, '')
                const isMeal = /^(午餐|晚餐|中餐|早餐|lunch|dinner|breakfast)[：:]/i.test(cleaned)
                const isAccommodation = /^(住宿|accommodation|hotel)[：:]/i.test(cleaned)
                return !isMeal && !isAccommodation
              })
              .map((act) => `
              <div class="activity">
                <span class="activity-time">${escapeHtml(act.time || '')}</span>
                <span class="activity-content">${escapeHtml(act.content)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${(day.lunch || day.dinner || day.accommodation) ? `
        <div class="meals">
          ${day.lunch ? `<div><span class="meal-label">午餐：</span>${escapeHtml(day.lunch)}</div>` : ''}
          ${day.dinner ? `<div><span class="meal-label">晚餐：</span>${escapeHtml(day.dinner)}</div>` : ''}
          ${day.accommodation ? `<div><span class="meal-label">住宿：</span>${escapeHtml(day.accommodation)}</div>` : ''}
        </div>
        ` : ''}
      </div>
    `).join('')}
  </div>

  <!-- Pricing is rendered only when canonical quotation items exist. -->
  ${hasCanonicalQuote ? `
    <div class="page">
      <div class="pricing">
        <div class="pricing-title">費用說明</div>

        <table class="price-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>項目</th>
              <th style="text-align: right;">單價</th>
              <th style="text-align: right;">數量</th>
              <th style="text-align: right;">小計</th>
            </tr>
          </thead>
          <tbody>
            ${quotationItems.map((item) => {
              const subtotal = item.unitPrice * item.quantity
              return `
                <tr>
                  <td>${item.date ? escapeHtml(item.date) : '-'}</td>
                  <td>${escapeHtml(item.description)}</td>
                  <td class="number">${formatThb(item.unitPrice)}</td>
                  <td class="number">${item.quantity.toLocaleString('en-US')}${item.unit ? escapeHtml(item.unit) : ''}</td>
                  <td class="number">${formatThb(subtotal)}</td>
                </tr>
              `
            }).join('')}
            <tr class="total">
              <td colspan="4">總費用</td>
              <td class="number">${formatThb(finalTotal)}</td>
            </tr>
          </tbody>
        </table>

        ${includesList.length > 0 ? `
          <div class="price-section">
            <div class="price-section-title">費用包含：</div>
            <ul class="price-list">
              ${includesList.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${excludesList.length > 0 ? `
          <div class="price-section">
            <div class="price-section-title">費用不包含：</div>
            <ul class="price-list">
              ${excludesList.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
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
