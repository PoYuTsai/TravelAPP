# Sanity 後台功能更新 - 2026/01/21

## 新功能：快速建立行程

### 功能說明
在 Sanity 後台新增「快速建立」功能，讓使用者可以貼上文字自動解析成結構化的行程資料。

### 新增檔案

| 檔案 | 說明 |
|------|------|
| `src/sanity/components/QuickStartInput.tsx` | 紫色快速建立按鈕元件，在新文件頂部顯示 |
| `src/sanity/components/QuickStartBanner.tsx` | 快速建立提示橫幅（備用） |
| `src/sanity/actions/quickCreateAction.tsx` | 快速建立 Document Action |
| `src/sanity/actions/syncFromTextAction.tsx` | 編輯行程文字 Action（從既有天數生成文字供編輯） |

### 修改檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/lib/itinerary-parser.ts` | 新增 `parseBasicInfoText()` 和 `parseQuotationText()` 解析器 |
| `src/sanity/schemas/itinerary.ts` | 新增 `quickStartHint` 欄位顯示快速建立按鈕 |
| `sanity.config.ts` | 註冊 quickCreateAction, syncFromTextAction 等 Actions |

### 功能詳情

#### 1. 快速建立按鈕
- 位置：新文件頂部（紫色漸層卡片）
- 觸發：點擊後開啟對話框
- 內容：三個文字區域（基本資訊、行程內容、報價明細）
- 流程：填寫 → 預覽 → 確認匯入

#### 2. 文字解析器支援格式

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

#### 3. 編輯行程文字 Action
- 位置：Document Actions 下拉選單
- 功能：從既有的 `days` 資料生成可編輯文字
- 用途：微調已建立的行程

### 移除功能
- 移除「自動產生天數」Action（與快速建立重複）

---

## 匯出功能

### 既有功能
- **匯出 PDF**: 使用 Puppeteer 產生 PDF
- **匯出 Excel**: 使用 exceljs 產生 xlsx
- **匯出文字**: 產生純文字行程表

### 相關檔案
| 檔案 | 說明 |
|------|------|
| `src/app/api/itinerary/[id]/pdf/route.ts` | PDF 匯出 API |
| `src/app/api/itinerary/[id]/excel/route.ts` | Excel 匯出 API |
| `src/app/api/itinerary/[id]/text/route.ts` | 文字匯出 API |
| `src/lib/pdf/itinerary-template.ts` | PDF HTML 模板 |
| `src/lib/excel/itinerary-excel.ts` | Excel 產生器 |
| `src/sanity/actions/exportPdfAction.tsx` | PDF 匯出 Action |
| `src/sanity/actions/exportExcelAction.tsx` | Excel 匯出 Action |
| `src/sanity/actions/exportTextAction.tsx` | 文字匯出 Action |

---

## 待處理問題
- [ ] PDF 匯出有時會卡住（可能是 Puppeteer 在 WSL 環境的問題）
- [ ] 需要重啟 dev server 才能解決

## 測試方式
1. 開啟 `/studio`
2. 點擊「客戶行程表」旁的 `+` 新增
3. 看到紫色「點我快速建立行程」按鈕
4. 點擊後填入文字，預覽並確認匯入
