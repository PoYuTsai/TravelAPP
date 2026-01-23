# Phase 4 優化設計（最終版）

> 日期：2026-01-23
> 狀態：✅ 設計確認

---

## 品牌定位

```
清邁親子自由行
在地家庭經營，專為爸媽設計的旅程
```

**定位心法：**
1. 由外而內思考 — 消費者認知是事實
2. 有效差異化 — 給消費者利益點
3. 信任狀支持 — TrustNumbers + 過往案例
4. 傳播策略 — 公關先行，廣告隨後

---

## 1. Landing Page 架構

### 區塊結構（5 區塊）

```
1. Hero
   ├── 主標：清邁親子自由行，交給在地家庭
   ├── 副標：專為爸媽設計的包車旅程
   └── [LINE 聊聊]

2. TrustNumbers（三項皆可點擊）
   ├── 114+ 家庭 → /tours（行程案例）
   ├── ⭐ 5.0 → Google Maps 評論（外部連結）
   └── 在地家庭 → /homestay（芳縣民宿）

3. WhoWeAre
   ├── [Eric & Min 家庭照]
   ├── 台灣爸爸 + 泰國媽媽
   ├── 住在清邁的真實家庭，用「家人」的心情帶你們玩
   └── [閱讀我們的故事 →] → /blog/eric-story-taiwan-to-chiang-mai

4. ToursPreview
   ├── 標題：行程案例
   ├── 副標：每一組家庭的專屬清邁回憶
   ├── [招牌套餐卡片 1-2 個]
   └── [查看更多行程 →] → /tours

5. CTA
   ├── 每個家庭都不一樣
   ├── 聊聊你們的想法，我們幫你規劃
   └── [LINE 聊聊]

+ Sticky Mobile CTA（僅手機，固定底部）
   └── [💬 LINE 聊聊]
```

### 移除的區塊

| 區塊 | 原因 |
|------|------|
| Services | Hero 已說明，詳細在 /services |
| HomestaySection | TrustNumbers「在地家庭」連結取代 |
| FeaturedArticles | Blog 在 Nav，SEO 自然流量 |
| WhyUs | 整合進 WhoWeAre |

---

## 2. TrustNumbers 互動設計

### 連結配置

| 項目 | 連結 | Hover 效果 |
|------|------|-----------|
| 114+ 家庭 → | `/tours` | 主色調邊框 + 陰影 |
| ⭐ 5.0 ↗ | Google Maps | 金黃色邊框 + 陰影 |
| 在地家庭 → | `/homestay` | 主色調邊框 + 陰影 |

### 視覺設計

```tsx
// 可點擊項目樣式
className="
  group flex items-center gap-1
  px-4 py-2 rounded-full
  bg-white/80 border border-gray-200
  hover:border-primary hover:bg-primary/5 hover:shadow-md
  transition-all duration-200 cursor-pointer
"

// 箭頭動畫
<svg className="w-4 h-4 text-gray-400
  group-hover:text-primary
  group-hover:translate-x-0.5
  transition-transform"
>
```

### 動畫效果

- 進場：fadeInUp（滑入視野時）
- 數字：計數動畫（0 → 114 跳動）
- Hover：邊框變色 + 微陰影

---

## 3. /tours 頁面架構

### 區塊結構

```
1. Hero + TrustNumbers（整合一行）
   ├── 主標：清邁親子自由行，交給在地家庭
   ├── 副標：專為爸媽設計的包車旅程
   └── [114+ 家庭 →] [⭐ 5.0 ↗] [在地家庭 →]

2. 招牌套餐（2 個，大卡片）
   ├── 區塊標題：給第一次來清邁的你
   ├── 區塊副標：我們設計好了，你只要帶孩子來
   ├── 6天5夜 親子經典 → /tours/family-classic-6d
   └── 7天6夜 芳縣深度 → /tours/fang-deep-7d

3. 一日遊精選（6 個，小卡片）
   ├── 區塊標題：想自己排行程？這些一日遊隨你搭
   ├── 大象保護營 → /tours/elephant-day
   ├── 夜間動物園 → /tours/night-safari
   ├── 古城文化遊 → /tours/old-city
   ├── 南邦一日遊 → /tours/lampang
   ├── 清萊一日遊 → /tours/chiang-rai
   └── 茵他儂一日遊 → /tours/doi-inthanon

4. 最近出發的家庭（精簡案例）
   ├── 預設 6-10 個
   ├── [載入更多]
   └── 保留 Notion 排序

5. CTA
   ├── 每個家庭都不一樣
   ├── 聊聊你們的想法，我們幫你規劃
   └── [LINE 聊聊]

+ Sticky Mobile CTA
```

### 卡片設計差異

| 類型 | 佈局 | 圖片 | 點擊行為 |
|------|------|------|---------|
| 招牌套餐 | 全寬大卡片 | Canva 封面圖 | → 詳細頁 |
| 一日遊 | 2欄小卡片 | Canva 設計圖 | → 詳細頁 |
| 過往案例 | 多欄小卡片 | 無圖 | 不可點擊 |

### 一日遊卡片結構

```
┌──────────────────┐
│  [Canva 設計圖]   │
│                  │
│  📍 清邁         │
│  大象保護營       │
│  🐘 餵象 💦 瀑布  │
│                  │
│      NT$ 2,800起 │
└──────────────────┘
```

---

## 4. 詳細頁設計

### 招牌套餐詳細頁（多日）

```
┌─────────────────────────────────────────────────────────┐
│  [Canva 封面大圖]                                       │
│                                                         │
│  親子經典 6天5夜                                        │
│  適合第一次帶孩子來清邁的家庭                            │
│                                                         │
│  #大象保護營 #夜間動物園 #古城探索                       │
├─────────────────────────────────────────────────────────┤
│  這趟旅程適合你，如果...                                │
│  ✓ 第一次帶小孩來清邁                                  │
│  ✓ 希望行程輕鬆，不要太趕                              │
│  ✓ 需要中文導遊                                        │
├─────────────────────────────────────────────────────────┤
│  行程概覽                                               │
│  Day 1 ✈️ 抵達清邁・輕鬆適應                           │
│  Day 2 🐘 大象保護營・親子體驗                          │
│  Day 3 🏛️ 古城文化・寺廟巡禮                           │
│  Day 4 🦁 夜間動物園                                   │
│  Day 5 ☕ 親子咖啡廳・自由活動                          │
│  Day 6 ✈️ 返程                                         │
├─────────────────────────────────────────────────────────┤
│  費用包含 / 不包含                                      │
├─────────────────────────────────────────────────────────┤
│  NT$ 16,000 ~ 20,000 起                                │
│  （依人數、車型、導遊天數調整）                         │
├─────────────────────────────────────────────────────────┤
│  這是範例行程，每個家庭的需求都不同                      │
│  聊聊你們的想法，我們幫你量身打造                        │
│  [LINE 聊聊]                                            │
└─────────────────────────────────────────────────────────┘
```

### 一日遊詳細頁（精簡版）

```
┌─────────────────────────────────────────────────────────┐
│  [Canva 精美大圖]                                       │
│                                                         │
│  清邁一日遊｜大象保護營                                  │
│  🐘 餵大象 💦 黏黏瀑布 🍽️ 道地泰北餐                    │
├─────────────────────────────────────────────────────────┤
│  行程流程                                               │
│  09:00  飯店接送                                        │
│  10:00  抵達大象保護營                                  │
│  12:00  園區內午餐                                      │
│  14:00  黏黏瀑布戲水                                    │
│  17:00  返回清邁市區                                    │
├─────────────────────────────────────────────────────────┤
│  費用包含                                               │
│  ✓ 飯店來回接送 ✓ 中文導遊 ✓ 午餐 ✓ 門票              │
│                                                         │
│  費用不含                                               │
│  ✗ 小費 ✗ 個人消費                                     │
├─────────────────────────────────────────────────────────┤
│  NT$ 2,800 起 / 人                                      │
│  （2人成行，4人以上另有優惠）                           │
│                                                         │
│  [LINE 預約詢問]                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 行程案例優化

### 日期格式

- **多日**：`2026/2/20~2/26`
- **單日**：`2026/2/20`

### 卡片顯示

```
┌────────────┐
│  姵君      │
│  3 天      │
│  2/20~2/22 │
│  ✓ 已完成  │
└────────────┘
```

### 排序邏輯

- **移除**程式碼強制排序
- **保留** Notion API 回傳順序（手動排列）

---

## 6. Sticky Mobile CTA

### 規格

- 位置：固定螢幕底部
- 高度：56px + safe area
- 顯示條件：僅手機（< 768px）
- 背景：白色 + 上方陰影

### 實作

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
          LINE 聊聊
        </a>
      </div>
    </div>
  )
}
```

### 頁面 padding

```tsx
// layout.tsx
<main className="pb-20 md:pb-0">
  {children}
</main>
```

---

## 7. 修改檔案清單

### Landing Page
- `src/app/page.tsx` — 精簡為 5 區塊
- `src/components/sections/WhoWeAre.tsx` — 新增
- `src/components/sections/TrustNumbers.tsx` — 改為可點擊 + 動畫

### /tours 頁面
- `src/app/tours/page.tsx` — 重構區塊
- `src/app/tours/ToursPageClient.tsx` — 更新
- `src/components/tours/PackageCard.tsx` — 調整樣式
- `src/components/tours/DayTourCard.tsx` — 新增（一日遊卡片）
- `src/components/tours/CaseCard.tsx` — 更新日期格式

### 詳細頁
- `src/app/tours/[slug]/page.tsx` — 支援招牌套餐 + 一日遊

### 資料層
- `src/lib/notion/tours.ts` — 日期格式、移除排序
- `src/sanity/schemas/tourPackage.ts` — 已有，可複用

### 全站
- `src/components/StickyMobileCTA.tsx` — 新增
- `src/app/layout.tsx` — 引入 Sticky + padding

---

## 8. 不做的事

- 不新增主題標籤
- 不改動 Sanity schema（tourPackage 可複用）
- 不改動桌面版 Header/Footer
- 不加購物車/結帳功能

---

## 9. Sanity 內容規劃

### tourPackage 資料

| 類型 | 數量 | slug 範例 |
|------|------|----------|
| 招牌套餐 | 2 | family-classic-6d, fang-deep-7d |
| 一日遊 | 6 | elephant-day, night-safari, old-city, lampang, chiang-rai, doi-inthanon |

---

*設計確認：2026-01-23*
