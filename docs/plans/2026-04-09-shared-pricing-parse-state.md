# 2026-04-09 Shared Pricing Parse State

## Summary

- 共享案例儲存時，現在會一併保存解析後的行程概覽、活動匹配結果、解析警告、泰服偵測日與解析門票快照。
- 載入案例時，若該案例有解析快照，會直接還原上次解析與調整後的狀態，不再只剩上方原始行程文字。
- 舊案例若沒有新欄位，仍可正常載入；若當時是使用解析門票，也會退回目前的票券資料作為 `回解析門票` 的基底。
- 載入含住宿的案例時，會重新推算下一個飯店 `id`，避免後續新增飯店時發生編號重複。
- 修正泰服體驗的天數偵測，不再依賴 `unmatched` 活動列表；現在會直接從解析後的每日行程內容判斷，因此 `Day 1 接機 + 泰服 + 景點` 這類混合敘述也能正確落在對應天數。
- 若本次解析只有泰服、沒有其他 day-based 門票，也會切換成按天分組顯示，避免泰服又掉回底部獨立卡片。

## Files Changed

- `src/sanity/tools/pricing/PricingCalculator.tsx`
- `src/sanity/tools/pricing/savedQuoteState.ts`
- `src/sanity/tools/pricing/__tests__/savedQuoteState.test.ts`

## Verification

- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/savedQuoteState.test.ts`
- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/quoteDetails.test.ts src/sanity/tools/pricing/__tests__/quoteHtml.test.ts src/sanity/tools/pricing/__tests__/externalQuote.test.ts src/sanity/tools/pricing/__tests__/ui.test.ts src/sanity/tools/pricing/__tests__/sharedExamples.test.ts`
- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/thaiDress.test.ts`
- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/savedQuoteState.test.ts src/sanity/tools/pricing/__tests__/quoteDetails.test.ts src/sanity/tools/pricing/__tests__/quoteHtml.test.ts src/sanity/tools/pricing/__tests__/externalQuote.test.ts src/sanity/tools/pricing/__tests__/ui.test.ts src/sanity/tools/pricing/__tests__/sharedExamples.test.ts src/sanity/tools/pricing/__tests__/thaiDress.test.ts`
- `npm.cmd run build`

## Commits

- Feature: `7fad4f5` `feat: restore saved pricing parse state`
- Fix: `65082cd` `fix: detect thai dress day from parsed itinerary`

## 2026-05-03 Update - Activity Match Dedup

- Fixed duplicate ticket/activity matches when a custom database record and a default record share the same activity name on the same day.
- The itinerary day title remains a summary label (`Day X｜...`), so repeating an activity keyword in the detailed itinerary is allowed and should not double-count the same ticket.
- Added regression coverage for duplicate `茵他儂國家公園門票` matches while keeping distinct variants like train upper/lower bunks and horse carriage distances separate by name.

### Files Changed

- `src/lib/itinerary/activity-matcher.ts`
- `src/lib/itinerary/activity-matcher.test.ts`

### Verification

- `npm.cmd run test:run -- src/lib/itinerary/activity-matcher.test.ts`
- `npm.cmd run test:run -- src/lib/itinerary/activity-matcher.test.ts src/sanity/tools/pricing/__tests__`
- `npm.cmd run build`

### Commit

- Fix: `2babe22` `Deduplicate itinerary activity matches`

## 2026-05-03 Update - Parsed Ticket Mapping

- Fixed the UI ticket builder so parsed activity IDs are matched by exact normalized ID first, not substring matching.
- This prevents `elephantPoop` from being mapped to the `elephant` ticket group, so `大象便便造紙公園` no longer selects `大象保護營`.
- Added a second UI-layer deduplication guard for same-name tickets on the same day, so duplicate `茵他儂國家公園門票` records cannot reappear while rendering parsed tickets.

### Files Changed

- `src/sanity/tools/pricing/activityTickets.ts`
- `src/sanity/tools/pricing/__tests__/activityTickets.test.ts`
- `src/sanity/tools/pricing/PricingCalculator.tsx`

### Verification

- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__/activityTickets.test.ts`
- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__ src/lib/itinerary/activity-matcher.test.ts`
- `npm.cmd run build`

### Commit

- Fix: `bac4d33` `Fix parsed activity ticket mapping`

## 2026-05-03 Update - Generic Ticket Label Dedup

- Fixed duplicate activity labels where one stored ticket uses the base activity name and another default ticket adds a generic suffix like `門票`, `票券`, or `入場券`.
- The matcher now treats `茵他儂國家公園` and `茵他儂國家公園門票` as the same activity for the same day.
- When duplicate variants exist, the parser and UI ticket builder prefer the richer ticket template with a child price, preserving the correct `茵他儂國家公園門票` adult/child pricing.

### Files Changed

- `src/lib/itinerary/activity-matcher.ts`
- `src/lib/itinerary/activity-matcher.test.ts`
- `src/sanity/tools/pricing/activityTickets.ts`
- `src/sanity/tools/pricing/__tests__/activityTickets.test.ts`

### Verification

- `npm.cmd run test:run -- src/lib/itinerary/activity-matcher.test.ts src/sanity/tools/pricing/__tests__/activityTickets.test.ts`
- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__ src/lib/itinerary/activity-matcher.test.ts`
- `npm.cmd run build`

### Commit

- Fix: `7c0e18d` `Deduplicate generic activity ticket labels`

## 2026-05-04 Update - Train Ticket Parsing

- Fixed train ticket parsing so actionable booking estimate lines are detected when they include train class, bunk type, and bunk counts.
- `bangkokChiangMaiTrain` is now treated as a multi-select group, allowing upper and lower bunk tickets to be selected together instead of replacing each other.
- Parsed train bunk counts now populate ticket quantities, so `5 個下舖 + 5 個上舖` becomes 5 lower-bunk tickets and 5 upper-bunk tickets.
- Pure train price explanation notes remain ignored, so reference pricing text does not create unintended tickets.

### Files Changed

- `src/lib/itinerary/activity-matcher.ts`
- `src/lib/itinerary/activity-matcher.test.ts`
- `src/sanity/tools/pricing/activityTickets.ts`
- `src/sanity/tools/pricing/__tests__/activityTickets.test.ts`

### Verification

- `npm.cmd run test:run -- src/lib/itinerary/activity-matcher.test.ts src/sanity/tools/pricing/__tests__/activityTickets.test.ts`
- `npm.cmd run test:run -- src/sanity/tools/pricing/__tests__ src/lib/itinerary/activity-matcher.test.ts`
- `npm.cmd run build`

### Commit

- Fix: `de159a5` `Fix train ticket parsing`
