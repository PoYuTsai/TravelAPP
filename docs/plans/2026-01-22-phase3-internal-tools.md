# Phase 3：內部營運工具

> 日期：2026-01-22
> 狀態：✅ 核心功能已完成

---

## 概述

Phase 3 專注於內部營運效率工具，幫助業務快速建立客戶行程表、報價單，並匯出給客戶。

| Phase | 性質 | 目的 | 狀態 |
|-------|------|------|------|
| Phase 1 | 公開網站 | 轉換率優化 | ✅ 完成 |
| Phase 2 | SEO 優化 | 流量獲取 | ✅ 完成 |
| **Phase 3** | **內部工具** | **營運效率** | ✅ 完成 |

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

## 3.4 未來擴充（待定）

以下功能視業務需求決定是否實作：

| 功能 | 優先度 | 說明 |
|------|--------|------|
| 自訂報價項目 | 低 | 目前固定項目已足夠 |
| 行程範本庫 | 低 | 複製舊行程已可達成 |
| 客戶管理 (CRM) | 中 | 客戶聯絡資訊、歷史訂單 |
| 收款追蹤 | 中 | 訂金、尾款狀態 |
| 自動報價 | 低 | 根據天數自動計算 |

---

## 相關文件

- 設計文件：`docs/plans/2026-01-22-structured-form-editor-design.md`
- 進度更新：`docs/updates/2026-01-22-structured-editor-and-quality.md`
- PDF 實作：`docs/plans/2026-01-21-pdf-itinerary-implementation.md`

---

*最後更新：2026-01-22*
