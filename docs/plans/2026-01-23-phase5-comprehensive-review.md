# Phase 5: 全面審視與優化

**日期**: 2026-01-23
**狀態**: 已完成

## 概述

從四個角度全面審視網站，並執行所有優化建議：
- SA 架構師
- PM 產品經理
- 品牌戰略顧問
- 白帽資安測試

---

## SA 架構師優化

### 1. 集中管理導航連結
**檔案**: `src/lib/navigation.ts` (新建)

- 提取 Header/Footer 共用的導航連結
- 集中管理社群媒體連結
- 統一 LINE_URL 常數

### 2. TypeScript 類型定義
**檔案**: `src/lib/types/index.ts` (新建)

- SanityImage 類型
- SanityReference 類型
- 消除 37 個 `any` 類型警告

### 3. 共用常數提取
**檔案**: `src/lib/constants.ts` (新建)

- CATEGORY_NAMES 分類對照
- getCategoryName() 函數
- BRAND 品牌資訊
- REVALIDATE 快取設定

### 4. ISR 快取策略
**變更檔案**: 所有頁面

```typescript
// 之前
export const revalidate = 0

// 之後
export const revalidate = 60
```

### 5. Sanity Schema 清理
**移除未使用欄位**:
- `landingPage.ts`: seoTitle, seoDescription
- `carCharter.ts`: videoYoutubeId, seoTitle, seoDescription
- `homestay.ts`: videoYoutubeId, seoTitle, seoDescription

---

## PM 產品優化

### 1. FloatingLineButton 位置修正
**檔案**: `src/components/ui/FloatingLineButton.tsx`

```typescript
// 之前: bottom-6 (與 Safari 工具列重疊)
// 之後: bottom-20 (避開底部導航)
```

### 2. TrustNumbers 觸控優化
**檔案**: `src/components/sections/TrustNumbers.tsx`

```typescript
// py-2 → py-3 (確保 44px+ 觸控目標)
```

### 3. 首頁客戶見證
**檔案**: `src/components/sections/Testimonials.tsx` (新建)

- 3 則真實感回饋
- 桌面版 Grid 展示
- 手機版 Carousel 切換
- 連結至 Facebook 評價

### 4. 包車頁 CTA 差異化
**檔案**: `src/app/services/car-charter/page.tsx`

- 標題: "每個家庭的清邁之旅都不一樣"
- 副標: "告訴我們孩子年齡、興趣、體力，我們根據 114+ 組家庭的經驗幫你規劃"
- 按鈕: "LINE 分享你的行程需求"

### 5. 民宿頁 CTA 差異化
**檔案**: `src/app/homestay/page.tsx`

- 標題: "不只是住宿，是在地家庭的款待"
- 副標: "12 年來接待過上千組旅客"
- 按鈕: "LINE 詢問房況與接送"

---

## 品牌顧問優化

### 1. Hero 強調 Eric & Min
**檔案**: `src/components/sections/Hero.tsx`

```typescript
const defaults = {
  title: '清邁親子自由行，交給 Eric & Min',
  subtitle: '台灣爸爸 × 在地 30 年泰國媽媽，住在清邁的真實家庭',
  description: '司機導遊分開服務，不趕路、不跟團，專為爸媽設計的包車旅程',
}
```

### 2. 司機導遊分工強調
**檔案**: `src/app/services/car-charter/page.tsx`

```typescript
heroSubtitle: '司機 + 導遊分開服務，不是一人包辦。\n司機專心開車更安全，導遊專心照顧孩子更貼心。'
```

### 3. 民宿社會證明
**檔案**: `src/app/homestay/page.tsx`

新增社會證明區塊：
- 12 年在地經營
- 1000+ 外國與泰國旅客
- 134 則 Google 評論 (含連結)
- 季節限定活動：賞櫻團、賞鳥團

---

## 白帽資安測試

### 已修復

#### 1. 安全標頭 (HIGH → FIXED)
**檔案**: `next.config.js`

```javascript
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: '...' },
]
```

#### 2. GROQ 注入防護 (MEDIUM → FIXED)
**檔案**: `src/app/blog/page.tsx`

```typescript
// 之前: 字串插值 (有注入風險)
const categoryFilter = ` && category == "${category}"`

// 之後: 參數化查詢 + 白名單驗證
const isValidCategory = VALID_CATEGORIES.includes(category)
const query = `*[_type == "post" && category == $category]`
client.fetch(query, { category })
```

### 待處理 (低優先)

| 項目 | 嚴重度 | 建議 |
|------|--------|------|
| API tokens 在 .env.local | CRITICAL | 輪換 tokens、移出雲端同步資料夾 |
| 依賴漏洞 (15個) | HIGH/MODERATE | 等待 Sanity 官方更新 |
| Itinerary API 無驗證 | HIGH | 加入 API key 驗證 |
| Dashboard 標頭驗證弱 | HIGH | 改用 JWT/Session |

---

## 檔案變更清單

### 新建檔案
- `src/lib/navigation.ts`
- `src/lib/constants.ts`
- `src/lib/types/index.ts`
- `src/components/icons/SocialIcons.tsx`
- `src/components/sections/Testimonials.tsx`

### 修改檔案
- `next.config.js` - 安全標頭
- `src/components/Header.tsx` - 使用共用導航
- `src/components/Footer.tsx` - 使用共用導航
- `src/components/ui/FloatingLineButton.tsx` - 位置修正
- `src/components/sections/Hero.tsx` - 品牌文案
- `src/components/sections/TrustNumbers.tsx` - 觸控優化
- `src/app/page.tsx` - 加入 Testimonials
- `src/app/blog/page.tsx` - GROQ 注入防護
- `src/app/homestay/page.tsx` - 社會證明 + CTA
- `src/app/services/car-charter/page.tsx` - CTA 差異化
- `src/sanity/schemas/landingPage.ts` - 移除未用欄位
- `src/sanity/schemas/carCharter.ts` - 移除未用欄位
- `src/sanity/schemas/homestay.ts` - 移除未用欄位

---

## 驗證

- [x] `npm run build` 成功
- [x] 無 TypeScript 錯誤
- [x] 54 個單元測試通過
- [x] `npm audit fix` 已執行
