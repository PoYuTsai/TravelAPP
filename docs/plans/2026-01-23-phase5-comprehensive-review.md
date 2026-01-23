# Phase 5: 全面審視與優化

**日期**: 2026-01-23
**狀態**: 已完成

## 概述

從五個角度全面審視網站，並執行所有優化建議：
- SA 架構師
- PM 產品經理
- 品牌戰略顧問
- 白帽資安測試
- 跨裝置相容性

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
**移除/隱藏未使用欄位**:
- `landingPage.ts`: seoTitle, seoDescription
- `carCharter.ts`: videoYoutubeId, seoTitle, seoDescription, videoShow
- `homestay.ts`: videoYoutubeId, seoTitle, seoDescription, videoShow

**加入隱藏棄用欄位** (避免 Unknown fields 警告):
```typescript
defineField({ name: 'videoShow', type: 'boolean', hidden: true }),
defineField({ name: 'videoYoutubeId', type: 'string', hidden: true }),
defineField({ name: 'seoTitle', type: 'string', hidden: true }),
defineField({ name: 'seoDescription', type: 'text', hidden: true }),
```

---

## PM 產品優化

### 1. FloatingLineButton 位置修正
**檔案**: `src/components/ui/FloatingLineButton.tsx`

```typescript
// 之前: bottom-6 (與 Safari 工具列重疊)
// 之後: bottom-20 (避開底部導航)
```

### 2. TrustNumbers 互動優化
**檔案**: `src/components/sections/TrustNumbers.tsx`

- py-2 → py-3 (確保 44px+ 觸控目標)
- 新增脈衝動畫 (首次載入閃爍 3 次)
- 新增「👆 點擊探索更多」提示 (手機版)
- 邊框改為主題色 (`border-primary/30`)
- hover 發光陰影效果
- 提升 hover 上移幅度 (`-translate-y-1`)

### 3. 首頁客戶見證
**檔案**: `src/components/sections/Testimonials.tsx`

- 改用 Embla Carousel 支援手機滑動
- 真實 FB 評論 (王薪驊、Vicky Lin、Lily Chen)
- 左右箭頭導航按鈕
- 「← 左右滑動查看更多 →」提示
- Facebook 來源圖示
- 桌面版 Grid / 手機版 Carousel

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

### 6. 一日遊景點輪播優化
**檔案**: `src/components/tours/StopsCarousel.tsx`

原問題：文字疊在圖片上，難以閱讀

修復方案：
- 圖片與文字分離 (不再疊加)
- 圖片在上方 (圓角)
- 文字在下方白色卡片區塊
- 左右箭頭位置調整至圖片中央

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

#### 2. CSP 允許 Cloudinary 影片
**檔案**: `next.config.js`

```javascript
"media-src 'self' https://cdn.sanity.io https://res.cloudinary.com",
"connect-src 'self' https://www.google-analytics.com https://*.sanity.io https://res.cloudinary.com",
```

#### 3. GROQ 注入防護 (MEDIUM → FIXED)
**檔案**: `src/app/blog/page.tsx`

```typescript
// 之前: 字串插值 (有注入風險)
const categoryFilter = ` && category == "${category}"`

// 之後: 參數化查詢 + 白名單驗證
const isValidCategory = VALID_CATEGORIES.includes(category)
const query = `*[_type == "post" && category == $category]`
client.fetch(query, { category })
```

#### 4. API 驗證與速率限制 (HIGH → FIXED)
**新增檔案**: `src/lib/api-auth.ts`

集中式 API 驗證模組：
- `validateApiKey()` - API Key 驗證
- `validateDashboardAccess()` - Dashboard 白名單驗證
- `checkRateLimit()` - 速率限制 (記憶體)
- `getClientIP()` - 客戶端 IP 取得

**更新 API 路由**:
- `/api/itinerary/[id]/text` - 30 req/min
- `/api/itinerary/[id]/pdf` - 10 req/min (資源密集)
- `/api/itinerary/[id]/excel` - 20 req/min
- `/api/dashboard` - 60 req/min

**環境變數** (`.env.example`):
```
INTERNAL_API_KEY=your-secure-api-key-here
DASHBOARD_ALLOWED_EMAILS=email1@example.com,email2@example.com
```

### 待處理 (低優先)

| 項目 | 嚴重度 | 建議 |
|------|--------|------|
| API tokens 在 .env.local | CRITICAL | 輪換 tokens、移出雲端同步資料夾 |
| 依賴漏洞 (15個) | HIGH/MODERATE | 等待 Sanity 官方更新 |

---

## 跨裝置相容性 (iOS Safari)

### 問題
民宿頁面影片在 iOS Safari 無法播放，Android 正常。

### 原因分析
1. 影片檔名含中文字元 → URL 編碼問題
2. 影片編碼非 H.264 → iOS Safari 不支援

### 解決方案

#### 1. 影片檔名使用純英文
```
❌ 芳縣景物房間隨拍_影片13_dhi0uo.mp4
✅ hotelvideo_0123_gui5rb.mp4
```

#### 2. Cloudinary H.264 轉檔
在 URL 加入 `vc_h264` 參數讓 Cloudinary 自動轉成 iOS 相容格式：

```typescript
// 之前
videoUrl: 'https://res.cloudinary.com/.../upload/v.../video.mp4'

// 之後
videoUrl: 'https://res.cloudinary.com/.../upload/vc_h264/v.../video.mp4'
                                              ^^^^^^^^
```

#### 3. VideoPlayer 簡化
**檔案**: `src/components/cms/VideoPlayer.tsx`

改用原生 HTML5 video controls，最大化瀏覽器相容性：
```tsx
<video
  src={videoUrl}
  controls
  playsInline
  preload="metadata"
>
  <source src={videoUrl} type="video/mp4" />
</video>
```

#### 4. 響應式影片比例
**檔案**: `src/components/cms/VideoPlayer.tsx`, `src/components/sections/WhoWeAre.tsx`

新增 `responsive` aspect 選項，自動切換直式/橫式：

```typescript
// 手機：直式 (9:16)，桌機：橫式 (16:9)
aspect="responsive"

// VideoPlayer
responsive: 'aspect-[9/16] md:aspect-video max-w-sm md:max-w-4xl'

// WhoWeAre
responsive: 'aspect-[9/16] md:aspect-video max-w-[280px] md:max-w-[500px]'
```

**套用頁面**:
- 首頁 WhoWeAre 區塊
- 包車服務頁面
- 民宿頁面

### 影片 URL 最終版本
- 包車: `https://res.cloudinary.com/dlgzrtl75/video/upload/vc_h264/v1769163410/790057116.088289_vz6u16.mp4`
- 民宿: `https://res.cloudinary.com/dlgzrtl75/video/upload/vc_h264/v1769170451/hotelvideo_0123_gui5rb.mp4`

---

## 檔案變更清單

### 新建檔案
- `src/lib/navigation.ts`
- `src/lib/constants.ts`
- `src/lib/types/index.ts`
- `src/lib/api-auth.ts` - API 驗證與速率限制
- `src/components/icons/SocialIcons.tsx`
- `src/components/sections/Testimonials.tsx`
- `src/components/cms/VideoPlayer.tsx`

### 修改檔案
- `.env.example` - 新增安全環境變數
- `next.config.js` - 安全標頭 + CSP
- `src/components/Header.tsx` - 使用共用導航
- `src/components/Footer.tsx` - 使用共用導航
- `src/components/ui/FloatingLineButton.tsx` - 位置修正
- `src/components/sections/Hero.tsx` - 品牌文案
- `src/components/sections/TrustNumbers.tsx` - 互動特效 + 永久脈衝動畫
- `src/components/sections/Testimonials.tsx` - Embla 滑動 + 真實 FB 評論
- `src/components/sections/WhoWeAre.tsx` - 響應式影片比例
- `src/components/tours/StopsCarousel.tsx` - 文字移至圖片下方
- `src/components/cms/VideoPlayer.tsx` - 響應式影片比例
- `src/app/page.tsx` - 加入 Testimonials
- `src/app/blog/page.tsx` - GROQ 注入防護
- `src/app/homestay/page.tsx` - 社會證明 + CTA + 影片
- `src/app/services/car-charter/page.tsx` - CTA 差異化 + 影片
- `src/app/api/dashboard/route.ts` - 速率限制 + 共用驗證
- `src/app/api/itinerary/[id]/text/route.ts` - API Key + 速率限制
- `src/app/api/itinerary/[id]/pdf/route.ts` - API Key + 速率限制
- `src/app/api/itinerary/[id]/excel/route.ts` - API Key + 速率限制
- `src/sanity/schemas/landingPage.ts` - 移除未用欄位
- `src/sanity/schemas/carCharter.ts` - 清理欄位 + 隱藏棄用
- `src/sanity/schemas/homestay.ts` - 清理欄位 + 隱藏棄用

---

## 驗證

- [x] `npm run build` 成功
- [x] 無 TypeScript 錯誤
- [x] 54 個單元測試通過
- [x] `npm audit fix` 已執行
- [x] iOS Safari 影片播放正常
- [x] Android 影片播放正常
- [x] Sanity Studio 無 Unknown fields 警告

---

## Phase 5.1: 十角度審視後優化 (2026-01-23)

基於 SA、PM、UI/UX、Backend、QA、Brand、SEO、Marketing、Security、TA 十角度全面審視後執行的優化。

### 1. CORS 設定 (Security)
**檔案**: `next.config.js`

```javascript
// API 路由 CORS 設定
{
  source: '/api/:path*',
  headers: [
    { key: 'Access-Control-Allow-Origin', value: allowedOrigins },
    { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-API-Key' },
    { key: 'Access-Control-Max-Age', value: '86400' },
  ],
}
```

### 2. 搜尋功能 + 分類頁面 (SEO)
**新建檔案**:
- `src/components/blog/SearchBox.tsx` - 搜尋元件
- `src/app/blog/category/[slug]/page.tsx` - SEO 友善分類頁

**修改檔案**:
- `src/app/blog/page.tsx` - 加入搜尋功能
- `src/components/blog/CategoryFilter.tsx` - 使用 SEO 友善 URL

功能：
- 文章標題、摘要全文搜尋
- 各分類獨立頁面 (`/blog/category/guide` 等)
- 搜尋結果計數顯示

### 3. 404 頁面優化 (UI/UX)
**檔案**: `src/app/not-found.tsx`

- 移除 emoji 圖示，改用 SVG 地圖圖示
- 加入 404 錯誤代碼
- 加入快速導航連結區塊
- 改善視覺層次

### 4. Loading 狀態 (QA)
**新建檔案**:
- `src/components/ui/LoadingSkeleton.tsx` - 通用骨架屏元件
- `src/app/blog/loading.tsx`
- `src/app/tours/loading.tsx`
- `src/app/homestay/loading.tsx`
- `src/app/services/car-charter/loading.tsx`

元件：
- `Skeleton` - 基礎脈衝動畫
- `CardSkeleton` - 卡片骨架
- `CardGridSkeleton` - 卡片網格
- `SectionTitleSkeleton` - 標題骨架
- `HeroSkeleton` - Hero 區塊骨架
- `PageLoadingSkeleton` - 完整頁面骨架

### 5. OpenAPI/Swagger 文件 (Backend)
**新建檔案**:
- `src/lib/openapi.ts` - OpenAPI 3.0 規格定義
- `src/app/api/openapi/route.ts` - JSON 規格端點
- `src/app/api-docs/page.tsx` - Swagger UI 文件頁面

文件內容：
- 行程匯出 API (text, pdf, excel)
- Dashboard API
- Tours API
- 安全認證說明
- 速率限制說明

### 6. 集中式 Logger (Backend)
**新建檔案**: `src/lib/logger.ts`

```typescript
// Logger 類別
class Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, error?: Error, context?: LogContext): void
}

// 預建 Logger
export const logger = new Logger('APP')
export const apiLogger = new Logger('API')
export const dbLogger = new Logger('DB')
export const authLogger = new Logger('AUTH')
export const sanityLogger = new Logger('SANITY')
```

**更新 API 路由使用 Logger**:
- `src/app/api/dashboard/route.ts`
- `src/app/api/itinerary/[id]/text/route.ts`
- `src/app/api/itinerary/[id]/pdf/route.ts`
- `src/app/api/itinerary/[id]/excel/route.ts`

### 7. SEO 內部連結優化 (SEO)
**新建檔案**: `src/components/blog/RelatedPosts.tsx`

功能：
- 同分類相關文章推薦 (最多 3 篇)
- 不足時補充其他分類文章

**修改檔案**:
- `src/app/blog/[slug]/page.tsx` - 加入相關文章、分類連結可點擊
- `src/components/Footer.tsx` - 加入部落格分類連結區塊 (4 欄 footer)

---

## 新增檔案清單 (Phase 5.1)

- `src/components/blog/SearchBox.tsx`
- `src/components/blog/RelatedPosts.tsx`
- `src/components/ui/LoadingSkeleton.tsx`
- `src/app/blog/category/[slug]/page.tsx`
- `src/app/blog/loading.tsx`
- `src/app/tours/loading.tsx`
- `src/app/homestay/loading.tsx`
- `src/app/services/car-charter/loading.tsx`
- `src/lib/openapi.ts`
- `src/lib/logger.ts`
- `src/app/api/openapi/route.ts`
- `src/app/api-docs/page.tsx`

---

## 未來建議

### Cloudinary 影片上傳注意事項
1. **檔名使用純英文** - 避免中文或特殊字元
2. **URL 加上 `vc_h264`** - 確保 iOS 相容
3. **格式建議** - MP4 + H.264 視訊 + AAC 音訊

### 待處理項目
- 將 .env.local 移出 OneDrive 同步資料夾
- 等待 Sanity 官方更新依賴套件漏洞修復

---

## Phase 5.1: UX 精緻化 (2026-01-24)

基於實際使用回饋的細節優化。

---

## Phase 5.2: 10 角色全面審查 (2026-01-24)

基於 10 個專業角度的全面審查與優化：SA 架構師、PM 產品經理、UI/UX 設計師、後端工程師、QA 測試、品牌顧問、SEO 顧問、行銷顧問、資安工程師、目標用戶。

### SA 架構師優化

1. **Sanity CDN 啟用**
   - `src/sanity/client.ts`: `useCdn: process.env.NODE_ENV === 'production'`
   - 生產環境自動啟用 CDN 快取

2. **Logger 整合**
   - 移除 `src/lib/logger/index.ts` 重複實作
   - 統一使用 `src/lib/logger.ts`
   - 新增 `pdfLogger` 專用 logger

### 後端優化

1. **API Key 生產環境強制**
   - `src/lib/api-auth.ts`: 生產環境無 API Key 回傳 500 錯誤
   - 開發環境僅警告但允許存取

2. **Email Whitelist 修復**
   - `.split(',').map(email => email.trim())` 處理空格

3. **輸入驗證強化**
   - `src/app/api/tours/cases/route.ts`: NaN 檢查、邊界值限制
   - `limit`: 1-100, `offset`: ≥0

### QA 測試修復

1. **鍵盤支援**
   - `src/components/cms/ImageGallery.tsx`: Esc 關閉 lightbox
   - `src/components/homestay/RoomCards.tsx`: Esc 關閉 lightbox
   - 背景滾動防止: `body.style.overflow = 'hidden'`

### SEO 優化

1. **Canonical URLs**
   - `src/app/blog/[slug]/page.tsx`: 文章頁 canonical
   - `src/app/tours/[slug]/page.tsx`: 行程頁 canonical

2. **Sitemap 完善**
   - `src/app/sitemap.ts`: 加入 tours、categories 頁面

3. **FAQ Schema**
   - `src/app/services/car-charter/page.tsx`: 結構化資料

4. **OG Image**
   - `src/app/tours/[slug]/page.tsx`: 行程頁社群圖片

### 行銷追蹤

1. **文章閱讀追蹤**
   - 新建 `src/components/blog/ArticleViewTracker.tsx`
   - GA4 事件: `article_view`

2. **表單提交追蹤**
   - `src/components/ContactForm.tsx`: `trackFormSubmit('contact_inquiry')`

### 資安強化

1. **CORS 修復**
   - `src/app/api/openapi/route.ts`: 移除 `*`，使用 allowedOrigins

2. **Debug Log 清理**
   - `src/sanity/queries.ts`: 移除 console.log
   - `src/lib/excel/itinerary-template.ts`: debugLog wrapper

3. **HSTS Header**
   - `next.config.js`: `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### UI/UX 優化

1. **Hero 圖片裁切修復**
   - `src/components/sections/Hero.tsx`: 21:9 → 2:1 比例
   - `object-top` → `object-center`

2. **表單驗證完善**
   - `src/components/ContactForm.tsx`: 完整即時驗證
   - `aria-invalid`、`aria-describedby` 無障礙屬性
   - 紅色邊框 + 錯誤訊息 (`role="alert"`)

3. **Loading Skeleton**
   - `src/components/ui/LoadingSkeleton.tsx`: 新增 CaseSkeleton
   - `src/app/tours/ToursPageClient.tsx`: 使用 CaseGridSkeleton

### 開發者體驗

1. **Skill 文件**
   - 新建 `.claude/skills/comprehensive-review.md`
   - 10 角色審查流程、歷史記錄、自學習機制

### Token 安全確認

- `.env.local` 在 `.gitignore` 中，從未提交至 git
- Vercel 環境變數已設定所有必要 tokens
- 建議：定期輪換 tokens

---

### Notion 整合強化

1. **動態家庭數量**
   - 首頁 + Tours 頁面從 Notion 抓取實際家庭數
   - 5 分鐘快取避免頻繁 API 請求
   - Fallback 至 114（若 API 失敗）

2. **行程案例排序**
   - 按旅遊日期排序（最早在前）
   - 配合 Notion 資料庫的旅遊日期欄位

3. **狀態判斷邏輯**（使用泰國時區 GMT+7）
   - 已完成：結束日 < 今天
   - 旅遊中：開始日 ≤ 今天 ≤ 結束日（綠色標示）
   - 即將出發：開始日 > 今天

### UI/UX 改善

1. **Trust Badge 優化**
   - 文案：「服務 116+ 家庭」「5.0 滿分好評」「在地台泰家庭」
   - 星星 hover 發光效果
   - 增加手機版間距避免誤點

2. **WhoWeAre 區塊**
   - 新增「閱讀我們的故事」按鈕
   - 連結至移居故事文章

3. **2025 過往案例**
   - 預設隱藏
   - 「查看/隱藏 2025 年過往案例」toggle
   - 展開後底部有「收回」按鈕

4. **LINE CTA 精簡**
   - 移除 Footer LINE 按鈕（與浮動按鈕重複）
   - 保留：Header（桌面）+ 浮動按鈕 + 頁面 CTA

### 錯誤修復

1. **Google Maps 區塊** - 移除壞掉的 iframe，保留連結按鈕
2. **時區問題** - 使用泰國時區判斷旅遊狀態
3. **動態數量** - Tours 頁面也傳入 familyCountValue
