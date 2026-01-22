# 進度更新：結構化編輯器 & 程式碼品質改善

> 日期：2026-01-22
> 狀態：已完成

---

## 1. 結構化表單編輯器 ✅

基於 `docs/plans/2026-01-22-structured-form-editor-design.md` 設計文件實作完成。

### 已完成功能

| 功能 | 狀態 | 說明 |
|------|------|------|
| Schema 更新 | ✅ | 航班、導遊、座椅、雙條車、車輛欄位 |
| 基本資訊表單 | ✅ | StructuredBasicInfoForm 元件 |
| 報價明細表格 | ✅ | StructuredQuotationTable 元件 |
| 驗證狀態 | ✅ | ValidationStatus 元件 |
| 行程文字編輯 | ✅ | 使用 useRef 避免游標跳掉 |
| 備註編輯 | ✅ | 純文字 textarea |

### 元件結構

```
src/sanity/components/structured-editor/
├── StructuredBasicInfoForm.tsx  # 基本資訊表單
├── StructuredQuotationTable.tsx # 報價明細表格
├── ValidationStatus.tsx         # 驗證狀態顯示
├── flight-data.ts               # 航班資料庫
├── types.ts                     # 型別定義
└── index.ts                     # 統一匯出
```

---

## 2. Bug 修復 ✅

### 2.1 導遊天數顯示問題
- **問題**：導遊天數 0 時無法顯示
- **原因**：使用 `||` 而非 `??`，0 被視為 falsy
- **修復**：改用 `??` nullish coalescing

### 2.2 晚餐重複問題
- **問題**：使用結構化編輯器後，晚餐在「晚」欄位重複出現
- **原因**：餐點同時加到 `dayActivities` 和 `dinner` 欄位
- **修復**：餐點只存到專屬欄位，不加入 `dayActivities`

### 2.3 包車台數未關聯報價
- **問題**：勾選 2 台車，報價仍顯示 1 台價格
- **修復**：報價表格乘以 `vehicleCount`

### 2.4 Excel「晚」欄位缺少晚餐
- **問題**：Excel 的「晚」欄位沒有晚餐資訊
- **原因**：`evening` 只包含夜市活動，`dinner` 是獨立欄位
- **修復**：`distributeActivities()` 將晚餐加入 evening 輸出

### 2.5 按摩誤判為晚間活動
- **問題**：按摩被歸類到「晚」，但可能下午去
- **修復**：移除「按摩」從 `isEveningOnly()` 關鍵字

---

## 3. 程式碼品質改善 ✅

### 3.1 模組化重構

將 852 行的 `itinerary-parser.ts` 拆分為：

```
src/lib/itinerary/
├── types.ts      # 型別定義 (ParsedDay, ParseResult, etc.)
├── parser.ts     # 解析函數 (parseItineraryText, etc.)
├── formatter.ts  # 格式化函數 (formatToLineText, etc.)
├── hotels.ts     # 飯店處理 (generateHotelsFromDays)
└── index.ts      # 統一匯出
```

原檔案 `src/lib/itinerary-parser.ts` 保持向後相容，重新匯出所有函數。

### 3.2 測試覆蓋

| 測試檔案 | 測試數量 | 涵蓋範圍 |
|---------|---------|---------|
| itinerary-parser.test.ts | 29 | 解析器、格式化器 |
| pdf-template.test.ts | 25 | PDF 模板函數 |
| **總計** | **54** | |

### 3.3 ErrorBoundary 元件

新增 `src/sanity/components/ErrorBoundary.tsx`：
- 捕捉 React 渲染錯誤
- 防止整個 Sanity Studio 崩潰
- 整合到 syncFromTextAction、importTextAction

### 3.4 E2E 測試基礎

設定 Playwright：
- `playwright.config.ts` - 設定檔
- `e2e/homepage.spec.ts` - 首頁測試
- `e2e/sanity-studio.spec.ts` - Studio 測試
- 腳本：`npm run test:e2e`

### 3.5 錯誤日誌工具

新增 `src/lib/logger/index.ts`：
- 統一的 logger 介面
- 支援 debug/info/warn/error 級別
- 專用 loggers：`sanityLogger`、`apiLogger`、`pdfLogger`

---

## 4. 時區修復 ✅

所有日期處理加上 `T00:00:00` 避免 UTC 解讀：

```typescript
// 之前（有時區問題）
const date = new Date('2026-02-12')

// 之後（正確）
const date = new Date('2026-02-12T00:00:00')
```

已修復檔案：
- `src/lib/itinerary/parser.ts`
- `src/lib/itinerary/hotels.ts`
- `src/lib/pdf/itinerary-template.ts`
- `src/lib/excel/itinerary-template.ts`
- `src/sanity/components/structured-editor/StructuredQuotationTable.tsx`

---

## 5. Git 紀錄

```
62fde06 fix: 修正 Excel「晚」欄位包含晚餐
061a61a refactor: 模組化重構與測試基礎設施完善
e09f9c7 feat: 強化驗證和錯誤處理
c391c91 fix: 修復多個潛在錯誤
3084b68 feat: 包車台數關聯到每日報價
b643e2b fix: 修復導遊天數顯示和晚餐重複問題
```

---

## 6. 目前系統狀態

| 項目 | 狀態 |
|------|------|
| 結構化編輯器 | ✅ 運作正常 |
| PDF 匯出 | ✅ 運作正常 |
| Excel 匯出 | ✅ 運作正常 |
| LINE 文字匯出 | ✅ 運作正常 |
| 單元測試 | ✅ 54 tests passing |
| TypeScript | ✅ 無編譯錯誤 |
