# Phase 4 優化設計

> 日期：2026-01-23
> 狀態：✅ 設計確認

---

## 1. 行程案例優化

### 1.1 日期格式修正

**現況：** `2026/1`（只顯示年月）
**目標：** `2026/2/20~2/26`（完整日期範圍）

**單日行程顯示：** `2026/2/20`（不加 ~）

**卡片顯示順序：**
```
姓名
3 天
2026/2/20~2/26
```

### 1.2 排序邏輯修正

**現況：** 程式碼強制按日期排序，覆蓋 Notion 手動排列
**目標：** 移除排序邏輯，直接使用 Notion API 回傳順序

**修改位置：** `src/lib/notion/tours.ts:71-75`

```typescript
// 移除這段排序邏輯
.sort((a, b) => {
  const dateA = new Date(a.month.replace('/', '-') + '-01')
  const dateB = new Date(b.month.replace('/', '-') + '-01')
  return dateB.getTime() - dateA.getTime()
})
```

### 1.3 資料結構調整

**TourCase interface 更新：**
```typescript
export interface TourCase {
  id: string
  name: string
  days: number
  startDate: string  // 新增：2026-02-20
  endDate: string | null  // 新增：2026-02-26 或 null
  status: 'completed' | 'upcoming'
}
```

**CaseCard props 更新：**
```typescript
interface CaseCardProps {
  name: string
  days: number
  startDate: string
  endDate: string | null
  status: 'completed' | 'upcoming'
}
```

---

## 2. Landing Page 精簡設計

### 2.1 新區塊結構（5 區塊）

```
1. Hero
   └── 清邁親子包車・專屬你們的旅程
   └── [LINE 免費諮詢]

2. TrustNumbers
   └── 114+ 家庭 ｜ 5.0 評價 ｜ 在地 X 年

3. WhoWeAre（新區塊）
   └── 台灣爸爸 + 泰國媽媽
   └── 住在清邁的真實家庭
   └── [閱讀我們的故事 →]

4. ToursPreview
   └── 招牌套餐（1-2 個）
   └── [查看更多行程 →]

5. CTA
   └── 準備好了嗎？LINE 聊聊
```

### 2.2 移除的區塊

| 區塊 | 原因 |
|------|------|
| Services | Hero 已說明核心服務，詳細內容在 /services |
| HomestaySection | 有獨立頁面，Nav/Footer 連結即可 |
| FeaturedArticles | Blog 在 Nav，SEO 文章自己會被搜到 |
| WhyUs | 整合進 WhoWeAre |

### 2.3 WhoWeAre 新區塊設計

```tsx
// src/components/sections/WhoWeAre.tsx

<section className="py-12 md:py-16">
  <div className="max-w-3xl mx-auto px-4 text-center">
    {/* 圖片：Eric + Min 家庭照 */}
    <div className="w-24 h-24 mx-auto mb-6 rounded-full overflow-hidden">
      <Image src="..." alt="Eric & Min" />
    </div>

    {/* 標題 */}
    <h2 className="text-2xl font-bold mb-4">
      台灣爸爸 + 泰國媽媽
    </h2>

    {/* 簡介 */}
    <p className="text-gray-600 mb-6">
      我們是住在清邁的真實家庭，帶著自己的孩子探索這座城市。
      不是旅行社，是用「家人」的心情帶你們玩。
    </p>

    {/* 連結到完整故事 */}
    <Link href="/blog/eric-story-taiwan-to-chiang-mai">
      閱讀我們的故事 →
    </Link>
  </div>
</section>
```

**內容來源：** 可從 Sanity landingPage schema 新增欄位，或直接 hardcode

---

## 3. Sticky Mobile CTA

### 3.1 設計規格

```
┌─────────────────────────────────────┐
│                                     │
│         （頁面內容）                 │
│                                     │
├─────────────────────────────────────┤
│  💬 LINE 免費諮詢                    │  ← 固定底部
└─────────────────────────────────────┘
```

**規格：**
- 位置：固定螢幕底部
- 高度：56px（含 safe area padding）
- 背景：白色 + 上方陰影
- 按鈕：綠色 LINE 按鈕，全寬
- 顯示條件：僅手機（< 768px）
- 桌面版：不顯示（Header 已有 LINE 連結）

### 3.2 實作位置

```tsx
// src/components/StickyMobileCTA.tsx

'use client'

export default function StickyMobileCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t shadow-lg z-50 pb-safe">
      <div className="px-4 py-3">
        <a
          href="https://line.me/R/ti/p/@037nyuwk"
          className="flex items-center justify-center gap-2 w-full bg-[#06C755] text-white font-medium py-3 rounded-full"
        >
          <svg>...</svg>
          LINE 免費諮詢
        </a>
      </div>
    </div>
  )
}
```

**放置位置：** `src/app/layout.tsx`（全站生效）

### 3.3 頁面底部 padding

為了避免 sticky CTA 擋住內容，需要在 `<main>` 加上底部 padding：

```tsx
// layout.tsx
<main className="pb-20 md:pb-0">
  {children}
</main>
```

---

## 4. 修改檔案清單

### 行程案例修正
- `src/lib/notion/tours.ts` — 日期格式、移除排序
- `src/components/tours/CaseCard.tsx` — 顯示完整日期

### Landing Page 精簡
- `src/app/page.tsx` — 移除區塊、調整順序
- `src/components/sections/WhoWeAre.tsx` — 新增
- 移除 import：Services, HomestaySection, FeaturedArticles, WhyUs

### Sticky Mobile CTA
- `src/components/StickyMobileCTA.tsx` — 新增
- `src/app/layout.tsx` — 引入 + padding

---

## 5. 不做的事

- 不新增主題標籤（保持簡潔）
- 不改動 /tours 頁面結構（只改案例卡片）
- 不改動 Sanity schema（WhoWeAre 先 hardcode）
- 不改動桌面版佈局

---

*設計確認：2026-01-23*
