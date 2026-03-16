# Itinerary Parser Fallback Fix

**日期**: 2026-03-16  
**狀態**: 已完成

## 背景

`src/lib/__tests__/itinerary-parser.test.ts` 先前有一個既有失敗測試：

- `處理沒有 Day 標題的行程`

問題原因是 parser 遇到只有日期行、但下一行沒有 `Day X` 標題時，只會暫存日期，不會真正建立 day，導致整段內容被略過。

## 本次完成項目

調整檔案：

- `src/lib/itinerary/parse-itinerary-with-fallback.ts`
- `src/lib/itinerary/index.ts`
- `src/lib/itinerary/activity-matcher.ts`

調整內容：

- 新增 itinerary parser wrapper
- 先走既有 parser
- 如果偵測到日期段數比 parse 出來的 day 數更多，啟用 fallback parser
- fallback parser 支援「有日期、但缺少 Day 標題」的輸入格式
- activity matcher 同步改走這個 wrapper，避免不同入口結果不一致

## 驗證結果

- `npm run test:run`: 通過，54/54 tests passed
- `npm run build`: 通過

## Commit

- `996968a` `fix: fallback parse itineraries without day titles`
