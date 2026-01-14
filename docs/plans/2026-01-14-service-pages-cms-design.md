# 服務頁面 CMS 化設計文件

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將包車服務與民宿頁面改為 Sanity CMS 管理，讓內容可在後台編輯

**Architecture:** 使用 Sanity Singleton 模式管理單一頁面，前端透過 API 取得資料渲染

**Tech Stack:** Next.js 14, Sanity CMS, TypeScript, Tailwind CSS

---

## 一、整體架構

### 資料流

```
Sanity CMS (後台編輯)
    ↓
  API 請求
    ↓
Next.js 頁面 (前端顯示)
```

### 新增 Sanity Schema

| Schema | 用途 | 類型 |
|--------|------|------|
| `carCharter` | 包車服務頁面 | Singleton |
| `homestay` | 民宿頁面 | Singleton |

---

## 二、包車服務頁面設計

### 頁面結構

```
① Hero 區塊（標題、副標題、CTA）
    ↓
② 形象影片（1 支 YouTube）
    ↓
③ 服務特色（6 個）
    ↓
④ 價格表（2 種車型）
    ↓
⑤ 預訂流程（5 步驟）
    ↓
⑥ 車輛照片（4-6 張）
    ↓
⑦ 常見問題 FAQ（5 題）
    ↓
⑧ CTA 區塊
```

### Schema: `carCharter`

```typescript
// src/sanity/schemas/carCharter.ts

export default {
  name: 'carCharter',
  title: '包車服務頁面',
  type: 'document',
  fields: [
    // === Hero 區塊 ===
    {
      name: 'hero',
      title: 'Hero 區塊',
      type: 'object',
      fields: [
        { name: 'title', title: '標題', type: 'string' },
        { name: 'subtitle', title: '副標題', type: 'text', rows: 2 },
        { name: 'ctaText', title: 'CTA 按鈕文字', type: 'string' },
        { name: 'ctaLink', title: 'CTA 連結', type: 'url' },
      ],
    },

    // === 形象影片 ===
    {
      name: 'video',
      title: '形象影片',
      type: 'object',
      fields: [
        { name: 'youtubeId', title: 'YouTube 影片 ID', type: 'string', description: '例如: dQw4w9WgXcQ' },
        { name: 'title', title: '影片標題（SEO 用）', type: 'string' },
        { name: 'show', title: '顯示影片', type: 'boolean', initialValue: true },
      ],
    },

    // === 服務特色 ===
    {
      name: 'features',
      title: '服務特色',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'icon', title: 'Icon (emoji)', type: 'string' },
            { name: 'title', title: '標題', type: 'string' },
            { name: 'description', title: '說明', type: 'text', rows: 2 },
          ],
          preview: {
            select: { title: 'title', subtitle: 'icon' },
          },
        },
      ],
    },

    // === 價格表 ===
    {
      name: 'pricing',
      title: '價格表',
      type: 'object',
      fields: [
        { name: 'sectionTitle', title: '區塊標題', type: 'string' },
        {
          name: 'vehicleTypes',
          title: '車型價格',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                { name: 'name', title: '車型名稱', type: 'string' },
                { name: 'subtitle', title: '副標題', type: 'string' },
                { name: 'icon', title: 'Icon (emoji)', type: 'string' },
                { name: 'maxPassengers', title: '最多乘客數', type: 'number' },
                {
                  name: 'routes',
                  title: '路線價格',
                  type: 'array',
                  of: [
                    {
                      type: 'object',
                      fields: [
                        { name: 'destination', title: '目的地', type: 'string' },
                        { name: 'price', title: '價格', type: 'string' },
                      ],
                    },
                  ],
                },
                {
                  name: 'airportTransfer',
                  title: '接送機',
                  type: 'object',
                  fields: [
                    { name: 'label', title: '標籤', type: 'string' },
                    { name: 'price', title: '價格', type: 'string' },
                  ],
                },
              ],
              preview: {
                select: { title: 'name', subtitle: 'subtitle' },
              },
            },
          ],
        },
        {
          name: 'footnotes',
          title: '備註',
          type: 'array',
          of: [{ type: 'string' }],
        },
      ],
    },

    // === 預訂流程 ===
    {
      name: 'process',
      title: '預訂流程',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'step', title: '步驟編號', type: 'number' },
            { name: 'title', title: '標題', type: 'string' },
            { name: 'description', title: '說明', type: 'text', rows: 2 },
          ],
          preview: {
            select: { title: 'title', subtitle: 'step' },
            prepare({ title, subtitle }) {
              return { title: `${subtitle}. ${title}` }
            },
          },
        },
      ],
    },

    // === 車輛照片 ===
    {
      name: 'gallery',
      title: '車輛照片',
      type: 'array',
      of: [
        {
          type: 'image',
          options: { hotspot: true },
          fields: [
            { name: 'alt', title: 'Alt 文字', type: 'string' },
            { name: 'caption', title: '圖片說明', type: 'string' },
          ],
        },
      ],
    },

    // === FAQ ===
    {
      name: 'faq',
      title: '常見問題',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'question', title: '問題', type: 'string' },
            { name: 'answer', title: '答案', type: 'text', rows: 3 },
          ],
          preview: {
            select: { title: 'question' },
          },
        },
      ],
    },

    // === SEO ===
    {
      name: 'seo',
      title: 'SEO 設定',
      type: 'object',
      fields: [
        { name: 'metaTitle', title: 'Meta Title', type: 'string' },
        { name: 'metaDescription', title: 'Meta Description', type: 'text', rows: 2 },
      ],
    },
  ],

  preview: {
    prepare() {
      return { title: '包車服務頁面' }
    },
  },
}
```

### 價格表呈現（前端）

```
┌─────────────────────┐  ┌─────────────────────┐
│  🚗 經濟型小車       │  │  🚐 大空間 VIP      │
│  適合 1-3 人        │  │  適合 3-9 人/親子   │
├─────────────────────┤  ├─────────────────────┤
│ 清邁市區   NT$2,500 │  │ 清邁市區   NT$3,200 │
│ 清邁郊區   NT$2,800 │  │ 清邁郊區   NT$3,800 │
│ 南邦/南奔  NT$3,000 │  │ 南邦/南奔  NT$4,000 │
│ 茵他儂一日 NT$3,000 │  │ 茵他儂一日 NT$4,000 │
│ 清萊一日   NT$3,500 │  │ 清萊一日   NT$4,500 │
│ 金三角一日 NT$4,000 │  │ 金三角一日 NT$5,500 │
├─────────────────────┤  ├─────────────────────┤
│ ✈ 接送機   NT$400  │  │ ✈ 接送機   NT$600  │
└─────────────────────┘  └─────────────────────┘

* 車型依現場為主
* 價格可能會依景點距離與淡旺季略為變動
```

---

## 三、民宿頁面設計

### 頁面結構

```
① Hero 區塊（名稱、標題、副標題、CTA）
    ↓
② 形象影片（1 支 YouTube）
    ↓
③ 民宿特色（4 個）
    ↓
④ 房型價格（6 張設計圖卡）
    ↓
⑤ 環境照片（6-8 張網格）
    ↓
⑥ 位置資訊
    ↓
⑦ 常見問題 FAQ（3-5 題）
    ↓
⑧ CTA 區塊
```

### Schema: `homestay`

```typescript
// src/sanity/schemas/homestay.ts

export default {
  name: 'homestay',
  title: '民宿頁面',
  type: 'document',
  fields: [
    // === Hero 區塊 ===
    {
      name: 'hero',
      title: 'Hero 區塊',
      type: 'object',
      fields: [
        { name: 'name', title: '民宿英文名', type: 'string' },
        { name: 'title', title: '標題', type: 'string' },
        { name: 'subtitle', title: '副標題', type: 'text', rows: 2 },
        { name: 'ctaText', title: 'CTA 按鈕文字', type: 'string' },
        { name: 'ctaLink', title: 'CTA 連結', type: 'url' },
        {
          name: 'mainImage',
          title: '主視覺圖片',
          type: 'image',
          options: { hotspot: true },
          fields: [
            { name: 'alt', title: 'Alt 文字', type: 'string' },
          ],
        },
      ],
    },

    // === 形象影片 ===
    {
      name: 'video',
      title: '形象影片',
      type: 'object',
      fields: [
        { name: 'youtubeId', title: 'YouTube 影片 ID', type: 'string', description: '例如: dQw4w9WgXcQ' },
        { name: 'title', title: '影片標題（SEO 用）', type: 'string' },
        { name: 'show', title: '顯示影片', type: 'boolean', initialValue: true },
      ],
    },

    // === 民宿特色 ===
    {
      name: 'features',
      title: '民宿特色',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'icon', title: 'Icon (emoji)', type: 'string' },
            { name: 'title', title: '標題', type: 'string' },
            { name: 'description', title: '說明', type: 'text', rows: 2 },
          ],
          preview: {
            select: { title: 'title', subtitle: 'icon' },
          },
        },
      ],
    },

    // === 房型圖卡 ===
    {
      name: 'roomCards',
      title: '房型價格圖卡',
      description: '上傳你設計好的房型圖卡（含照片+價格）',
      type: 'array',
      of: [
        {
          type: 'image',
          options: { hotspot: true },
          fields: [
            { name: 'alt', title: 'Alt 文字（SEO 用）', type: 'string', description: '例如: 雙人房 NT$800/晚' },
          ],
        },
      ],
    },

    // === 環境照片 ===
    {
      name: 'gallery',
      title: '環境照片',
      description: '建議 6-8 張：外觀、庭院、公共空間、周邊環境等',
      type: 'array',
      of: [
        {
          type: 'image',
          options: { hotspot: true },
          fields: [
            { name: 'alt', title: 'Alt 文字', type: 'string' },
            { name: 'caption', title: '圖片說明（可選）', type: 'string' },
          ],
        },
      ],
    },

    // === 位置資訊 ===
    {
      name: 'location',
      title: '位置資訊',
      type: 'object',
      fields: [
        { name: 'description', title: '位置說明', type: 'text', rows: 3 },
        { name: 'fromChiangMai', title: '從清邁出發', type: 'string', description: '例如: 車程約 2.5 小時' },
        { name: 'googleMapUrl', title: 'Google Map 連結', type: 'url' },
      ],
    },

    // === FAQ ===
    {
      name: 'faq',
      title: '常見問題',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'question', title: '問題', type: 'string' },
            { name: 'answer', title: '答案', type: 'text', rows: 3 },
          ],
          preview: {
            select: { title: 'question' },
          },
        },
      ],
    },

    // === SEO ===
    {
      name: 'seo',
      title: 'SEO 設定',
      type: 'object',
      fields: [
        { name: 'metaTitle', title: 'Meta Title', type: 'string' },
        { name: 'metaDescription', title: 'Meta Description', type: 'text', rows: 2 },
      ],
    },
  ],

  preview: {
    prepare() {
      return { title: '民宿頁面' }
    },
  },
}
```

---

## 四、前端實作

### 需要建立的元件

| 元件 | 用途 | 共用 |
|------|------|------|
| `YouTubeEmbed` | 嵌入 YouTube 影片 | ✅ |
| `FeatureGrid` | 服務/民宿特色網格 | ✅ |
| `PricingTable` | 包車價格表（雙欄） | 包車專用 |
| `ProcessSteps` | 預訂流程步驟 | 包車專用 |
| `ImageGallery` | 照片網格 | ✅ |
| `RoomCards` | 房型圖卡網格 | 民宿專用 |
| `FAQSection` | FAQ 手風琴 | ✅ |
| `LocationInfo` | 位置資訊區塊 | 民宿專用 |

### 資料取得

```typescript
// 包車頁面
const carCharterQuery = `*[_type == "carCharter"][0]`

// 民宿頁面
const homestayQuery = `*[_type == "homestay"][0]`
```

---

## 五、Sanity Studio 設定

### 新增到 Schema Index

```typescript
// src/sanity/schemas/index.ts
import carCharter from './carCharter'
import homestay from './homestay'

export const schemaTypes = [
  // 現有的...
  post,
  tour,
  // 新增
  carCharter,
  homestay,
]
```

### Singleton 處理

在 Sanity Studio 結構中設定，讓這兩個文件類型只顯示單一編輯入口，不會建立多筆。

---

## 六、Sanity 後台管理項目總覽

### 包車服務

| 項目 | 數量 | 操作 |
|------|------|------|
| Hero 文字 | - | 填寫 |
| 影片 | 1 支 | 貼 YouTube ID |
| 服務特色 | 6 個 | 填文字 + emoji |
| 價格表 | 2 種車型 | 填車型 + 路線價格 |
| 備註 | 2 條 | 填文字 |
| 預訂流程 | 5 步驟 | 填步驟說明 |
| 車輛照片 | 4-6 張 | 上傳圖片 |
| FAQ | 5 題 | 填問答 |
| SEO | - | 填 meta |

### 民宿

| 項目 | 數量 | 操作 |
|------|------|------|
| Hero 文字 | - | 填寫 |
| 主視覺圖 | 1 張 | 上傳圖片 |
| 影片 | 1 支 | 貼 YouTube ID |
| 民宿特色 | 4 個 | 填文字 + emoji |
| 房型圖卡 | 6 張 | 上傳設計好的圖 |
| 環境照片 | 6-8 張 | 上傳圖片 |
| 位置資訊 | - | 填文字 + 連結 |
| FAQ | 3-5 題 | 填問答 |
| SEO | - | 填 meta |

---

## 七、實作順序

### Phase 1: Schema 建立
1. 建立 `carCharter.ts` schema
2. 建立 `homestay.ts` schema
3. 註冊到 schema index
4. 設定 Singleton 結構

### Phase 2: 前端元件
1. 建立共用元件（YouTubeEmbed, FeatureGrid, ImageGallery, FAQSection）
2. 建立包車專用元件（PricingTable, ProcessSteps）
3. 建立民宿專用元件（RoomCards, LocationInfo）

### Phase 3: 頁面整合
1. 修改 `/services/car-charter/page.tsx` 改為從 Sanity 取資料
2. 修改 `/homestay/page.tsx` 改為從 Sanity 取資料
3. 保留 Schema markup（FAQ Schema, Service Schema）

### Phase 4: 內容填入
1. 在 Sanity Studio 建立包車服務內容
2. 在 Sanity Studio 建立民宿內容
3. 上傳所有圖片和影片

---

## 八、注意事項

1. **SEO Schema 保留** - FAQ Schema 和 Service Schema 要保留，從 CMS 資料動態產生
2. **圖片優化** - 使用 Sanity 的圖片 CDN 和 Next.js Image 元件
3. **影片不自動播放** - YouTube 嵌入需點擊才播放，避免影響載入速度
4. **響應式設計** - 價格表在手機上要能正常顯示（可能改為上下排列）

---

*文件建立日期: 2026-01-14*
*Co-Authored-By: Claude Opus 4.5*
