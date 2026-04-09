# 2026-04-09 Shared Pricing Parse State

## Summary

- 共享案例儲存時，現在會一併保存解析後的行程概覽、活動匹配結果、解析警告、泰服偵測日與解析門票快照。
- 載入案例時，若該案例有解析快照，會直接還原上次解析與調整後的狀態，不再只剩上方原始行程文字。
- 舊案例若沒有新欄位，仍可正常載入；若當時是使用解析門票，也會退回目前的票券資料作為 `回解析門票` 的基底。
- 載入含住宿的案例時，會重新推算下一個飯店 `id`，避免後續新增飯店時發生編號重複。

## Files Changed

- `src/sanity/tools/pricing/PricingCalculator.tsx`
- `src/sanity/tools/pricing/savedQuoteState.ts`
- `src/sanity/tools/pricing/__tests__/savedQuoteState.test.ts`

## Verification

- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/savedQuoteState.test.ts`
- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/quoteDetails.test.ts src/sanity/tools/pricing/__tests__/quoteHtml.test.ts src/sanity/tools/pricing/__tests__/externalQuote.test.ts src/sanity/tools/pricing/__tests__/ui.test.ts src/sanity/tools/pricing/__tests__/sharedExamples.test.ts`
- `npm.cmd run build`

## Commits

- Feature: `7fad4f5` `feat: restore saved pricing parse state`
