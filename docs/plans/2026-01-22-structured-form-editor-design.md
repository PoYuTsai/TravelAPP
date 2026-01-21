# 結構化表單編輯器設計文件

> 日期：2026-01-22
> 狀態：設計完成，待實作

---

## 1. 概述

### 1.1 背景

目前「文字編輯」功能使用純文字輸入，透過 parser 解析後寫入 Sanity 欄位。這種方式雖然彈性，但存在以下問題：

- 格式容易出錯（漏寫冒號、符號不對）
- 無法做跨欄位驗證（導遊欄位 ↔ 報價連動）
- 無法自動計算（導遊費、保險費、總額）
- 航班資訊需要手動輸入，容易打錯

### 1.2 目標

將「文字編輯」升級為「結構化表單編輯器」：

1. **基本資訊**：從純文字改為表單輸入（下拉選單、勾選框、數字欄位）
2. **報價明細**：從純文字改為可編輯表格，支援自動計算
3. **行程內容**：保持純文字，但新增可收合的範本參考面板
4. **備註**：維持純文字不變

### 1.3 不變的部分

| 項目 | 說明 |
|------|------|
| Sanity schema 欄位結構 | 僅新增少數欄位，現有欄位不動 |
| LINE 文字匯出 | 純文字三區塊格式，完全不變 |
| PDF 匯出 | HTML 排版，完全不變 |
| Excel 匯出 | 表格格式，完全不變 |

**核心原則**：只改輸入介面，不改輸出格式。

---

## 2. Schema 變更

### 2.1 新增欄位

在 `itinerary.ts` schema 新增以下欄位：

```typescript
// === 航班資訊 ===
defineField({
  name: 'arrivalFlight',
  title: '接機航班',
  type: 'object',
  group: 'basic',
  fields: [
    defineField({
      name: 'preset',
      title: '常用航班',
      type: 'string',
      options: {
        list: [
          { title: '華航 CI851 (07:30-10:20)', value: 'CI851' },
          { title: '長榮 BR257 (07:25-10:25)', value: 'BR257' },
          { title: '星宇 JX751 (13:20-16:20)', value: 'JX751' },
          { title: '亞航 FD243 (18:55-21:45)', value: 'FD243' },
          { title: '其他（自訂）', value: 'custom' },
        ],
      },
    }),
    defineField({
      name: 'custom',
      title: '自訂航班',
      type: 'string',
      description: '格式：航空公司 航班號 (起飛-抵達)',
      hidden: ({ parent }) => parent?.preset !== 'custom',
    }),
  ],
}),

defineField({
  name: 'departureFlight',
  title: '送機航班',
  type: 'object',
  group: 'basic',
  fields: [
    defineField({
      name: 'preset',
      title: '常用航班',
      type: 'string',
      options: {
        list: [
          { title: '華航 CI852 (11:20-16:00)', value: 'CI852' },
          { title: '長榮 BR258 (11:35-16:35)', value: 'BR258' },
          { title: '星宇 JX752 (17:20-22:10)', value: 'JX752' },
          { title: '亞航 FD242 (01:40-06:35)', value: 'FD242' },
          { title: '其他（自訂）', value: 'custom' },
        ],
      },
    }),
    defineField({
      name: 'custom',
      title: '自訂航班',
      type: 'string',
      hidden: ({ parent }) => parent?.preset !== 'custom',
    }),
  ],
}),

// === 服務選項 ===
defineField({
  name: 'guideService',
  title: '導遊服務',
  type: 'object',
  group: 'basic',
  fields: [
    defineField({
      name: 'required',
      title: '需要導遊',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'quantity',
      title: '導遊人數',
      type: 'number',
      initialValue: 1,
      hidden: ({ parent }) => !parent?.required,
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: 'days',
      title: '導遊天數',
      type: 'number',
      hidden: ({ parent }) => !parent?.required,
      validation: (Rule) => Rule.min(1),
    }),
  ],
}),

defineField({
  name: 'childSeat',
  title: '兒童安全座椅',
  type: 'object',
  group: 'basic',
  fields: [
    defineField({
      name: 'required',
      title: '需要',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'quantity',
      title: '數量（張）',
      type: 'number',
      hidden: ({ parent }) => !parent?.required,
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: 'days',
      title: '天數',
      type: 'number',
      hidden: ({ parent }) => !parent?.required,
      validation: (Rule) => Rule.min(1),
    }),
  ],
}),

defineField({
  name: 'extraVehicle',
  title: '額外雙條車（行李用）',
  type: 'object',
  group: 'basic',
  fields: [
    defineField({
      name: 'required',
      title: '需要',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'quantity',
      title: '數量（台）',
      type: 'number',
      initialValue: 1,
      hidden: ({ parent }) => !parent?.required,
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: 'days',
      title: '天數',
      type: 'number',
      hidden: ({ parent }) => !parent?.required,
      validation: (Rule) => Rule.min(1),
    }),
  ],
}),

// === 車輛資訊 ===
defineField({
  name: 'vehicleCount',
  title: '包車台數',
  type: 'number',
  group: 'basic',
  initialValue: 1,
  validation: (Rule) => Rule.min(1),
}),

defineField({
  name: 'vehicleType',
  title: '車型',
  type: 'string',
  group: 'basic',
  options: {
    list: [
      { title: '4人座小車', value: 'sedan' },
      { title: '7人座休旅車', value: 'suv' },
      { title: '10人座大車（麵包車）', value: 'van' },
      { title: '其他', value: 'custom' },
    ],
  },
  initialValue: 'van',
}),
```

### 2.2 驗證規則（阻擋儲存）

```typescript
// 在 quotationItems 欄位加入驗證
validation: (Rule) => [
  Rule.custom((items, context) => {
    const parent = context.parent as {
      guideService?: { required?: boolean }
      childSeat?: { required?: boolean }
      extraVehicle?: { required?: boolean }
    }

    const hasGuideItem = items?.some(item =>
      item.description?.includes('導遊') && item.unitPrice > 0
    )
    const hasChildSeatItem = items?.some(item =>
      item.description?.includes('座椅') && item.unitPrice > 0
    )
    const hasExtraVehicleItem = items?.some(item =>
      item.description?.includes('雙條車') && item.unitPrice > 0
    )

    // 導遊驗證
    if (parent?.guideService?.required && !hasGuideItem) {
      return '已勾選需要導遊，但報價中沒有「導遊」項目或費用為 0'
    }

    // 兒童座椅驗證
    if (parent?.childSeat?.required && !hasChildSeatItem) {
      return '已勾選需要兒童座椅，但報價中沒有「座椅」項目或費用為 0'
    }

    // 雙條車驗證
    if (parent?.extraVehicle?.required && !hasExtraVehicleItem) {
      return '已勾選需要雙條車，但報價中沒有「雙條車」項目或費用為 0'
    }

    return true
  }),
],
```

---

## 3. UI 設計

### 3.1 整體結構

```
┌─────────────────────────────────────────────────────┐
│ 結構化編輯器                                    [X] │
├─────────────────────────────────────────────────────┤
│ ❶ 基本資訊（表單）                    [重置為範本] │
│ ❷ 行程內容（文字 + 參考面板）         [重置為範本] │
│ ❸ 報價明細（表格 + 自動計算）         [重置為範本] │
│ ❹ 備註（純文字）                                   │
├─────────────────────────────────────────────────────┤
│ [驗證狀態]                                          │
│                    [同步更新]  [取消]               │
└─────────────────────────────────────────────────────┘
```

### 3.2 基本資訊區塊

```
┌─────────────────────────────────────────────────────┐
│ ❶ 基本資訊                            [重置為範本] │
├─────────────────────────────────────────────────────┤
│ 姓名          [_______________________________]     │
│                                                     │
│ 日期          [2026/02/12] ～ [2026/02/18]  7天6夜 │
│                                                     │
│ ─────────────── 航班資訊 ───────────────            │
│ 接機航班      [▼ 華航 CI851 (07:30-10:20)      ]   │
│               ☀️ 早班機：可安排完整首日行程          │
│                                                     │
│ 送機航班      [▼ 華航 CI852 (11:20-16:00)      ]   │
│               ✈️ 中午班機：建議 9:00 前出發送機      │
│                                                     │
│ ─────────────── 人數 ───────────────                │
│ 成人 [3]      小朋友 [2]      年齡 [國中生*2]       │
│ 身高 [________________________]（選填）             │
│ 總人數：5 人                                        │
│                                                     │
│ ─────────────── 服務選項 ───────────────            │
│ [✓] 需要導遊          [1] 位  [6] 天               │
│ [ ] 兒童安全座椅      [_] 張  [_] 天               │
│ [ ] 額外雙條車        [1] 台  [_] 天               │
│                                                     │
│ ─────────────── 車輛安排 ───────────────            │
│ 包車 [1] 台   車型 [▼ 10人座大車]                  │
│ 行李備註 [1台大約可放6~7顆28~30吋____________]      │
└─────────────────────────────────────────────────────┘
```

**航班智慧提示**：

| 航班 | 類型 | 提示 |
|------|------|------|
| CI851/BR257 | 早班 | ☀️ 早班機：可安排完整首日行程 |
| JX751 | 午班 | 🌤️ 午班機：首日可安排晚餐+夜間活動 |
| FD243 | 晚班 | 🌙 晚班機：首日僅接機+入住 |
| CI852/BR258 | 中午 | ✈️ 建議 9:00 前出發送機 |
| JX752 | 下午 | ✈️ 可安排午餐後送機 |
| FD242 | 紅眼 | 🌙 紅眼班機：可安排完整末日+晚餐 |

### 3.3 行程內容區塊

```
┌─────────────────────────────────────────────────────┐
│ ❷ 行程內容                            [重置為範本] │
├─────────────────────────────────────────────────────┤
│ [▶ 顯示範本參考]                                    │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 📋 範本參考（唯讀・點擊收合）          [收合 ▲] │ │
│ │ 2/12 (四)                                       │ │
│ │ Day 1｜抵達清邁・放鬆展開旅程                   │ │
│ │ ・機場接機 (CI851 07:30-10:20)                  │ │
│ │ 午餐：Neng earthn jar roast pork                │ │
│ │ 晚餐：黑森林餐廳                                │ │
│ │ ・住宿：Nimman Villa 17                         │ │
│ │ ...                                             │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [插入 Day 分隔] [插入午餐] [插入晚餐] [插入住宿]    │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 2/12 (四)                                       │ │
│ │ Day 1｜抵達清邁・放鬆展開旅程                   │ │
│ │ ・機場接機 (CI851 07:30-10:20)                  │ │
│ │ ...                                             │ │
│ │                                    [20 rows]    │ │
│ └─────────────────────────────────────────────────┘ │
│ 📏 行數：87 行 ｜ 📅 共 7 天                        │
└─────────────────────────────────────────────────────┘
```

**UX 規格**：

| 項目 | 規格 |
|------|------|
| 元件 | 原生 `<textarea>` + `useRef`（避免游標跳掉）|
| 高度 | `min-height: 400px`，可拖曳（`resize: vertical`）|
| 字體 | `monospace`，14px，行高 1.6 |
| Tab 鍵 | 支援插入 2 空格（不跳出）|
| 快捷按鈕 | 插入常用格式到游標位置 |

### 3.4 報價明細區塊

```
┌─────────────────────────────────────────────────────┐
│ ❸ 報價明細                            [重置為範本] │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 📅 每日包車費用                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │  日期        說明              單價       小計  │ │
│ │ ─────────────────────────────────────────────── │ │
│ │  2/12 (四)  [接機+市區_____]  [3200]     3,200 │ │
│ │  2/13 (五)  [湄康蓬_________]  [3800]     3,800 │ │
│ │  2/14 (六)  [湄林___________]  [3800]     3,800 │ │
│ │  2/15 (日)  [市區___________]  [3500]     3,500 │ │
│ │  2/16 (一)  [清萊___________]  [4500]     4,500 │ │
│ │  2/17 (二)  [湄登___________]  [3800]     3,800 │ │
│ │  2/18 (三)  [送機___________]  [ 600]       600 │ │
│ │ ─────────────────────────────────────────────── │ │
│ │                          包車小計：     23,200 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ 📋 其他費用                                         │
│ ┌─────────────────────────────────────────────────┐ │
│ │  項目       單價    數量   天/人    單位   小計 │ │
│ │ ─────────────────────────────────────────────── │ │
│ │  導遊 ✓    [2500] × [1]位 × [6]天 =    15,000 │ │
│ │  兒童座椅  [ 200] × [2]張 × [7]天 =     2,800 │ │
│ │  雙條車    [1500] × [1]台 × [7]天 =    10,500 │ │
│ │  保險      [ 100] × [5]人         =       500 │ │
│ │  外地住宿  [ 500] × [2]人 × [1]晚 =     1,000 │ │
│ │ ─────────────────────────────────────────────── │ │
│ │  [+ 新增自訂項目]                               │ │
│ │                          其他小計：     29,800 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ═══════════════════════════════════════════════════ │
│    包車小計    23,200                               │
│  + 其他小計    29,800                               │
│  ─────────────────────                              │
│    總計        NT$ 53,000                           │
└─────────────────────────────────────────────────────┘
```

**自動計算公式**：

| 項目 | 公式 |
|------|------|
| 導遊 | 單價 × 數量 × 天數 |
| 兒童座椅 | 單價 × 數量 × 天數 |
| 雙條車 | 單價 × 數量 × 天數 |
| 保險 | 單價 × 總人數 |
| 外地住宿 | 單價 × (司機人數+導遊人數) × 晚數 |

**外地住宿人數計算**：
```
外地住宿人數 = 包車台數（司機）+ 導遊人數
```

**數值連動**：

| 報價欄位 | 自動帶入來源 |
|---------|-------------|
| 導遊數量、天數 | 基本資訊 → 導遊服務 |
| 座椅數量、天數 | 基本資訊 → 兒童座椅 |
| 雙條車數量、天數 | 基本資訊 → 額外雙條車 |
| 保險人數 | 基本資訊 → 總人數 |
| 外地住宿人數 | 包車台數 + 導遊人數 |

### 3.5 備註區塊

```
┌─────────────────────────────────────────────────────┐
│ ❹ 備註                                              │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ 包含: 油費、停車費、過路費、外地住宿補貼...     │ │
│ │ 不包含: 門票、餐費、機票跟飯店...               │ │
│ │ **溫馨提醒**                                    │ │
│ │ 1.泰國入境的規定...                             │ │
│ │                                   [15 rows]     │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

純文字 textarea，不做結構化。

### 3.6 驗證與操作區

```
┌─────────────────────────────────────────────────────┐
│ ─────────────── 驗證狀態 ───────────────            │
│ ✅ 導遊：已勾選，報價已包含                         │
│ ⚪ 兒童座椅：未勾選                                 │
│ ⚪ 雙條車：未勾選                                   │
├─────────────────────────────────────────────────────┤
│              [同步更新]        [取消]               │
└─────────────────────────────────────────────────────┘
```

**驗證失敗時**：

```
┌─────────────────────────────────────────────────────┐
│ ─────────────── 驗證狀態 ───────────────            │
│ ❌ 已勾選「雙條車」，但報價中雙條車費用為 0         │
├─────────────────────────────────────────────────────┤
│              [同步更新]（disabled） [取消]          │
└─────────────────────────────────────────────────────┘
```

---

## 4. 實作分階段

### Phase 1：Schema 更新（0.5 天）

- [ ] 新增航班欄位（arrivalFlight, departureFlight）
- [ ] 新增服務選項欄位（guideService, childSeat, extraVehicle）
- [ ] 新增車輛欄位（vehicleCount, vehicleType）
- [ ] 新增跨欄位驗證規則
- [ ] 測試 schema 變更不影響現有資料

### Phase 2：基本資訊表單（1 天）

- [ ] 建立 StructuredBasicInfoForm 元件
- [ ] 實作航班下拉選單（含「其他」選項 + 智慧提示）
- [ ] 實作人數欄位（成人、小朋友、年齡、身高）
- [ ] 實作服務選項勾選框（導遊、座椅、雙條車 + 數量 + 天數）
- [ ] 實作車輛安排（台數、車型、行李備註）
- [ ] 實作「重置為範本」按鈕

### Phase 3：報價表格（1 天）

- [ ] 建立 StructuredQuotationTable 元件
- [ ] 實作每日包車費用表格（日期自動產生）
- [ ] 實作其他費用區塊（導遊、座椅、雙條車、保險、外地住宿）
- [ ] 實作自動計算邏輯
- [ ] 實作數值連動（基本資訊 → 報價）
- [ ] 實作「新增自訂項目」功能
- [ ] 實作驗證提示

### Phase 4：行程內容面板（0.5 天）

- [ ] 實作可收合的範本參考面板
- [ ] 實作原生 textarea 編輯區（避免游標跳掉）
- [ ] 實作 Tab 鍵支援
- [ ] 實作快捷插入按鈕
- [ ] 實作「重置為範本」按鈕

### Phase 5：整合測試（0.5 天）

- [ ] 整合所有區塊到 syncFromTextAction
- [ ] 測試「同步更新」寫入 Sanity
- [ ] 測試驗證規則阻擋儲存
- [ ] 測試匯出功能（LINE/PDF/Excel）不受影響
- [ ] 測試現有資料可正常開啟編輯

---

## 5. 技術架構

### 5.1 元件結構

```
src/sanity/
├── actions/
│   └── syncFromTextAction.tsx         # 主對話框（重構）
├── components/
│   ├── QuickStartInput.tsx            # 現有快速建立（不動）
│   ├── structured-editor/
│   │   ├── StructuredBasicInfoForm.tsx
│   │   ├── StructuredQuotationTable.tsx
│   │   ├── ItineraryReferencePanel.tsx
│   │   ├── ItineraryTextEditor.tsx
│   │   └── ValidationStatus.tsx
│   └── shared/
│       └── FlightSelector.tsx
└── schemas/
    └── itinerary.ts                   # Schema 更新
```

### 5.2 狀態管理

```typescript
interface EditorState {
  // 基本資訊
  basicInfo: {
    clientName: string
    startDate: string
    endDate: string
    arrivalFlight: { preset: string; custom?: string }
    departureFlight: { preset: string; custom?: string }
    adults: number
    children: number
    childrenAges: string
    childrenHeight: string
    guideService: { required: boolean; quantity: number; days: number }
    childSeat: { required: boolean; quantity: number; days: number }
    extraVehicle: { required: boolean; quantity: number; days: number }
    vehicleCount: number
    vehicleType: string
    luggageNote: string
  }

  // 行程（純文字）
  itineraryText: string

  // 報價
  quotation: {
    dailyItems: Array<{
      date: string
      weekday: string
      description: string
      price: number
    }>
    guidePrice: number
    childSeatPrice: number
    extraVehiclePrice: number
    insurancePrice: number
    outOfTownStay: { pricePerPerson: number; nights: number }
    customItems: Array<{ name: string; price: number }>
  }

  // 備註（純文字）
  notes: string

  // 驗證狀態
  validation: {
    isValid: boolean
    errors: string[]
  }
}
```

### 5.3 航班資料庫

```typescript
export const FLIGHT_DATABASE = {
  arrival: [
    {
      value: 'CI851',
      label: '華航 CI851 (07:30-10:20)',
      type: 'morning',
      hint: '☀️ 早班機：可安排完整首日行程'
    },
    {
      value: 'BR257',
      label: '長榮 BR257 (07:25-10:25)',
      type: 'morning',
      hint: '☀️ 早班機：可安排完整首日行程'
    },
    {
      value: 'JX751',
      label: '星宇 JX751 (13:20-16:20)',
      type: 'afternoon',
      hint: '🌤️ 午班機：首日可安排晚餐+夜間活動'
    },
    {
      value: 'FD243',
      label: '亞航 FD243 (18:55-21:45)',
      type: 'evening',
      hint: '🌙 晚班機：首日僅接機+入住'
    },
    {
      value: 'custom',
      label: '其他（自訂）',
      type: 'custom',
      hint: ''
    },
  ],
  departure: [
    {
      value: 'CI852',
      label: '華航 CI852 (11:20-16:00)',
      type: 'midday',
      hint: '✈️ 建議 9:00 前出發送機'
    },
    {
      value: 'BR258',
      label: '長榮 BR258 (11:35-16:35)',
      type: 'midday',
      hint: '✈️ 建議 9:00 前出發送機'
    },
    {
      value: 'JX752',
      label: '星宇 JX752 (17:20-22:10)',
      type: 'afternoon',
      hint: '✈️ 可安排午餐後送機'
    },
    {
      value: 'FD242',
      label: '亞航 FD242 (01:40-06:35)',
      type: 'redeye',
      hint: '🌙 紅眼班機：可安排完整末日+晚餐'
    },
    {
      value: 'custom',
      label: '其他（自訂）',
      type: 'custom',
      hint: ''
    },
  ],
}
```

---

## 6. 風險與緩解

| 風險 | 影響 | 緩解措施 |
|------|------|---------|
| Schema 變更影響現有資料 | 高 | 新欄位都是 optional，不影響現有文件 |
| UI 複雜度增加 | 中 | 分階段實作，每階段測試 |
| 匯出功能受影響 | 高 | 匯出讀取的欄位不變，只增加輸入方式 |
| 游標跳掉問題復發 | 中 | 使用原生 textarea + useRef |

---

## 7. 成功指標

- [ ] 可選擇常用航班或自訂輸入
- [ ] 服務選項（導遊/座椅/雙條車）可設定數量和天數
- [ ] 報價自動計算正確（含外地住宿補貼）
- [ ] 驗證連動正常（勾選服務 ↔ 報價項目）
- [ ] 行程編輯無游標跳掉問題
- [ ] 匯出功能（LINE/PDF/Excel）正常運作
- [ ] 現有資料可正常開啟編輯
