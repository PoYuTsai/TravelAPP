# 公開前端回退至原始設計

**日期**: 2026-03-17
**狀態**: 已完成

## 背景

同日曾完成一輪首頁、行程頁、文章頁與包車頁的前台承接頁改版，但實際檢視後決定保留原本的對外設計與原始文案節奏。

本次目標是：

1. 將公開前端畫面完整回退到原本版本。
2. 保留已驗證無虞的後端、安全、CSP、Studio session 與內容結構調整。
3. 避免因回退前端而誤傷全站聯絡入口、Lint gate 與其他已穩定的內部維護成果。

## 本次完成項目

### 1. 公開頁面與可見元件回退

調整檔案：

- `src/app/page.tsx`
- `src/app/tours/page.tsx`
- `src/app/tours/ToursPageClient.tsx`
- `src/app/tours/[slug]/page.tsx`
- `src/app/blog/page.tsx`
- `src/app/blog/[slug]/page.tsx`
- `src/app/services/car-charter/page.tsx`
- `src/app/contact/page.tsx`
- `src/app/homestay/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/cancellation/page.tsx`
- `src/app/layout.tsx`
- `src/components/Header.tsx`
- `src/components/Footer.tsx`
- `src/components/ContactForm.tsx`
- `src/components/StickyMobileCTA.tsx`
- `src/components/ui/FloatingLineButton.tsx`
- `src/components/ui/LineCTAButton.tsx`
- `src/components/sections/Hero.tsx`
- `src/components/sections/TrustNumbers.tsx`
- `src/components/sections/Testimonials.tsx`
- `src/components/sections/CTA.tsx`
- `src/components/blog/AuthorCard.tsx`
- `src/components/blog/InlineCTA.tsx`
- `src/components/blog/PortableTextRenderer.tsx`
- `src/components/blog/RelatedPosts.tsx`
- `src/components/blog/RelatedToursCTA.tsx`
- `src/components/blog/TableOfContents.tsx`
- `src/components/blog/ArticleSchema.tsx`
- `src/components/cms/PricingTable.tsx`
- `src/components/tours/PackageCard.tsx`
- `src/components/tours/DayTourCard.tsx`
- `src/components/tours/CaseCard.tsx`
- `src/components/tours/RelatedBlogPosts.tsx`
- `src/components/tours/RelatedTours.tsx`

調整內容：

- 首頁 Hero、TrustNumbers、CTA 與原本的標題／文案／節奏恢復為舊版公開樣式
- `/tours`、`/blog`、詳頁與包車頁的新版承接版型回退為原始公開版本
- Header、Footer、浮動按鈕、文章內 CTA 等可見入口恢復原設計與原本排版節奏
- Contact、Homestay、法務頁等前台可見頁面一併回退，避免局部仍停留在新版風格

### 2. 保留不回退的內容

- Google CSP、Studio session、`/api/sign-url`、itinerary parser fallback 等後端與安全修正維持不變
- `.eslintrc.json`、Lint gate、依賴與驗證流程維持不變
- `siteSettings` schema、內容結構與 CMS 擴充維持保留，後續仍可作為內容營運基礎

## 驗證結果

- `npm run lint`: 通過
- `npm run build`: 通過

## Commit

- `3d9c397` `revert: restore original public frontend`
