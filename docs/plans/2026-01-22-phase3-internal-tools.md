# Phase 3：內部營運工具

> 日期：2026-01-22
> 狀態：🔄 進行中（行程表完成，Dashboard 待實作）

---

## 概述

Phase 3 專注於內部營運效率工具，幫助業務快速建立客戶行程表、報價單，並監控財務狀況。

| Phase | 性質 | 目的 | 狀態 |
|-------|------|------|------|
| Phase 1 | 公開網站 | 轉換率優化 | ✅ 完成 |
| Phase 2 | SEO 優化 | 流量獲取 | ✅ 完成 |
| **Phase 3** | **內部工具** | **營運效率** | 🔄 進行中 |

### Phase 3 功能總覽

| 功能 | 說明 | 狀態 |
|------|------|------|
| 客戶行程表系統 | 建立、編輯、匯出行程表 | ✅ 完成 |
| 利潤 Dashboard | Notion 資料視覺化儀表板 | ⏳ 待實作 |

---

## 3.1 客戶行程表系統 ✅

### 功能清單

| 功能 | 說明 | 狀態 |
|------|------|------|
| Sanity Schema | `itinerary` 文件類型 | ✅ |
| 快速建立 | 貼上文字一鍵建立行程 | ✅ |
| 結構化編輯器 | 表單式編輯基本資訊、報價 | ✅ |
| PDF 匯出 | 專業排版行程表 PDF | ✅ |
| Excel 匯出 | 早/午/晚/住宿表格 | ✅ |
| LINE 文字匯出 | 純文字格式方便複製 | ✅ |

### Schema 欄位

**基本資訊**
- clientName（客戶名稱）
- startDate / endDate（日期範圍）
- adults / children / childrenAges（人數）
- arrivalFlight / departureFlight（航班）
- guideService / childSeat / extraVehicle（服務選項）
- vehicleCount / vehicleType（車輛）

**每日行程**
- days[]（每日行程陣列）
  - date, title, morning, afternoon, evening
  - lunch, dinner, accommodation
  - activities[]

**報價**
- quotationItems[]（報價明細）
- quotationTotal（總額）
- priceIncludes / priceExcludes（包含/不包含）

**飯店**
- hotels[]（住宿記錄，自動從行程產生）

### 元件結構

```
src/sanity/
├── schemas/
│   └── itinerary.ts              # Schema 定義
├── actions/
│   ├── syncFromTextAction.tsx    # 結構化編輯器
│   ├── importTextAction.tsx      # 匯入文字
│   ├── exportTextAction.tsx      # LINE 文字匯出
│   ├── exportPdfAction.tsx       # PDF 匯出
│   ├── exportExcelAction.tsx     # Excel 匯出
│   └── generateDaysAction.tsx    # 自動產生天數
├── components/
│   ├── QuickStartInput.tsx       # 快速建立輸入框
│   ├── QuickStartBanner.tsx      # 快速建立提示
│   ├── ErrorBoundary.tsx         # 錯誤邊界
│   └── structured-editor/
│       ├── StructuredBasicInfoForm.tsx
│       ├── StructuredQuotationTable.tsx
│       ├── ValidationStatus.tsx
│       ├── flight-data.ts
│       ├── types.ts
│       └── index.ts
```

### API 端點

| 端點 | 用途 |
|------|------|
| `/api/itinerary/[id]/pdf` | PDF 下載 |
| `/api/itinerary/[id]/excel` | Excel 下載 |
| `/api/itinerary/[id]/text` | LINE 文字 |

---

## 3.2 程式碼品質 ✅

### 模組化重構

將 852 行的 `itinerary-parser.ts` 拆分：

```
src/lib/itinerary/
├── types.ts      # 型別定義
├── parser.ts     # 解析函數
├── formatter.ts  # 格式化函數
├── hotels.ts     # 飯店處理
└── index.ts      # 統一匯出
```

### 測試覆蓋

| 測試檔案 | 數量 | 涵蓋範圍 |
|---------|------|---------|
| itinerary-parser.test.ts | 29 | 解析、格式化 |
| pdf-template.test.ts | 25 | PDF 模板函數 |
| **總計** | **54** | |

### 錯誤處理

- **ErrorBoundary**：防止 Sanity Studio 崩潰
- **Logger**：統一錯誤日誌工具
- **ValidationStatus**：即時驗證提示

### E2E 測試基礎

```
e2e/
├── homepage.spec.ts       # 首頁測試
└── sanity-studio.spec.ts  # Studio 測試

playwright.config.ts       # Playwright 設定
```

執行指令：
- `npm run test` - 單元測試
- `npm run test:e2e` - E2E 測試

---

## 3.3 已修復問題

| 問題 | 原因 | 修復 |
|------|------|------|
| 導遊天數顯示 0 失敗 | `\|\|` vs `??` | 改用 `??` |
| 晚餐重複出現 | 同時加到兩個欄位 | 只存專屬欄位 |
| 包車台數未關聯報價 | 沒有乘以台數 | 報價 × vehicleCount |
| Excel「晚」缺少晚餐 | dinner 是獨立欄位 | 加入 evening 輸出 |
| 按摩誤判為晚間 | 關鍵字太廣 | 移除「按摩」 |
| 時區問題 | UTC 解讀 | 加上 `T00:00:00` |

---

## 3.4 利潤 Dashboard ⏳

### 目標

在 CMS 後台建立儀表板，讓管理員一眼掌握業務狀況，包含財務、營運、現金流等關鍵指標。

### 資料來源

- **來源**：Notion 資料庫（現有訂單管理系統）
- **Database ID**：`26037493-475d-8115-bb53-000ba2f98287`
- **同步方式**：即時 API 查詢（每次開啟 Dashboard 時呼叫）
- **現有程式碼**：`scripts/notion-profit-report.mjs`（可複用利潤解析邏輯）

### 版面配置

#### 區塊 1：頂部數字卡片

| 卡片 | 內容 |
|-----|------|
| 本月營收 | 總收入金額 + 與上月比較 |
| 本月利潤 | 利潤金額 + 與上月比較 |
| 本月訂單數 | 訂單筆數 + 與上月比較 |
| 待收款項 | 未結清金額 + 未結清筆數 |

#### 區塊 2：圖表區

- 月度利潤趨勢圖（長條圖，近 6 個月）

#### 區塊 3：表格區

- **Tab 1 - 近期訂單**：最近 10 筆訂單（客戶、日期、金額、支付狀態）
- **Tab 2 - 待收款項**：篩選 `支付狀態` = 未付款 的訂單

### 技術方案

| 項目 | 選擇 |
|------|------|
| 路由 | `/admin/dashboard`（需登入驗證） |
| 圖表套件 | Chart.js 或 Recharts |
| API | 複用 `notion-profit-report.mjs` 邏輯 |

### Notion 資料庫欄位

**資料庫：** 清微旅行2026
**Database ID：** `26037493-475d-8115-bb53-000ba2f98287`

| 欄位名稱 | 類型 | 用途 |
|---------|------|------|
| `客戶名稱` | title | 主鍵 |
| `旅遊日期` | date | 日期範圍，用於月份統計 |
| `旅遊人數` | text | 成人/小孩人數 |
| `飛行班次` | text | 每日簡述 |
| `包車類型` | text | 車型+導遊 |
| `行程框架` | text | 詳細行程 |
| `總成本` | text | 計算式文字，需解析 |
| `總收入` | text | 計算式文字，需解析 |
| `利潤` | text | 計算式文字，需解析 |
| `更新進度` | select | 完成、未開始 |
| `支付狀態` | select | 已付尾款、未付款 |
| `負責人` | person | 指派人員 |
| `備註` | text | 備忘 |
| `rezio是否建檔` | select | Rezio 同步狀態 |

### 數字解析邏輯

由於 `總成本`、`總收入`、`利潤` 欄位是文字格式（含計算式），需要智慧解析：

```
解析優先順序：

1. 找「獨立一行的數字」（最後一個）
   → confident: true ✅

2. 找「最後一個 = 數字」
   → confident: true ✅

3. 嘗試計算「開頭的簡單算式」（如 3000+2500）
   → confident: false ⚠️（需核對）

4. 都找不到 → 0，confident: false ⚠️
```

**範例：**

| 輸入 | 解析結果 | confident |
|------|---------|-----------|
| `13600-800(送機招待)\n=12800+1500=14400` | 14400 | ✅ |
| `共: 10750 (等導遊...)\n10750` | 10750 | ✅ |
| `3000+2500(夜間)\n沒計算到總數` | 5500 | ⚠️ |

### 開發項目

| 項目 | 說明 | 狀態 |
|------|------|------|
| Dashboard 頁面路由 | 權限驗證 | ⏳ |
| Notion API 封裝 | 營收、利潤、訂單查詢 | ⏳ |
| 數字解析器強化 | 支援複雜計算式 | ⏳ |
| 頂部數字卡片 | 4 張統計卡片 | ⏳ |
| 月度利潤趨勢圖 | 長條圖 | ⏳ |
| 近期訂單表格 | Tab 切換 | ⏳ |

---

## 3.5 權限架構

### 系統使用者

| 角色 | 人員 | Sanity 權限 | 說明 |
|------|------|-------------|------|
| 老闆 | Eric | Administrator | 唯一最高權限，管理團隊、帳單 |
| 老闆娘 | Min | Editor | 可操作所有內容，不能管團隊/帳單 |
| 女兒 | - | Editor | 同上 |

### 系統架構

```
┌─────────────────────────────────────────────────┐
│                  Sanity Studio                  │
│                                                 │
│   ┌─────────────┐    ┌─────────────────────┐   │
│   │  Dashboard  │    │  客戶行程表系統      │   │
│   │  (財務)     │    │  (建立/編輯/匯出)   │   │
│   └─────────────┘    └─────────────────────┘   │
│                                                 │
│   使用者：Eric (Admin), Min (Editor), 女兒      │
└─────────────────────────────────────────────────┘
           │
           │ LINE 貼上行程文字
           ▼
┌─────────────────────────────────────────────────┐
│   導遊 (郭姐、June姐)                            │
│   - 收到行程文字，不需進系統                     │
│   - 獨立接案，按團報價                          │
└─────────────────────────────────────────────────┘
```

### 設計決策

| 決策 | 選擇 | 理由 |
|------|------|------|
| Dashboard 放哪 | Sanity Studio 內建 Tab | 用現有登入，不用另做權限 |
| 導遊權限 | 不給系統權限 | LINE 溝通即可，維持現有流程 |
| 密碼保護 | 不需要 | Sanity 登入已足夠 |

### 未來擴充（等有需求再做）

| 情境 | 需要做的事 |
|------|-----------|
| 導遊需要自己查行程 | 給導遊獨立入口，只看自己的團 |
| 推薦夥伴追蹤傭金 | 夥伴專屬頁面，看自己推薦的訂單 |
| 請員工 | 依職責給 Editor 權限 |

---

## 3.6 未來擴充（待定）

以下功能視業務需求決定是否實作：

| 功能 | 優先度 | 說明 |
|------|--------|------|
| 自訂報價項目 | 低 | 目前固定項目已足夠 |
| 行程範本庫 | 低 | 複製舊行程已可達成 |
| 客戶管理 (CRM) | 中 | 客戶聯絡資訊、歷史訂單 |
| 自動報價 | 低 | 根據天數自動計算 |

---

## 相關文件

- 結構化編輯器設計：`docs/plans/2026-01-22-structured-form-editor-design.md`
- Dashboard 設計：`docs/plans/2026-01-21-dashboard-and-pdf-itinerary-design.md`
- 進度更新：`docs/updates/2026-01-22-structured-editor-and-quality.md`
- PDF 實作：`docs/plans/2026-01-21-pdf-itinerary-implementation.md`

---

*最後更新：2026-01-22*
