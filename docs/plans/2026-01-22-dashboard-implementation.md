# Dashboard 實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Sanity Studio 建立財務監控 Dashboard，顯示本月利潤、待收款項、趨勢圖。

**Architecture:**
- Sanity Studio 頂部獨立 Tool（與內容管理分開）
- API Route 連接 Notion 資料庫
- Email 白名單控制存取權限
- 深紫質感 UI 設計

**Tech Stack:**
- Sanity Studio Custom Tool
- Next.js API Route
- Notion API (@notionhq/client)
- React + Tailwind CSS
- recharts (Sparkline)

**設計文件:** `docs/plans/2026-01-22-phase3-internal-tools.md`

---

## Task 1: 建立 Notion API 工具函數

**Files:**
- Create: `src/lib/notion/client.ts`
- Create: `src/lib/notion/types.ts`
- Create: `src/lib/notion/profit-parser.ts`

**Step 1.1: 建立型別定義**

```typescript
// src/lib/notion/types.ts

export interface NotionOrder {
  id: string
  customerName: string
  travelDate: {
    start: string
    end: string | null
  } | null
  travelers: string
  profit: {
    raw: string
    value: number
    confident: boolean
  }
  revenue: {
    raw: string
    value: number
    confident: boolean
  }
  paymentStatus: '已付尾款' | '未付款' | '未開始' | string
  updateStatus: '完成' | '未開始' | string
}

export interface DashboardData {
  monthlyProfit: number
  monthlyOrderCount: number
  pendingPayment: number
  pendingPaymentCount: number
  pendingOrders: NotionOrder[]
  monthlyTrend: Array<{
    month: string
    profit: number
    count: number
  }>
  lastUpdated: string
  hasUncertainValues: boolean
}
```

**Step 1.2: 建立利潤解析器**

```typescript
// src/lib/notion/profit-parser.ts

export interface ParseResult {
  value: number
  confident: boolean
}

/**
 * 解析利潤/收入文字，提取最終數字
 *
 * 優先順序：
 * 1. 獨立一行的數字（最後一個）
 * 2. 最後一個 = 數字
 * 3. 嘗試計算開頭的簡單算式
 * 4. 都找不到 → 0
 */
export function parseNumberText(text: string): ParseResult {
  if (!text || text.trim() === '') {
    return { value: 0, confident: false }
  }

  const cleanText = text.trim()
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean)

  // 策略 1: 找獨立一行的數字（最後一個）
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    // 整行只有數字（可能有逗號）
    const standaloneMatch = line.match(/^([\d,]+)$/)
    if (standaloneMatch) {
      const num = parseFloat(standaloneMatch[1].replace(/,/g, ''))
      if (!isNaN(num) && num > 0) {
        return { value: num, confident: true }
      }
    }
  }

  // 策略 2: 找最後一個 "= 數字" 模式
  const allText = cleanText.replace(/\n/g, ' ')
  const equalPatterns = allText.match(/=\s*([\d,]+)/g)
  if (equalPatterns && equalPatterns.length > 0) {
    const lastEqual = equalPatterns[equalPatterns.length - 1]
    const num = parseFloat(lastEqual.replace(/[=\s,]/g, ''))
    if (!isNaN(num) && num > 0) {
      return { value: num, confident: true }
    }
  }

  // 策略 3: 嘗試計算開頭的簡單算式 (如 3000+2500)
  const firstLine = lines[0] || ''
  const simpleCalcMatch = firstLine.match(/^([\d,]+)\s*([+\-])\s*([\d,]+)/)
  if (simpleCalcMatch) {
    const a = parseFloat(simpleCalcMatch[1].replace(/,/g, ''))
    const b = parseFloat(simpleCalcMatch[3].replace(/,/g, ''))
    const op = simpleCalcMatch[2]
    const result = op === '+' ? a + b : a - b
    if (!isNaN(result)) {
      return { value: result, confident: false } // 需核對
    }
  }

  // 策略 4: 找第一個數字
  const firstNumber = allText.match(/([\d,]+)/)
  if (firstNumber) {
    const num = parseFloat(firstNumber[1].replace(/,/g, ''))
    if (!isNaN(num) && num > 0) {
      return { value: num, confident: false }
    }
  }

  return { value: 0, confident: false }
}
```

**Step 1.3: 建立 Notion Client**

```typescript
// src/lib/notion/client.ts

import { Client } from '@notionhq/client'
import type { NotionOrder, DashboardData } from './types'
import { parseNumberText } from './profit-parser'

const NOTION_TOKEN = process.env.NOTION_TOKEN
const DATABASE_ID = process.env.NOTION_DATABASE_ID || '26037493-475d-8115-bb53-000ba2f98287'

if (!NOTION_TOKEN) {
  console.warn('NOTION_TOKEN 未設定')
}

const notion = NOTION_TOKEN ? new Client({ auth: NOTION_TOKEN }) : null

function extractMonth(dateValue: { start: string; end?: string | null } | null): string | null {
  if (!dateValue?.start) return null
  const match = dateValue.start.match(/(\d{4})[-\/](\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}`
  }
  return null
}

export async function fetchNotionOrders(): Promise<NotionOrder[]> {
  if (!notion) {
    throw new Error('Notion client not initialized')
  }

  const pages: any[] = []
  let cursor: string | undefined = undefined

  do {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
    })
    pages.push(...response.results)
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (cursor)

  return pages.map((page: any) => {
    const props = page.properties

    // 客戶名稱
    const customerName = props['客戶名稱']?.title?.[0]?.plain_text || ''

    // 旅遊日期
    const travelDate = props['旅遊日期']?.date || null

    // 旅遊人數
    const travelers = props['旅遊人數']?.rich_text?.[0]?.plain_text || ''

    // 利潤
    const profitRaw = props['利潤']?.rich_text?.[0]?.plain_text || ''
    const profit = parseNumberText(profitRaw)

    // 總收入
    const revenueRaw = props['總收入']?.rich_text?.[0]?.plain_text || ''
    const revenue = parseNumberText(revenueRaw)

    // 支付狀態
    const paymentStatus = props['支付狀態']?.status?.name || ''

    // 更新進度
    const updateStatus = props['更新進度']?.status?.name || ''

    return {
      id: page.id,
      customerName,
      travelDate,
      travelers,
      profit: { raw: profitRaw, ...profit },
      revenue: { raw: revenueRaw, ...revenue },
      paymentStatus,
      updateStatus,
    }
  })
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const orders = await fetchNotionOrders()

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // 本月統計
  let monthlyProfit = 0
  let monthlyOrderCount = 0
  let hasUncertainValues = false

  // 待收款
  let pendingPayment = 0
  let pendingPaymentCount = 0
  const pendingOrders: NotionOrder[] = []

  // 月度趨勢（近 6 個月）
  const monthlyStats: Record<string, { profit: number; count: number }> = {}

  for (const order of orders) {
    const month = extractMonth(order.travelDate)

    // 計入月度統計
    if (month) {
      if (!monthlyStats[month]) {
        monthlyStats[month] = { profit: 0, count: 0 }
      }
      monthlyStats[month].profit += order.profit.value
      monthlyStats[month].count += 1

      // 本月
      if (month === currentMonth) {
        monthlyProfit += order.profit.value
        monthlyOrderCount += 1
        if (!order.profit.confident) {
          hasUncertainValues = true
        }
      }
    }

    // 待收款（支付狀態 = 未付款）
    if (order.paymentStatus === '未付款') {
      pendingPayment += order.profit.value
      pendingPaymentCount += 1
      pendingOrders.push(order)
    }
  }

  // 整理月度趨勢（近 6 個月）
  const sortedMonths = Object.keys(monthlyStats).sort().slice(-6)
  const monthlyTrend = sortedMonths.map(month => ({
    month,
    profit: monthlyStats[month].profit,
    count: monthlyStats[month].count,
  }))

  return {
    monthlyProfit,
    monthlyOrderCount,
    pendingPayment,
    pendingPaymentCount,
    pendingOrders,
    monthlyTrend,
    lastUpdated: new Date().toISOString(),
    hasUncertainValues,
  }
}
```

**Step 1.4: 建立匯出檔案**

```typescript
// src/lib/notion/index.ts

export * from './types'
export * from './profit-parser'
export * from './client'
```

**Step 1.5: Commit**

```bash
git add src/lib/notion/
git commit -m "feat: 建立 Notion API 工具函數與利潤解析器"
```

---

## Task 2: 建立 Dashboard API Route

**Files:**
- Create: `src/app/api/dashboard/route.ts`

**Step 2.1: 建立 API Route**

```typescript
// src/app/api/dashboard/route.ts

import { NextResponse } from 'next/server'
import { fetchDashboardData } from '@/lib/notion'

// Email 白名單
const ALLOWED_EMAILS = [
  // 在此加入允許存取的 Email
  // 'eric@example.com',
  // 'min@example.com',
]

export async function GET(request: Request) {
  try {
    // 從 header 取得使用者 email（由 Sanity 傳入）
    const userEmail = request.headers.get('x-user-email')

    // 白名單檢查（如果白名單為空，允許所有人）
    if (ALLOWED_EMAILS.length > 0 && userEmail) {
      if (!ALLOWED_EMAILS.includes(userEmail)) {
        return NextResponse.json(
          { error: '無權限存取 Dashboard' },
          { status: 403 }
        )
      }
    }

    const data = await fetchDashboardData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Dashboard API Error:', error)
    return NextResponse.json(
      { error: '無法取得資料' },
      { status: 500 }
    )
  }
}
```

**Step 2.2: 加入環境變數**

確認 `.env.local` 有以下變數：

```
NOTION_TOKEN=your_notion_integration_token
NOTION_DATABASE_ID=26037493-475d-8115-bb53-000ba2f98287
```

**Step 2.3: Commit**

```bash
git add src/app/api/dashboard/
git commit -m "feat: 建立 Dashboard API Route"
```

---

## Task 3: 建立 Sanity Studio Dashboard Tool

**Files:**
- Create: `src/sanity/tools/dashboard/index.tsx`
- Create: `src/sanity/tools/dashboard/DashboardTool.tsx`
- Create: `src/sanity/tools/dashboard/components/StatCard.tsx`
- Create: `src/sanity/tools/dashboard/components/Sparkline.tsx`
- Create: `src/sanity/tools/dashboard/components/PendingTable.tsx`
- Create: `src/sanity/tools/dashboard/styles.css`
- Modify: `sanity.config.ts`

**Step 3.1: 建立 StatCard 元件**

```tsx
// src/sanity/tools/dashboard/components/StatCard.tsx

import React from 'react'

interface StatCardProps {
  title: string
  value: number
  subtext: string
  warning?: boolean
  sparklineData?: number[]
}

export function StatCard({ title, value, subtext, warning, sparklineData }: StatCardProps) {
  const formattedValue = new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
  }).format(value)

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        {warning && <span className="warning-badge">⚠️</span>}
      </div>
      <div className="card-value">{formattedValue}</div>
      <div className="card-footer">
        <span className="card-subtext">{subtext}</span>
        {sparklineData && sparklineData.length > 0 && (
          <Sparkline data={sparklineData} />
        )}
      </div>
    </div>
  )
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const width = 60
  const height = 20
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((val - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const trend = data[data.length - 1] > data[0] ? '↗' : '↘'

  return (
    <div className="sparkline-container">
      <svg width={width} height={height} className="sparkline">
        <polyline
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2"
          points={points}
        />
      </svg>
      <span className="trend-indicator">{trend}</span>
    </div>
  )
}
```

**Step 3.2: 建立 PendingTable 元件**

```tsx
// src/sanity/tools/dashboard/components/PendingTable.tsx

import React from 'react'
import type { NotionOrder } from '@/lib/notion/types'

interface PendingTableProps {
  orders: NotionOrder[]
}

export function PendingTable({ orders }: PendingTableProps) {
  if (orders.length === 0) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <span className="card-title">待收款清單</span>
          <span className="success-badge">✓ 全部已收</span>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <span className="card-title">待收款清單</span>
        <span className="warning-badge">⚠️ {orders.length} 筆未收</span>
      </div>
      <table className="pending-table">
        <thead>
          <tr>
            <th>客戶</th>
            <th>日期</th>
            <th>金額</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.customerName}</td>
              <td>{order.travelDate?.start || '-'}</td>
              <td className="amount">
                {new Intl.NumberFormat('zh-TW', {
                  style: 'currency',
                  currency: 'TWD',
                  minimumFractionDigits: 0,
                }).format(order.profit.value)}
                {!order.profit.confident && <span className="uncertain">⚠️</span>}
              </td>
              <td>
                <span className="status-pending">未付款</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**Step 3.3: 建立主要 Dashboard 元件**

```tsx
// src/sanity/tools/dashboard/DashboardTool.tsx

import React, { useEffect, useState } from 'react'
import { useCurrentUser } from 'sanity'
import type { DashboardData } from '@/lib/notion/types'
import { StatCard } from './components/StatCard'
import { PendingTable } from './components/PendingTable'
import './styles.css'

// Email 白名單
const ALLOWED_EMAILS: string[] = [
  // 'eric@example.com',
  // 'min@example.com',
]

export function DashboardTool() {
  const currentUser = useCurrentUser()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const userEmail = currentUser?.email || ''

  // 白名單檢查
  const hasAccess = ALLOWED_EMAILS.length === 0 || ALLOWED_EMAILS.includes(userEmail)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard', {
        headers: {
          'x-user-email': userEmail,
        },
      })
      if (!response.ok) {
        throw new Error('無法取得資料')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生錯誤')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasAccess) {
      fetchData()
    }
  }, [hasAccess])

  if (!hasAccess) {
    return (
      <div className="dashboard-container">
        <div className="access-denied">
          <h2>🔒 無權限存取</h2>
          <p>此 Dashboard 僅限授權人員使用。</p>
          <p className="email-info">目前登入：{userEmail || '未知'}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">載入中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error">
          <h2>❌ 錯誤</h2>
          <p>{error}</p>
          <button onClick={fetchData} className="refresh-button">重試</button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const sparklineData = data.monthlyTrend.map(m => m.profit)

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>📊 財務監控</h1>
        <div className="header-actions">
          <span className="last-updated">
            上次更新: {new Date(data.lastUpdated).toLocaleString('zh-TW')}
          </span>
          <button onClick={fetchData} className="refresh-button" disabled={loading}>
            🔄 刷新
          </button>
        </div>
      </div>

      {data.hasUncertainValues && (
        <div className="notice-banner">
          ⚠️ 部分數值為自動計算，建議核對 Notion 原始資料
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          title="本月利潤"
          value={data.monthlyProfit}
          subtext={`${data.monthlyOrderCount} 筆訂單`}
          sparklineData={sparklineData}
        />
        <StatCard
          title="待收款項"
          value={data.pendingPayment}
          subtext={`${data.pendingPaymentCount} 筆未收`}
          warning={data.pendingPaymentCount > 0}
        />
      </div>

      <PendingTable orders={data.pendingOrders} />
    </div>
  )
}
```

**Step 3.4: 建立樣式檔案**

```css
/* src/sanity/tools/dashboard/styles.css */

.dashboard-container {
  min-height: 100vh;
  padding: 24px;
  background: #13111c;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.dashboard-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.last-updated {
  font-size: 12px;
  color: #94a3b8;
}

.refresh-button {
  padding: 8px 16px;
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.refresh-button:hover {
  background: #7c3aed;
}

.refresh-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.notice-banner {
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid #fbbf24;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 24px;
  font-size: 14px;
  color: #fbbf24;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.dashboard-card {
  background: #1e1b2e;
  border-radius: 12px;
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-title {
  font-size: 14px;
  color: #94a3b8;
  font-weight: 500;
}

.card-value {
  font-size: 32px;
  font-weight: 700;
  color: #fbbf24;
  font-variant-numeric: tabular-nums;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.card-subtext {
  font-size: 13px;
  color: #94a3b8;
}

.sparkline-container {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sparkline {
  opacity: 0.8;
}

.trend-indicator {
  font-size: 14px;
  color: #8b5cf6;
}

.warning-badge {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.success-badge {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

/* Pending Table */
.pending-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}

.pending-table th,
.pending-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #2d2a3e;
}

.pending-table th {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
  text-transform: uppercase;
}

.pending-table td {
  font-size: 14px;
}

.pending-table .amount {
  color: #fbbf24;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pending-table .uncertain {
  margin-left: 4px;
  font-size: 12px;
}

.status-pending {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

/* Access Denied / Error / Loading */
.access-denied,
.error,
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}

.access-denied h2,
.error h2 {
  font-size: 24px;
  margin-bottom: 12px;
}

.email-info {
  margin-top: 16px;
  font-size: 12px;
  color: #64748b;
}

.loading {
  font-size: 18px;
  color: #8b5cf6;
}
```

**Step 3.5: 建立 Tool 匯出**

```tsx
// src/sanity/tools/dashboard/index.tsx

import { definePlugin } from 'sanity'
import { BarChartIcon } from '@sanity/icons'
import { DashboardTool } from './DashboardTool'

export const dashboardTool = definePlugin({
  name: 'dashboard-tool',
  tools: [
    {
      name: 'dashboard',
      title: 'Dashboard',
      icon: BarChartIcon,
      component: DashboardTool,
    },
  ],
})
```

**Step 3.6: 更新 sanity.config.ts**

```typescript
// sanity.config.ts

import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { schemaTypes } from './src/sanity/schemas'
import { projectId, dataset } from './src/sanity/config'
import { structure } from './src/sanity/structure'
import { exportPdfAction } from './src/sanity/actions/exportPdfAction'
import { exportExcelAction } from './src/sanity/actions/exportExcelAction'
import { exportTextAction } from './src/sanity/actions/exportTextAction'
import { syncFromTextAction } from './src/sanity/actions/syncFromTextAction'
import { dashboardTool } from './src/sanity/tools/dashboard'

export default defineConfig({
  name: 'chiangway-travel',
  title: '清微旅行 CMS',
  projectId,
  dataset,
  basePath: '/studio',
  plugins: [
    structureTool({ structure }),
    dashboardTool(),
  ],
  schema: { types: schemaTypes },
  document: {
    actions: (prev, context) => {
      if (context.schemaType === 'itinerary') {
        return [
          ...prev,
          syncFromTextAction,
          exportTextAction,
          exportPdfAction,
          exportExcelAction,
        ]
      }
      return prev
    },
  },
})
```

**Step 3.7: Commit**

```bash
git add src/sanity/tools/ sanity.config.ts
git commit -m "feat: 建立 Sanity Studio Dashboard Tool"
```

---

## Task 4: 測試與驗證

**Step 4.1: 啟動開發伺服器**

```bash
npm run dev
```

**Step 4.2: 驗證項目**

1. 開啟 http://localhost:3000/studio
2. 確認頂部出現「Dashboard」Tab
3. 點擊進入 Dashboard
4. 確認顯示：
   - 本月利潤卡片
   - 待收款項卡片
   - 待收款清單表格
   - 刷新按鈕
5. 點擊「刷新」確認資料更新

**Step 4.3: Commit 最終版本**

```bash
git add -A
git commit -m "feat: Dashboard 功能完成"
```

---

## Task 5: 設定白名單（可選）

部署前，更新白名單：

**Files:**
- Modify: `src/sanity/tools/dashboard/DashboardTool.tsx`
- Modify: `src/app/api/dashboard/route.ts`

將 `ALLOWED_EMAILS` 改為實際的 Email：

```typescript
const ALLOWED_EMAILS = [
  'your-email@gmail.com',
  'min-email@gmail.com',
]
```

---

## 檔案結構總覽

```
src/
├── lib/
│   └── notion/
│       ├── index.ts
│       ├── types.ts
│       ├── client.ts
│       └── profit-parser.ts
├── app/
│   └── api/
│       └── dashboard/
│           └── route.ts
└── sanity/
    └── tools/
        └── dashboard/
            ├── index.tsx
            ├── DashboardTool.tsx
            ├── styles.css
            └── components/
                ├── StatCard.tsx
                └── PendingTable.tsx
```

---

## 預估時間

| Task | 預估 |
|------|------|
| Task 1: Notion API 工具 | 15-20 分鐘 |
| Task 2: API Route | 5-10 分鐘 |
| Task 3: Dashboard Tool | 30-40 分鐘 |
| Task 4: 測試驗證 | 10-15 分鐘 |
| **總計** | **60-85 分鐘** |

---

*Plan created: 2026-01-22*
