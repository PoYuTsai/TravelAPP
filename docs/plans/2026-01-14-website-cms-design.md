# 網站 CMS 化設計文件

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將首頁、包車服務與民宿頁面改為 Sanity CMS 管理，讓內容可在後台編輯

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
| `landingPage` | 首頁 | Singleton |
| `carCharter` | 包車服務頁面 | Singleton |
| `homestay` | 民宿頁面 | Singleton |

---

## 二、首頁（Landing Page）設計

### 頁面結構

```
① Hero 區塊（主視覺圖、標題、副標題、CTA）
    ↓
② TrustNumbers（信任數據：服務家庭數、五星好評、年份）
    ↓
③ Services（服務卡片：包車 + 民宿）
    ↓
④ WhyUs（為什麼選擇我們：4 個理由）
    ↓
⑤ FeaturedArticles（精選文章，從 Blog 自動抓取）
    ↓
⑥ CTA（最終轉換區塊）
```

### Schema: `landingPage`

```typescript
// src/sanity/schemas/landingPage.ts

export default {
  name: 'landingPage',
  title: '首頁',
  type: 'document',
  fields: [
    // === Hero 區塊 ===
    {
      name: 'hero',
      title: 'Hero 區塊',
      type: 'object',
      fields: [
        {
          name: 'backgroundImage',
          title: '背景圖片',
          type: 'image',
          options: { hotspot: true },
          fields: [
            { name: 'alt', title: 'Alt 文字', type: 'string' },
          ],
        },
        { name: 'title', title: '主標題', type: 'string' },
        { name: 'subtitle', title: '副標題', type: 'string' },
        { name: 'description', title: '說明文字', type: 'text', rows: 2 },
        { name: 'primaryCtaText', title: '主要 CTA 文字', type: 'string' },
        { name: 'primaryCtaLink', title: '主要 CTA 連結', type: 'url' },
        { name: 'secondaryCtaText', title: '次要 CTA 文字', type: 'string' },
        { name: 'secondaryCtaLink', title: '次要 CTA 連結', type: 'string' },
      ],
    },

    // === 信任數據 ===
    {
      name: 'trustNumbers',
      title: '信任數據',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'value', title: '數值', type: 'string', description: '例如: 110+、⭐⭐⭐⭐⭐、2024' },
            { name: 'label', title: '標籤', type: 'string' },
            { name: 'link', title: '連結（可選）', type: 'url' },
          ],
          preview: {
            select: { title: 'label', subtitle: 'value' },
          },
        },
      ],
    },

    // === 服務卡片 ===
    {
      name: 'services',
      title: '服務區塊',
      type: 'object',
      fields: [
        { name: 'sectionTitle', title: '區塊標題', type: 'string' },
        { name: 'sectionSubtitle', title: '區塊副標題', type: 'string' },
        {
          name: 'items',
          title: '服務項目',
          type: 'array',
          of: [
            {
              type: 'object',
              fields: [
                {
                  name: 'image',
                  title: '服務圖片',
                  type: 'image',
                  options: { hotspot: true },
                  fields: [
                    { name: 'alt', title: 'Alt 文字', type: 'string' },
                  ],
                },
                { name: 'title', title: '服務名稱', type: 'string' },
                { name: 'subtitle', title: '副標題（可選）', type: 'string' },
                {
                  name: 'features',
                  title: '特色列表',
                  type: 'array',
                  of: [{ type: 'string' }],
                },
                { name: 'price', title: '價格顯示（可選）', type: 'string' },
                { name: 'ctaText', title: 'CTA 文字', type: 'string' },
                { name: 'ctaLink', title: 'CTA 連結', type: 'string' },
              ],
              preview: {
                select: { title: 'title', subtitle: 'subtitle' },
              },
            },
          ],
        },
      ],
    },

    // === 為什麼選擇我們 ===
    {
      name: 'whyUs',
      title: '為什麼選擇我們',
      type: 'object',
      fields: [
        { name: 'sectionTitle', title: '區塊標題', type: 'string' },
        { name: 'sectionSubtitle', title: '區塊副標題', type: 'string' },
        {
          name: 'reasons',
          title: '理由',
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
      ],
    },

    // === 精選文章設定 ===
    {
      name: 'featuredArticles',
      title: '精選文章區塊',
      type: 'object',
      fields: [
        { name: 'sectionTitle', title: '區塊標題', type: 'string' },
        { name: 'sectionSubtitle', title: '區塊副標題', type: 'string' },
        { name: 'showCount', title: '顯示篇數', type: 'number', initialValue: 3 },
        { name: 'ctaText', title: '查看更多文字', type: 'string' },
        { name: 'ctaLink', title: '查看更多連結', type: 'string' },
      ],
    },

    // === 最終 CTA ===
    {
      name: 'cta',
      title: '最終 CTA 區塊',
      type: 'object',
      fields: [
        { name: 'title', title: '標題', type: 'string' },
        { name: 'description', title: '說明', type: 'text', rows: 2 },
        { name: 'primaryCtaText', title: '主要 CTA 文字', type: 'string' },
        { name: 'primaryCtaLink', title: '主要 CTA 連結', type: 'url' },
        { name: 'secondaryCtaText', title: '次要 CTA 文字', type: 'string' },
        { name: 'secondaryCtaLink', title: '次要 CTA 連結', type: 'string' },
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
      return { title: '首頁設定' }
    },
  },
}
```

### 前端呈現

```
┌────────────────────────────────────────────────────┐
│                  HERO 區塊                          │
│  ┌──────────────────────────────────────────────┐  │
│  │          [背景圖片 - CMS 可換]                │  │
│  └──────────────────────────────────────────────┘  │
│              清邁親子自由行                         │
│        在地家庭經營，專為爸媽設計的旅程              │
│    [LINE 免費諮詢]   [瀏覽服務]                    │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│   110+ 服務家庭    ⭐⭐⭐⭐⭐ 五星好評    2024 創立  │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│              我們的服務                             │
│       包車 + 住宿，一站式親子旅遊體驗               │
│  ┌──────────────┐    ┌──────────────┐            │
│  │ [真實照片]    │    │ [真實照片]    │            │
│  │ 親子包車服務   │    │ 芳縣特色民宿   │            │
│  │ ✓ 專屬司機    │    │ ✓ 遠離觀光區   │            │
│  │ ✓ 兒童座椅    │    │ ✓ 在地生活     │            │
│  │ NT$3,200起   │    │              │            │
│  │ [了解包車]    │    │ [了解民宿]    │            │
│  └──────────────┘    └──────────────┘            │
└────────────────────────────────────────────────────┘
```

---

## 三、包車服務頁面設計

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

## 四、民宿頁面設計

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

## 五、前端實作

### 需要建立的元件

| 元件 | 用途 | 共用 |
|------|------|------|
| `YouTubeEmbed` | 嵌入 YouTube 影片 | ✅ |
| `FeatureGrid` | 服務/民宿特色網格 | ✅ |
| `ServiceCard` | 首頁服務卡片（含圖片） | 首頁專用 |
| `TrustNumbersBar` | 信任數據列 | 首頁專用 |
| `PricingTable` | 包車價格表（雙欄） | 包車專用 |
| `ProcessSteps` | 預訂流程步驟 | 包車專用 |
| `ImageGallery` | 照片網格 | ✅ |
| `RoomCards` | 房型圖卡網格 | 民宿專用 |
| `FAQSection` | FAQ 手風琴 | ✅ |
| `LocationInfo` | 位置資訊區塊 | 民宿專用 |

### 資料取得

```typescript
// 首頁
const landingPageQuery = `*[_type == "landingPage"][0]`

// 包車頁面
const carCharterQuery = `*[_type == "carCharter"][0]`

// 民宿頁面
const homestayQuery = `*[_type == "homestay"][0]`
```

---

## 六、Sanity Studio 設定

### 新增到 Schema Index

```typescript
// src/sanity/schemas/index.ts
import landingPage from './landingPage'
import carCharter from './carCharter'
import homestay from './homestay'

export const schemaTypes = [
  // 現有的...
  post,
  tour,
  // 新增
  landingPage,
  carCharter,
  homestay,
]
```

### Singleton 處理

在 Sanity Studio 結構中設定，讓這三個文件類型只顯示單一編輯入口，不會建立多筆。

---

## 七、Sanity 後台管理項目總覽

### 首頁

| 項目 | 數量 | 操作 |
|------|------|------|
| Hero 背景圖 | 1 張 | 上傳圖片 |
| Hero 文字 | - | 填寫標題、副標題、CTA |
| 信任數據 | 3 個 | 填數值 + 標籤 + 連結 |
| 服務卡片 | 2 個 | 上傳圖片 + 填文字 |
| 選擇理由 | 4 個 | 填 emoji + 文字 |
| 精選文章設定 | - | 填標題 + 顯示篇數 |
| CTA 區塊 | - | 填文字 + 連結 |
| SEO | - | 填 meta |

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

## 八、實作順序（3 大 Tasks）

### Task 1: Schema 建立與 Sanity Studio 設定

**Step 1: 建立 Landing Page Schema**
- Create: `src/sanity/schemas/landingPage.ts`
- 參照上方 Schema 定義

**Step 2: 建立 Car Charter Schema**
- Create: `src/sanity/schemas/carCharter.ts`
- 參照上方 Schema 定義

**Step 3: 建立 Homestay Schema**
- Create: `src/sanity/schemas/homestay.ts`
- 參照上方 Schema 定義

**Step 4: 註冊 Schema**
- Modify: `src/sanity/schemas/index.ts`
- 加入 landingPage, carCharter, homestay

**Step 5: 設定 Singleton 結構**
- Modify: `src/sanity/structure.ts` (如果有) 或 `sanity.config.ts`
- 讓三個頁面只能編輯，不能新增多筆

**Step 6: 測試 Sanity Studio**
- Run: `npm run dev`
- 確認 Studio 可正常顯示三個頁面編輯入口

---

### Task 2: 前端元件建立

**Step 1: 建立共用元件**
- Create: `src/components/cms/YouTubeEmbed.tsx`
- Create: `src/components/cms/FeatureGrid.tsx`
- Create: `src/components/cms/ImageGallery.tsx`
- Create: `src/components/cms/FAQSection.tsx`

**Step 2: 建立首頁專用元件**
- Create: `src/components/cms/ServiceCard.tsx`
- Create: `src/components/cms/TrustNumbersBar.tsx`

**Step 3: 建立包車專用元件**
- Create: `src/components/cms/PricingTable.tsx`
- Create: `src/components/cms/ProcessSteps.tsx`

**Step 4: 建立民宿專用元件**
- Create: `src/components/cms/RoomCards.tsx`
- Create: `src/components/cms/LocationInfo.tsx`

---

### Task 3: 頁面整合與內容填入

**Step 1: 整合首頁**
- Modify: `src/app/page.tsx`
- Modify: `src/components/sections/Hero.tsx`
- Modify: `src/components/sections/TrustNumbers.tsx`
- Modify: `src/components/sections/Services.tsx`
- Modify: `src/components/sections/WhyUs.tsx`
- Modify: `src/components/sections/CTA.tsx`
- 改為從 Sanity 取資料

**Step 2: 整合包車服務頁**
- Modify: `src/app/services/car-charter/page.tsx`
- 改為從 Sanity 取資料
- 保留 FAQ Schema markup

**Step 3: 整合民宿頁**
- Modify: `src/app/homestay/page.tsx`
- 改為從 Sanity 取資料
- 保留 FAQ Schema markup

**Step 4: 內容填入**
- 在 Sanity Studio 建立首頁內容
- 在 Sanity Studio 建立包車服務內容
- 在 Sanity Studio 建立民宿內容
- 上傳所有圖片（服務照片、車輛照片、民宿照片）

---

## 九、注意事項

1. **SEO Schema 保留** - FAQ Schema 和 Service Schema 要保留，從 CMS 資料動態產生
2. **圖片優化** - 使用 Sanity 的圖片 CDN 和 Next.js Image 元件
3. **影片不自動播放** - YouTube 嵌入需點擊才播放，避免影響載入速度
4. **響應式設計** - 價格表在手機上要能正常顯示（可能改為上下排列）

---

*文件建立日期: 2026-01-14*
*Co-Authored-By: Claude Opus 4.5*
