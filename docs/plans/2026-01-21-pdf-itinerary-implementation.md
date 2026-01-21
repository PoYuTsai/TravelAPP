# PDF 行程表產生器 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立 Sanity CMS 行程表管理 + PDF 匯出功能，讓業務可以快速複製舊行程、調整後匯出 PDF 給客戶。

**Architecture:**
- 在 Sanity 新增 `itinerary` 文件類型，存放結構化的行程資料
- 使用 Puppeteer 將 HTML 模板渲染成 PDF（比 @react-pdf/renderer 更容易控制中文字體）
- 建立 API endpoint `/api/itinerary/[id]/pdf` 接收 Sanity 文件 ID，回傳 PDF 檔案

**Tech Stack:** Next.js 14, Sanity v3, Puppeteer, Tailwind CSS

---

## Task 1: 建立 Sanity Itinerary Schema

**Files:**
- Create: `src/sanity/schemas/itinerary.ts`
- Modify: `src/sanity/schemas/index.ts`

**Step 1: 建立 itinerary schema 檔案**

```typescript
// src/sanity/schemas/itinerary.ts
import { defineType, defineField, defineArrayMember } from 'sanity'

export default defineType({
  name: 'itinerary',
  title: '行程表',
  type: 'document',
  groups: [
    { name: 'basic', title: '基本資訊', default: true },
    { name: 'days', title: '每日行程' },
    { name: 'pricing', title: '費用說明' },
  ],
  fields: [
    // === 基本資訊 ===
    defineField({
      name: 'clientName',
      title: '客戶名稱',
      type: 'string',
      group: 'basic',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'startDate',
      title: '出發日期',
      type: 'date',
      group: 'basic',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'endDate',
      title: '結束日期',
      type: 'date',
      group: 'basic',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'adults',
      title: '大人人數',
      type: 'number',
      group: 'basic',
      initialValue: 2,
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'children',
      title: '小孩人數',
      type: 'number',
      group: 'basic',
      initialValue: 0,
    }),
    defineField({
      name: 'childrenAges',
      title: '小孩年齡',
      type: 'string',
      group: 'basic',
      description: '例：5歲、2歲',
    }),

    // === 每日行程 ===
    defineField({
      name: 'days',
      title: '每日行程',
      type: 'array',
      group: 'days',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'dayItem',
          title: '單日行程',
          fields: [
            defineField({
              name: 'date',
              title: '日期',
              type: 'date',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'title',
              title: '當日主題',
              type: 'string',
              description: '例：大象保育園・親子體驗日',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'activities',
              title: '活動列表',
              type: 'array',
              of: [
                defineArrayMember({
                  type: 'object',
                  name: 'activity',
                  fields: [
                    defineField({
                      name: 'time',
                      title: '時間',
                      type: 'string',
                      description: '例：09:00',
                    }),
                    defineField({
                      name: 'content',
                      title: '內容',
                      type: 'string',
                      validation: (Rule) => Rule.required(),
                    }),
                  ],
                  preview: {
                    select: { time: 'time', content: 'content' },
                    prepare: ({ time, content }) => ({
                      title: time ? `${time} ${content}` : content,
                    }),
                  },
                }),
              ],
            }),
            defineField({
              name: 'lunch',
              title: '午餐',
              type: 'string',
            }),
            defineField({
              name: 'dinner',
              title: '晚餐',
              type: 'string',
            }),
            defineField({
              name: 'accommodation',
              title: '住宿',
              type: 'string',
            }),
          ],
          preview: {
            select: { date: 'date', title: 'title' },
            prepare: ({ date, title }) => ({
              title: title,
              subtitle: date,
            }),
          },
        }),
      ],
    }),

    // === 費用說明 ===
    defineField({
      name: 'totalPrice',
      title: '總費用（泰銖）',
      type: 'number',
      group: 'pricing',
    }),
    defineField({
      name: 'priceIncludes',
      title: '費用包含',
      type: 'text',
      group: 'pricing',
      rows: 5,
      description: '每行一項，例：\n- 7人座包車（含油、過路費）\n- 中文導遊服務',
    }),
    defineField({
      name: 'priceExcludes',
      title: '費用不包含',
      type: 'text',
      group: 'pricing',
      rows: 5,
      description: '每行一項，例：\n- 機票\n- 個人消費',
    }),
  ],
  preview: {
    select: {
      clientName: 'clientName',
      startDate: 'startDate',
      endDate: 'endDate',
      adults: 'adults',
      children: 'children',
    },
    prepare: ({ clientName, startDate, endDate, adults, children }) => ({
      title: clientName || '未命名行程',
      subtitle: `${startDate || '?'} ~ ${endDate || '?'} | ${adults || 0}大${children || 0}小`,
    }),
  },
  orderings: [
    {
      title: '出發日期（新到舊）',
      name: 'startDateDesc',
      by: [{ field: 'startDate', direction: 'desc' }],
    },
  ],
})
```

**Step 2: 註冊 schema 到 index**

修改 `src/sanity/schemas/index.ts`：

```typescript
import post from './post'
import tour from './tour'
import landingPage from './landingPage'
import carCharter from './carCharter'
import homestay from './homestay'
import itinerary from './itinerary'

export const schemaTypes = [post, tour, landingPage, carCharter, homestay, itinerary]
```

**Step 3: 驗證 schema 載入成功**

Run: `npm run dev`

開啟 http://localhost:3000/studio，確認左側選單出現「itinerary」（可能顯示為預設標題）。

**Step 4: Commit**

```bash
git add src/sanity/schemas/itinerary.ts src/sanity/schemas/index.ts
git commit -m "feat: add itinerary schema for PDF generation"
```

---

## Task 2: 更新 Sanity Structure（側邊欄）

**Files:**
- Modify: `src/sanity/structure.ts`

**Step 1: 在 structure 加入行程表選項**

修改 `src/sanity/structure.ts`：

```typescript
import type { StructureResolver } from 'sanity/structure'

const singletonTypes = new Set(['landingPage', 'carCharter', 'homestay'])

export const structure: StructureResolver = (S) =>
  S.list()
    .id('root')
    .title('內容管理')
    .items([
      // 頁面設定區塊
      S.listItem()
        .id('pages')
        .title('頁面設定')
        .child(
          S.list()
            .id('pages-list')
            .title('頁面設定')
            .items([
              S.listItem()
                .id('landingPage')
                .title('首頁設定')
                .child(
                  S.document()
                    .schemaType('landingPage')
                    .documentId('landingPage')
                ),
              S.listItem()
                .id('carCharter')
                .title('包車服務頁面')
                .child(
                  S.document()
                    .schemaType('carCharter')
                    .documentId('carCharter')
                ),
              S.listItem()
                .id('homestay')
                .title('民宿頁面')
                .child(
                  S.document()
                    .schemaType('homestay')
                    .documentId('homestay')
                ),
            ])
        ),

      S.divider(),

      // 客戶行程表（新增）
      S.documentTypeListItem('itinerary').title('客戶行程表'),

      S.divider(),

      // 部落格文章
      S.documentTypeListItem('post').title('部落格文章'),

      // 行程
      S.documentTypeListItem('tour').title('行程'),
    ])
```

**Step 2: 驗證側邊欄顯示正確**

重新整理 Sanity Studio，確認「客戶行程表」出現在選單中。

**Step 3: Commit**

```bash
git add src/sanity/structure.ts
git commit -m "feat: add itinerary to Sanity Studio sidebar"
```

---

## Task 3: 安裝 Puppeteer

**Step 1: 安裝套件**

Run: `npm install puppeteer`

**Step 2: 驗證安裝成功**

Run: `npm list puppeteer`

Expected: 顯示 puppeteer 版本號

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add puppeteer for PDF generation"
```

---

## Task 4: 建立 PDF HTML 模板

**Files:**
- Create: `src/lib/pdf/itinerary-template.ts`

**Step 1: 建立 PDF HTML 模板函數**

```typescript
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
      gap: 15mm;
      font-size: 13px;
    }

    .meal-label {
      color: #666;
    }

    .accommodation {
      margin-top: 3mm;
      font-size: 13px;
    }

    .accommodation-label {
      color: #666;
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
        ${day.lunch || day.dinner ? `
          <div class="meals">
            ${day.lunch ? `<div><span class="meal-label">午餐：</span>${day.lunch}</div>` : ''}
            ${day.dinner ? `<div><span class="meal-label">晚餐：</span>${day.dinner}</div>` : ''}
          </div>
        ` : ''}
        ${day.accommodation ? `
          <div class="accommodation">
            <span class="accommodation-label">住宿：</span>${day.accommodation}
          </div>
        ` : ''}
      </div>
    `).join('')}
  </div>

  <!-- 費用說明 -->
  ${totalPrice || includesList.length > 0 || excludesList.length > 0 ? `
    <div class="page">
      <div class="pricing">
        <div class="pricing-title">費用說明</div>
        ${totalPrice ? `<div class="total-price">總費用：฿${totalPrice.toLocaleString()}</div>` : ''}
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
```

**Step 2: Commit**

```bash
git add src/lib/pdf/itinerary-template.ts
git commit -m "feat: add PDF HTML template for itinerary"
```

---

## Task 5: 建立 PDF 產生 API

**Files:**
- Create: `src/app/api/itinerary/[id]/pdf/route.ts`
- Create: `src/lib/sanity/queries.ts`（如果不存在）

**Step 1: 建立 Sanity 查詢函數**

```typescript
// src/lib/sanity/queries.ts
import { client } from '@/sanity/lib/client'

export async function getItineraryById(id: string) {
  const query = `*[_type == "itinerary" && _id == $id][0]{
    clientName,
    startDate,
    endDate,
    adults,
    children,
    childrenAges,
    days[]{
      date,
      title,
      activities[]{
        time,
        content
      },
      lunch,
      dinner,
      accommodation
    },
    totalPrice,
    priceIncludes,
    priceExcludes
  }`

  return client.fetch(query, { id })
}
```

**Step 2: 建立 PDF API endpoint**

```typescript
// src/app/api/itinerary/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'
import { getItineraryById } from '@/lib/sanity/queries'
import { generateItineraryHTML } from '@/lib/pdf/itinerary-template'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // 從 Sanity 取得資料
    const itinerary = await getItineraryById(id)

    if (!itinerary) {
      return NextResponse.json(
        { error: 'Itinerary not found' },
        { status: 404 }
      )
    }

    // 產生 HTML
    const html = generateItineraryHTML(itinerary)

    // 使用 Puppeteer 產生 PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
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
```

**Step 3: 驗證 API 運作**

1. 在 Sanity Studio 建立一筆測試行程
2. 複製該文件的 ID（從網址列取得）
3. 訪問 `http://localhost:3000/api/itinerary/{id}/pdf`
4. 確認 PDF 下載成功

**Step 4: Commit**

```bash
git add src/lib/sanity/queries.ts src/app/api/itinerary/[id]/pdf/route.ts
git commit -m "feat: add PDF generation API endpoint"
```

---

## Task 6: 在 Sanity Studio 加入匯出按鈕

**Files:**
- Create: `src/sanity/actions/exportPdfAction.tsx`
- Modify: `sanity.config.ts`

**Step 1: 建立 Document Action**

```typescript
// src/sanity/actions/exportPdfAction.tsx
import { DocumentActionComponent } from 'sanity'
import { DownloadIcon } from '@sanity/icons'

export const exportPdfAction: DocumentActionComponent = (props) => {
  const { id, type, published } = props

  // 只在 itinerary 類型顯示
  if (type !== 'itinerary') {
    return null
  }

  return {
    label: '匯出 PDF',
    icon: DownloadIcon,
    disabled: !published,
    title: published ? '下載行程表 PDF' : '請先發布文件',
    onHandle: () => {
      // 開啟 PDF 下載連結
      const url = `/api/itinerary/${id}/pdf`
      window.open(url, '_blank')
    },
  }
}
```

**Step 2: 在 sanity.config.ts 註冊 action**

```typescript
// sanity.config.ts
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { schemaTypes } from './src/sanity/schemas'
import { projectId, dataset } from './src/sanity/config'
import { structure } from './src/sanity/structure'
import { exportPdfAction } from './src/sanity/actions/exportPdfAction'

export default defineConfig({
  name: 'chiangway-travel',
  title: '清微旅行 CMS',
  projectId,
  dataset,
  basePath: '/studio',
  plugins: [structureTool({ structure })],
  schema: { types: schemaTypes },
  document: {
    actions: (prev, context) => {
      // 在 itinerary 類型加入匯出 PDF action
      if (context.schemaType === 'itinerary') {
        return [exportPdfAction, ...prev]
      }
      return prev
    },
  },
})
```

**Step 3: 驗證匯出按鈕運作**

1. 開啟 Sanity Studio
2. 進入「客戶行程表」
3. 開啟或建立一筆行程
4. 點擊右上角「匯出 PDF」按鈕
5. 確認 PDF 下載成功

**Step 4: Commit**

```bash
git add src/sanity/actions/exportPdfAction.tsx sanity.config.ts
git commit -m "feat: add export PDF button in Sanity Studio"
```

---

## Task 7: 測試完整流程

**Step 1: 建立完整測試行程**

在 Sanity Studio 建立一筆包含以下資料的行程：
- 客戶名稱：測試客戶
- 出發日期：2026-02-14
- 結束日期：2026-02-17
- 大人：2
- 小孩：2
- 小孩年齡：5歲、2歲
- 至少 3 天的行程內容
- 費用說明

**Step 2: 驗證 PDF 內容正確**

1. 匯出 PDF
2. 檢查封面資訊
3. 檢查每日行程排版
4. 檢查費用說明
5. 檢查中文字體顯示正常

**Step 3: 最終 Commit**

```bash
git add -A
git commit -m "feat: complete PDF itinerary generator"
```

---

## 開發環境注意事項

1. **Puppeteer 在 Windows WSL 可能需要額外設定**
   - 如果遇到 Chrome 啟動問題，嘗試安裝：`sudo apt-get install chromium-browser`
   - 或使用 `puppeteer-core` 搭配系統 Chrome

2. **中文字體**
   - HTML 模板使用 Google Fonts 的 Noto Sans TC
   - Puppeteer 需要等待字體載入完成（`waitUntil: 'networkidle0'`）

3. **Vercel 部署**
   - Puppeteer 在 Vercel 需要特殊設定
   - 可考慮改用 `@vercel/og` 或外部服務（如 Browserless）
