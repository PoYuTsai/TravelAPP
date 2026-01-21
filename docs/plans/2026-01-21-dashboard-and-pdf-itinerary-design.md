# Dashboard 與 PDF 行程表產生器設計文件

日期：2026-01-21

## 概述

本文件涵蓋兩個功能的設計規劃：
1. **CMS Dashboard**：後台數據監控儀表板
2. **PDF 行程表產生器**：客戶行程表 PDF 匯出功能

---

## 功能一：CMS Dashboard

### 目標

在 CMS 後台建立儀表板，讓管理員一眼掌握業務狀況，包含財務、營運、現金流等關鍵指標。

### 資料來源

- **來源**：Notion 資料庫（現有訂單管理系統）
- **同步方式**：即時 API 查詢（每次開啟 Dashboard 時呼叫）
- **理由**：訂單量不大（約 30-40 筆/月），API 回應速度可接受；需要即時數據追蹤支付狀態

### 版面配置

#### 區塊 1：頂部數字卡片

四張卡片並排顯示：

| 卡片 | 內容 |
|-----|------|
| 本月營收 | 總收入金額 + 與上月比較 |
| 本月利潤 | 利潤金額 + 與上月比較 |
| 本月訂單數 | 訂單筆數 + 與上月比較 |
| 待收款項 | 未結清金額 + 未結清筆數 |

#### 區塊 2：中間圖表區

- **左側**：月度利潤趨勢圖（長條圖，近 6 個月）
- **右側**：訂單來源分佈（圓餅圖）

#### 區塊 3：底部表格區

兩個 Tab 切換：
- **Tab 1 - 近期訂單**：最近 10 筆訂單（客戶、日期、金額、支付狀態）
- **Tab 2 - 待收款項**：篩選「支付狀態 ≠ 已結清」的訂單

### 技術方案

- 路由：`/admin/dashboard`（需登入驗證）
- 複用現有 `scripts/notion-profit-report.mjs` 的查詢邏輯
- 圖表套件：可使用 Chart.js 或 Recharts

### 開發項目

1. 建立 Dashboard 頁面路由與權限驗證
2. 封裝 Notion API 查詢函數（營收、利潤、訂單、支付狀態）
3. 頂部數字卡片元件
4. 月度利潤趨勢圖
5. 訂單來源分佈圖
6. 近期訂單 / 待收款項表格

---

## 功能二：PDF 行程表產生器

### 目標

產生專業的 PDF 行程表給客戶，可以輕鬆複製舊行程、調整日期和景點。

### 業務流程

```
在 Sanity 建立/複製行程 → 匯出 PDF → LINE 群組分享 → 客戶回饋 → 修改後重新匯出
```

### Sanity Schema 設計

```javascript
// schemas/itinerary.js
export default {
  name: 'itinerary',
  title: '行程表',
  type: 'document',
  fields: [
    // 基本資訊
    { name: 'clientName', title: '客戶名稱', type: 'string' },
    { name: 'startDate', title: '出發日期', type: 'date' },
    { name: 'endDate', title: '結束日期', type: 'date' },
    { name: 'adults', title: '大人人數', type: 'number' },
    { name: 'children', title: '小孩人數', type: 'number' },
    { name: 'childrenAges', title: '小孩年齡', type: 'string', description: '例：5歲、2歲' },
    { name: 'totalPrice', title: '總費用', type: 'number' },
    { name: 'priceNotes', title: '費用說明', type: 'text', description: '包含/不包含項目' },

    // 每日行程
    {
      name: 'days',
      title: '每日行程',
      type: 'array',
      of: [{
        type: 'object',
        fields: [
          { name: 'date', title: '日期', type: 'date' },
          { name: 'title', title: '當日主題', type: 'string', description: '例：大象保育園・親子體驗日' },
          {
            name: 'activities',
            title: '活動列表',
            type: 'array',
            of: [{
              type: 'object',
              fields: [
                { name: 'time', title: '時間', type: 'string' },
                { name: 'content', title: '內容', type: 'string' }
              ]
            }]
          },
          { name: 'lunch', title: '午餐', type: 'string' },
          { name: 'dinner', title: '晚餐', type: 'string' },
          { name: 'accommodation', title: '住宿', type: 'string' }
        ]
      }]
    }
  ]
}
```

### PDF 版面設計

#### 第一頁：封面

```
┌─────────────────────────────────┐
│                                 │
│      [清微旅行 LOGO]            │
│                                 │
│      清邁親子包車 7 日遊         │
│      2026/02/14 - 02/20        │
│                                 │
│      王小明 一家                 │
│      2 大 2 小（5歲、2歲）       │
│                                 │
│      ─────────────────          │
│      專屬行程規劃                │
│                                 │
└─────────────────────────────────┘
```

#### 內頁：每日行程

```
┌─────────────────────────────────┐
│ Day 1 │ 2/14 (六)              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 抵達清邁・放鬆展開旅程           │
│                                 │
│ • 10:30  機場接機 (CI851)       │
│ • 11:00  換匯                   │
│ • 12:30  午餐：Neng 瓦罐烤肉    │
│ • 14:00  真心市集（週末限定）    │
│ • 18:00  晚餐：發清海南雞飯     │
│                                 │
│ 🏨 住宿：Anantara Resort        │
└─────────────────────────────────┘
```

#### 最後一頁：費用說明

- 總費用
- 包含項目（條列）
- 不包含項目（條列）
- 聯絡資訊 + LINE QR Code

### 設計決策

| 決策項目 | 選擇 | 理由 |
|---------|------|------|
| Google Maps 連結 | 不加 | 包車+導遊服務，客人全程有人帶，不需自己找路 |
| 客戶編輯功能 | 不做 | 透過 LINE 群組討論修改，維持現有業務流程 |
| 資料來源 | Sanity CMS | 結構化欄位方便複製和修改，比 Notion 純文字更不易出錯 |

### 技術方案

- PDF 產生：使用 `@react-pdf/renderer` 或 `puppeteer`
- 匯出方式：CMS 行程表頁面加「匯出 PDF」按鈕
- API endpoint：`/api/itinerary/[id]/pdf`

### 開發項目

1. Sanity Schema：itinerary 內容類型
2. PDF 模板元件：封面、每日行程、費用說明
3. 匯出 API endpoint
4. CMS 介面整合（匯出按鈕）

---

## 實作優先順序建議

1. **PDF 行程表** - 直接解決日常業務需求
2. **Dashboard** - 月底/季度檢視時使用

---

## 相關檔案

- `scripts/notion-profit-report.mjs` - 現有 Notion 利潤查詢邏輯（Dashboard 可複用）
- Notion Database ID: `26037493-475d-8115-bb53-000ba2f98287`
