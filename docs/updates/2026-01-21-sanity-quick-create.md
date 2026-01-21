# Sanity 後台功能更新 - 2026/01/21

## 概要
本次更新新增「快速建立行程」和「匯出功能」，並加入單元測試。後續修復 Vercel 部署問題、PDF 匯出、Excel 時段分配邏輯。

---

## 新功能：快速建立行程

### 功能說明
在 Sanity 後台新增「快速建立」功能，讓使用者可以貼上文字自動解析成結構化的行程資料。

### 使用流程
1. 點擊「客戶行程表」旁的 `+` 新增
2. 看到紫色「點我快速建立行程」按鈕
3. 點擊後填入三個區塊：基本資訊、行程內容、報價明細
4. 點「預覽解析結果」確認
5. 點「確認匯入」完成

### 新增檔案

| 檔案 | 說明 |
|------|------|
| `src/sanity/components/QuickStartInput.tsx` | 紫色快速建立按鈕元件 |
| `src/sanity/actions/syncFromTextAction.tsx` | 編輯行程文字 Action |
| `src/sanity/actions/duplicateItineraryAction.tsx` | 複製行程 Action |
| `src/lib/itinerary-parser.ts` | 文字解析器 |

### 文字解析器支援格式

**基本資訊** (`parseBasicInfoText`):
```
客戶姓名: 巧玲(KAI &MINNIE 媽)
日期: 2026/2/12~2/18
人數: 5人
成人3 (1長者) 小朋友2 (國中生*2)
行李: 1台車大約可以放6~7顆28~30吋
包車: 1台(10人座大車)
導遊: 中英泰導遊 1位
```

**行程內容** (`parseItineraryText`):
```
2/12 (四)
Day 1｜抵達清邁・放鬆展開旅程
・機場接機 (CI851 7:20-10:35)
午餐：Neng earthn jar roast pork
晚餐: 黑森林餐廳
・住宿
```

**報價明細** (`parseQuotationText`):
```
2/12 接機+市區 3200
2/13 湄康蓬 3800
導遊 2500*6天
保險 500
小計: 38700
```

---

## 匯出功能

### 功能列表
| 功能 | 說明 | Action 位置 |
|------|------|-------------|
| 匯出 PDF | 使用 Puppeteer 產生 PDF | Document Actions |
| 匯出 Excel | 使用 exceljs 產生 xlsx | Document Actions |
| 匯出 LINE 文字 | 產生純文字行程表 | Document Actions |

### 相關檔案
| 檔案 | 說明 |
|------|------|
| `src/app/api/itinerary/[id]/pdf/route.ts` | PDF 匯出 API |
| `src/app/api/itinerary/[id]/excel/route.ts` | Excel 匯出 API |
| `src/app/api/itinerary/[id]/text/route.ts` | 文字匯出 API |
| `src/lib/pdf/itinerary-template.ts` | PDF HTML 模板 |
| `src/lib/excel/itinerary-template.ts` | Excel 產生器 |
| `src/sanity/actions/exportPdfAction.tsx` | PDF 匯出 Action |
| `src/sanity/actions/exportExcelAction.tsx` | Excel 匯出 Action |
| `src/sanity/actions/exportTextAction.tsx` | 文字匯出 Action |

---

## Vercel 部署修復

### PDF 匯出修復
Vercel serverless 環境無法使用標準 Puppeteer（無 Chromium），改用：
- `puppeteer-core` + `@sparticuz/chromium-min`
- 執行時從 GitHub 下載 Chromium binary

```typescript
// src/app/api/itinerary/[id]/pdf/route.ts
import puppeteerCore from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

const CHROMIUM_URL = 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'

const browser = await puppeteerCore.launch({
  args: chromium.args,
  executablePath: await chromium.executablePath(CHROMIUM_URL),
  headless: true,
})
```

### TypeScript 型別修復
修復 Vercel 嚴格型別檢查錯誤：

| 檔案 | 修復內容 |
|------|----------|
| `src/app/api/itinerary/[id]/excel/route.ts` | `new Uint8Array(excel)` |
| `src/app/api/itinerary/[id]/pdf/route.ts` | `pdf as unknown as BodyInit` |
| `src/sanity/actions/duplicateItineraryAction.tsx` | `Record<string, any>` + `as any` |
| `src/sanity/components/QuickStartInput.tsx` | `createOrReplace(doc as any)` |
| `src/sanity/schemas/itinerary.ts` | `days: any[] \| undefined` |

---

## Excel 時段分配邏輯

### 改進說明
優化 `parseItineraryText` 的活動分配邏輯，讓 Excel 匯出的「早/午/晚」欄位正確顯示。

### 分配規則

**有午餐的情況：**
- 午餐前 → 早
- 午餐後到晚餐前 → 午
- 晚餐和住宿 → 晚

**沒有午餐的情況：**
- 自動對半分配（前半 → 早，後半 → 午）
- 晚餐和住宿 → 晚

### 晚上專屬內容
以下關鍵字固定放在「晚」：
- 晚餐、住宿、dinner、hotel

### 相關函數
```typescript
// src/lib/itinerary-parser.ts
function isEveningOnly(content: string): boolean
function distributeActivities(activities, lunch, dinner): { morning, afternoon, evening }
```

---

## PDF 活動列表修復

### 問題
`QuickStartInput` 匯入時沒有填入 `activities[]` 陣列，導致 PDF 無內容。

### 修復
```typescript
// src/sanity/components/QuickStartInput.tsx
const daysData = itineraryResult.days.map((day, index) => ({
  // ... 其他欄位
  activities: day.activities?.map((act, actIndex) => ({
    _key: `act-${index}-${actIndex}-${Date.now()}`,
    _type: 'activity',
    time: act.time || '',
    content: act.content,
  })) || [],
}))
```

---

## 單元測試

### 測試設定
- 測試框架：Vitest
- 設定檔：`vitest.config.ts`

### 測試檔案
- `src/lib/__tests__/itinerary-parser.test.ts` - 29 個測試

### 執行測試
```bash
npm test        # watch 模式
npm run test:run  # 執行一次
```

### 測試覆蓋
| 函數 | 測試項目 |
|------|----------|
| `parseBasicInfoText` | 客戶名、日期、人數、團型、行李、包車、導遊 |
| `parseItineraryText` | 單日/多日行程、活動分時段、Day標題、住宿放晚上、無午餐自動分配 |
| `parseQuotationText` | 帶日期項目、乘數格式、簡單項目、小計 |
| `formatToLineText` | 格式化輸出 |
| `sanityToLineText` | Sanity 轉 LINE 文字 |

---

## Document Actions 列表

| Action | 說明 | 顯示條件 |
|--------|------|----------|
| 編輯行程文字 | 從既有天數生成文字供編輯 | itinerary 類型 |
| 複製行程 | 複製當前行程 | itinerary 類型 |
| 匯出 LINE 文字 | 產生純文字 | itinerary 類型 |
| 匯出 PDF | 下載 PDF | 已發布文件 |
| 匯出 Excel | 下載 xlsx | 已發布文件 |

---

## 修改的設定檔

| 檔案 | 修改內容 |
|------|----------|
| `sanity.config.ts` | 註冊 Document Actions |
| `src/sanity/schemas/itinerary.ts` | 新增 itinerary schema |
| `src/sanity/schemas/index.ts` | 匯出 itinerary schema |
| `src/sanity/structure.ts` | 新增行程列表結構 |
| `package.json` | 新增 vitest, exceljs, puppeteer-core, @sparticuz/chromium-min 等依賴 |

---

## Git Commits (2026/01/21)

```
95466e3 fix: include activities array for PDF export in QuickStartInput
79c8ace test: add tests for activity distribution logic
98aa5c3 feat: improve activity distribution logic for Excel export
c228456 feat: improve time slot detection in itinerary parser
67dd92e fix: use chromium-min with external download URL for Vercel
6fc180e fix: improve PDF generation error handling and config
36b6477 fix: use @sparticuz/chromium for PDF generation on Vercel
2cb6fee fix: add type annotations for Sanity client calls and validation
3c3e9a5 fix: cast newDoc as any for client.create
394f98b fix: add type annotation for newDoc in duplicateItineraryAction
59bd946 fix: cast pdf buffer type for NextResponse
```
