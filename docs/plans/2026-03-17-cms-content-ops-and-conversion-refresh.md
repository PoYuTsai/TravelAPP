# CMS 內容營運收斂與前台承接頁改版

**日期**: 2026-03-17
**狀態**: 已完成

## 背景

在完成 Google CSP、Studio session 驗證與 itinerary parser 修復後，前台主要頁面雖然已可穩定運作，但仍有兩個明顯瓶頸：

1. 對外頁面承接力不足，首頁、行程列表、文章列表與詳頁的品牌感與轉換節奏仍偏展示站。
2. 品牌信任內容、社群入口與 CTA 大量分散在元件內，後續做 AEO / SEO 文案迭代仍需要回程式碼修改。

本次目標是同步處理「前台轉換頁升級」與「內容營運 CMS 化」，讓網站對外更完整、對內更好維運。

## 本次完成項目

### 1. 首頁與主要對外頁面改版

調整檔案：

- `src/app/page.tsx`
- `src/components/sections/Hero.tsx`
- `src/components/sections/TrustNumbers.tsx`
- `src/components/sections/CTA.tsx`
- `src/app/tours/page.tsx`
- `src/app/tours/ToursPageClient.tsx`
- `src/components/tours/PackageCard.tsx`
- `src/components/tours/DayTourCard.tsx`
- `src/components/tours/CaseCard.tsx`
- `src/app/blog/page.tsx`
- `src/app/tours/[slug]/page.tsx`
- `src/components/tours/RelatedTours.tsx`
- `src/components/tours/RelatedBlogPosts.tsx`
- `src/app/blog/[slug]/page.tsx`
- `src/components/blog/AuthorCard.tsx`
- `src/components/blog/TableOfContents.tsx`
- `src/components/blog/RelatedPosts.tsx`
- `src/components/blog/PortableTextRenderer.tsx`
- `src/components/blog/ArticleSchema.tsx`
- `src/app/services/car-charter/page.tsx`
- `src/components/cms/PricingTable.tsx`

調整內容：

- 首頁 Hero 升級為更明確的品牌敘事與 trust-first 版型
- 首頁信任區改為卡片式呈現，並保留 `/tours` compact 版本
- `/tours` 列表頁新增更清楚的頁首、信任說明、卡片層級與底部 CTA
- `/blog` 列表頁補上更完整的 hero、精選文章與搜尋／分類承接區
- 行程詳頁重做第一屏、價格摘要、CTA 與延伸閱讀承接
- 文章詳頁重做 hero、作者信任區、側邊目錄、文末 CTA 與 related posts
- 包車頁升級為更完整的轉換 landing page，補上服務摘要、規劃檢查清單、FAQ 側邊支援與深色價格區
- 修正文章 schema 圖片網址與文章內 tours block 的錯誤連結

### 2. 內容模型與全域資料 CMS 化

調整檔案：

- `src/sanity/schemas/siteSettings.ts`
- `src/sanity/schemas/landingPage.ts`
- `src/sanity/schemas/carCharter.ts`
- `src/sanity/schemas/homestay.ts`
- `src/sanity/schemas/index.ts`
- `src/sanity/structure.ts`
- `src/lib/site-settings.ts`
- `src/components/sections/Testimonials.tsx`
- `src/components/Footer.tsx`
- `src/app/homestay/page.tsx`

調整內容：

- 新增 `siteSettings` schema，集中管理品牌資料、社群連結、評論資訊與 trust section
- 首頁 Hero / CTA 的 proof items、輔助文案、側欄標題與步驟改為可由 Sanity 編輯
- 包車頁 hero highlights、服務摘要卡、planning checklist、FAQ 側欄與底部 CTA 改為可管理欄位
- 民宿頁的社會證明數據、季節限定活動與底部 CTA 改為由 schema 驅動
- 首頁與 `/tours` 共用的信任卡區塊改為全域設定
- Footer、首頁 testimonials、文章作者卡與部分結構化資料改用全域設定資料

### 3. 聯絡入口與追蹤來源收斂

調整檔案：

- `src/components/providers/SiteSettingsProvider.tsx`
- `src/app/layout.tsx`
- `src/components/Header.tsx`
- `src/components/ui/FloatingLineButton.tsx`
- `src/components/StickyMobileCTA.tsx`
- `src/components/ui/LineCTAButton.tsx`
- `src/components/ContactForm.tsx`
- `src/app/contact/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/cancellation/page.tsx`
- `src/components/blog/InlineCTA.tsx`
- `src/components/blog/RelatedToursCTA.tsx`
- `src/lib/analytics.ts`
- `src/lib/navigation.ts`

調整內容：

- 新增 client-side `SiteSettingsProvider`，讓 Header / CTA / 浮動按鈕能共用同一份全域設定
- Header、Footer、浮動 LINE 按鈕、StickyMobileCTA、文章 CTA 等入口統一讀取 `siteSettings.socialLinks.line`
- ContactForm 會根據實際 LINE 連結推回 OA handle 與訊息連結，不再依賴固定字串
- privacy / terms / cancellation 頁面改為顯示實際 CMS 內設定的 LINE 入口
- `trackLineClick()` 改為帶入實際點擊連結，讓追蹤與前台呈現一致

### 4. 品質閘與驗證

調整檔案：

- `.eslintrc.json`
- `package.json`
- `package-lock.json`
- `src/sanity/hooks/useSessionToken.ts`
- `src/sanity/tools/pricing/PricingCalculator.tsx`

調整內容：

- 補上 ESLint 設定，讓 `npm run lint` 可作為正式 quality gate
- 清掉既有 hooks warning，讓 lint 回到乾淨狀態
- 延續前一輪 parser 修復後的測試基線，確認目前專案可通過 lint / test / build

## 驗證結果

- `npm run lint`: 通過
- `npm run test:run`: 通過，54/54 tests passed
- `npm run build`: 通過

## 後續建議

1. 將 `PricingCalculator` 進一步拆模組，降低單檔維護風險。
2. 盤點仍依賴 fallback 的品牌文案，逐步補齊 Sanity 初始內容。
3. 規劃下一輪 detail template 微調與實際內容營運節奏。
