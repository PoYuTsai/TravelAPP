# 2026-04-05 External Quote PDF Brand Refresh

## Summary

- 修正對外報價與下載 PDF 的匯款資訊，統一改為台灣帳戶格式。
- 新增共用 `quoteDetails` helper，統一處理匯款資料、行程住宿顯示規則與對外報價暖色視覺 token。
- 將 `對外報價` 頁面與 `下載報價 PDF` 一起改成暖奶油色系版型，套用 `Eric & Min` 主視覺圖。
- 修正未勾選 `含住宿` 時，PDF 仍可能殘留預設飯店名稱的問題。
- PDF 匯出前會等待主視覺圖片載入完成，降低匯出空白圖或半載入的風險。
- 補上 PDF sanitizer hotfix：保留安全的 `<img>` 標籤，避免主視覺在下載檔案中被整個移除。
- 將對外報價頁面與 PDF 的主視覺寬高抽成共用設定，避免兩邊裁切比例不一致。
- PDF 匯出改為依主視覺圖片實際寬度計算 `html2canvas` scale，避免用 3x 硬放大造成模糊。
- 新增 `2x PNG` 主視覺資產，讓對外報價頁面與 PDF 都改吃較高品質來源，降低 JPG 壓縮感。
- 最終改版方向改為移除頂部主視覺圖片，統一使用暖色純文字品牌標頭，避免頁面與 PDF 視覺不一致。
- 新增 shared header copy helper，讓 `對外報價` 頁面與 `下載 PDF` 共用同一份品牌文字與標籤。

## Files Changed

- `public/images/quote-hero-eric-min.jpg`
- `src/sanity/tools/pricing/PricingCalculator.tsx`
- `src/sanity/tools/pricing/quoteDetails.ts`
- `src/sanity/tools/pricing/__tests__/quoteDetails.test.ts`

## Verification

- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/quoteHtml.test.ts`
- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/quoteDetails.test.ts src/sanity/tools/pricing/__tests__/quoteHtml.test.ts`
- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/quoteDetails.test.ts src/sanity/tools/pricing/__tests__/guideRate.test.ts src/sanity/tools/pricing/__tests__/serviceDays.test.ts src/sanity/tools/pricing/__tests__/externalQuote.test.ts src/sanity/tools/pricing/__tests__/ui.test.ts`
- `npm.cmd run build`

## Commits

- Feature: `9c8da9f` `feat: refresh external quote pdf branding`
- Hotfix: `2b4c576` `fix: preserve quote hero image in pdf export`
- Hotfix: `408b52d` `fix: align quote pdf hero rendering`
- Hotfix: `292e10e` `fix: improve quote hero image quality`
- Final branding pass: `4366aea` `feat: simplify quote header branding`
