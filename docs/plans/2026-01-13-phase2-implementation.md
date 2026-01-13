# Phase 2 實施計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 提升 SEO 排名、轉換率，並將常更新內容搬進 Sanity 後台

**Architecture:**
- 前端保持 Next.js 14 結構
- 新增 Sanity Schema 管理動態內容（價格、FAQ、評價、行程範例）
- 部落格文章加入 SEO 技術元素（麵包屑、TOC、作者區塊）

**Tech Stack:** Next.js 14, Sanity CMS, Tailwind CSS, JSON-LD Schema

---

## Phase 2.1：SEO 基礎優化

### Task A1: 麵包屑導航

**Files:**
- Create: `src/components/ui/Breadcrumb.tsx`
- Modify: `src/app/blog/[slug]/page.tsx`

**需求：**
- 部落格文章頁顯示：首頁 > 部落格 > 文章標題
- 加入 BreadcrumbList Schema (JSON-LD)
- 可點擊跳轉

**驗收：**
- 文章頁頂部顯示麵包屑
- Google Rich Results Test 驗證 Schema

---

### Task A3: 作者區塊

**Files:**
- Create: `src/components/blog/AuthorBox.tsx`
- Modify: `src/app/blog/[slug]/page.tsx`

**需求：**
- 文章底部顯示作者資訊
- 包含：頭像、名字、簡介、社群連結
- E-E-A-T 信號：「住在清邁的台灣人 Eric」

**內容：**
```
┌─────────────────────────────────────────┐
│ 👤 [照片]                               │
│ 關於作者                                │
│ Eric｜清微旅行創辦人                     │
│ 住在清邁的台灣人，與泰國太太 Min 經營     │
│ 親子包車服務。用在地爸媽的角度，分享最     │
│ 真實的清邁旅遊資訊。                     │
│ [LINE 諮詢] [Instagram]                 │
└─────────────────────────────────────────┘
```

---

### Task A4: 最後更新日期

**Files:**
- Modify: `src/app/blog/[slug]/page.tsx`
- Modify: `src/sanity/schemas/post.ts`（已有 updatedAt 欄位）

**需求：**
- 文章頁顯示「發布日期」和「最後更新」
- 格式：2024 年 12 月 15 日
- 若 updatedAt 有值才顯示更新日期

---

### Task A6: Article Schema

**Files:**
- Modify: `src/app/blog/[slug]/page.tsx`

**需求：**
- 每篇文章加入 Article Schema (JSON-LD)
- 包含：headline, author, datePublished, dateModified, image, publisher

---

## Phase 2.2：Sanity 後台功能

### Task B1: 價格表 Schema

**Files:**
- Create: `src/sanity/schemas/pricing.ts`
- Modify: `src/sanity/schemas/index.ts`
- Modify: `src/app/services/car-charter/page.tsx`

**Schema 欄位：**
```typescript
{
  name: 'pricing',
  title: '價格表',
  fields: [
    { name: 'service', title: '服務項目', type: 'string' },
    { name: 'duration', title: '時數說明', type: 'string' },
    { name: 'priceMin', title: '最低價格', type: 'number' },
    { name: 'priceMax', title: '最高價格', type: 'number' },
    { name: 'currency', title: '幣別', type: 'string', initialValue: 'TWD' },
    { name: 'note', title: '備註', type: 'string' },
    { name: 'order', title: '排序', type: 'number' },
  ]
}
```

---

### Task B2: FAQ Schema

**Files:**
- Create: `src/sanity/schemas/faq.ts`
- Modify: `src/sanity/schemas/index.ts`
- Modify: `src/app/services/car-charter/page.tsx`

**Schema 欄位：**
```typescript
{
  name: 'faq',
  title: '常見問題',
  fields: [
    { name: 'question', title: '問題', type: 'string' },
    { name: 'answer', title: '回答', type: 'text' },
    { name: 'category', title: '分類', type: 'string', options: {
      list: ['car-charter', 'homestay', 'general']
    }},
    { name: 'order', title: '排序', type: 'number' },
  ]
}
```

---

### Task B3: 客戶評價 Schema

**Files:**
- Create: `src/sanity/schemas/testimonial.ts`
- Modify: `src/sanity/schemas/index.ts`

**Schema 欄位：**
```typescript
{
  name: 'testimonial',
  title: '客戶評價',
  fields: [
    { name: 'content', title: '評價內容', type: 'text' },
    { name: 'customerName', title: '客戶名稱', type: 'string' },
    { name: 'tripDate', title: '旅遊日期', type: 'string' },
    { name: 'tripType', title: '旅遊類型', type: 'string' },
    { name: 'rating', title: '評分', type: 'number', validation: 1-5 },
    { name: 'source', title: '來源', type: 'string', options: {
      list: ['google', 'line', 'facebook']
    }},
    { name: 'featured', title: '精選顯示', type: 'boolean' },
  ]
}
```

---

### Task B5: 行程範例 Schema

**Files:**
- Create: `src/sanity/schemas/sampleItinerary.ts`
- Modify: `src/sanity/schemas/index.ts`

**Schema 欄位：**
```typescript
{
  name: 'sampleItinerary',
  title: '行程範例',
  fields: [
    { name: 'title', title: '行程名稱', type: 'string' },
    { name: 'subtitle', title: '副標題', type: 'string' },
    { name: 'duration', title: '時數', type: 'string' },
    { name: 'highlights', title: '亮點', type: 'array', of: [{ type: 'string' }] },
    { name: 'stops', title: '停靠點', type: 'array', of: [{
      type: 'object',
      fields: [
        { name: 'time', type: 'string' },
        { name: 'place', type: 'string' },
        { name: 'description', type: 'string' },
      ]
    }]},
    { name: 'suitable', title: '適合對象', type: 'string' },
    { name: 'image', title: '封面圖', type: 'image' },
  ]
}
```

---

## Phase 2.3：包車服務頁強化

### Task C1: 客戶評價區塊

**Files:**
- Create: `src/components/sections/Testimonials.tsx`
- Modify: `src/app/services/car-charter/page.tsx`

**需求：**
- 從 Sanity 拉取 `featured: true` 的評價
- 顯示 2-3 則精選評價
- 底部連結到 Google 評論

**樣式：**
```
┌─────────────────────────────────────────┐
│  客戶怎麼說                              │
├─────────────────────────────────────────┤
│  ⭐⭐⭐⭐⭐                              │
│  「Eric 很用心規劃行程...」              │
│  — 王小明，2024/12 親子遊                │
├─────────────────────────────────────────┤
│  [查看更多 Google 評論 →]                │
└─────────────────────────────────────────┘
```

---

### Task C2: 行程範例區塊

**Files:**
- Create: `src/components/sections/SampleItineraries.tsx`
- Modify: `src/app/services/car-charter/page.tsx`

**需求：**
- 從 Sanity 拉取行程範例
- 卡片式顯示 2-3 個範例
- 點擊可展開詳細行程

---

### Task C3: 服務流程圖

**Files:**
- Create: `src/components/sections/ServiceProcess.tsx`
- Modify: `src/app/services/car-charter/page.tsx`

**內容：**
```
LINE 諮詢 → 討論行程 → 確認報價 → 付訂出發
   ①          ②          ③          ④
```

---

## Phase 2.4：進階 SEO

### Task A2: 文章目錄 (TOC)

**Files:**
- Create: `src/components/blog/TableOfContents.tsx`
- Modify: `src/app/blog/[slug]/page.tsx`

**需求：**
- 自動從文章 H2/H3 標題生成目錄
- 固定在側邊或文章頂部
- 點擊可跳轉到對應段落
- 手機版可收合

---

### Task A5: 相關文章

**Files:**
- Create: `src/components/blog/RelatedPosts.tsx`
- Modify: `src/app/blog/[slug]/page.tsx`

**需求：**
- 文章底部顯示「你可能也喜歡」
- 推薦同分類的 2-3 篇文章
- GROQ 查詢：同 category、排除當前文章

---

## Phase 2.5：圖片優化

### Task D1-D3: 真實照片

**需準備的照片：**

| 位置 | 需要的照片 | 建議尺寸 |
|------|-----------|---------|
| 首頁 Services | 包車服務照、民宿照 | 800x600 |
| 民宿頁 | 民宿外觀、房間、環境 4 張 | 800x800 |
| 包車頁 | 車輛、導遊、行程照 3-5 張 | 1200x800 |

**執行：**
- 照片放入 `/public/images/`
- 替換目前的 emoji placeholder
- 使用 Next.js Image 組件優化

---

## 執行順序建議

```
Week 1-2: Phase 2.1 (SEO 基礎)
  - A1 麵包屑
  - A3 作者區塊
  - A4 更新日期
  - A6 Article Schema

Week 3-4: Phase 2.2 (後台功能)
  - B1 價格表
  - B2 FAQ
  - B3 客戶評價
  - B5 行程範例

Week 5-6: Phase 2.3 (包車頁強化)
  - C1 評價區塊
  - C2 行程範例區塊
  - C3 服務流程

Week 7-8: Phase 2.4 + 2.5
  - A2 文章目錄
  - A5 相關文章
  - D1-D3 真實照片
```

---

## 內容策略提醒

**部落格內容：**
- 以圖文為主（80%）
- 重點文章可補 15-30 秒短影片（20%）
- 短期專注衝文章量，中期再補影片

**客戶評價：**
- 精選 2-3 則放頁面（Sanity 管理）
- 底部放 Google 評論連結
- 方案 D：精選 + 連結

---

## 驗收標準

- [ ] 麵包屑 + Schema 通過 Google Rich Results Test
- [ ] Article Schema 通過驗證
- [ ] Sanity 後台可編輯價格、FAQ、評價
- [ ] 包車頁有客戶評價、行程範例、流程圖
- [ ] 所有 placeholder 替換為真實照片
- [ ] Lighthouse SEO 分數 > 90
