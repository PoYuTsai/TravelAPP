# Google CSP 與匯出權限加固

**日期**: 2026-03-16  
**狀態**: 已完成

## 背景

Google 團隊回報網站的 Google Ads 轉換追蹤因 CSP 設定不完整而無法正常運作，要求依據 Google Tag Platform 的 CSP 文件補齊設定。

在處理過程中，同步檢查到 `/api/sign-url` 權限控制過鬆，因此一併做安全加固。

## 本次完成

### 1. Google Ads / GTM CSP 修復

更新 `next.config.js`：

- 補上 Google Ads / GTM / GA4 所需來源
- 納入台灣地區網域 `google.com.tw`
- 新增基礎安全指令：
  - `base-uri 'self'`
  - `object-src 'none'`
  - `frame-ancestors 'none'`

### 2. 匯出簽名 URL 權限加固

更新：

- `src/app/api/sign-url/route.ts`
- `src/lib/signed-url.ts`
- `src/sanity/actions/exportPdfAction.tsx`
- `src/sanity/actions/exportExcelAction.tsx`
- `src/sanity/actions/exportTextAction.tsx`
- `src/lib/api-auth.ts`

處理內容：

- `/api/sign-url` 新增 dashboard whitelist 驗證
- Sanity 匯出 action 帶入 `x-user-email`
- 簽名 secret 僅允許使用 server-side `REVALIDATE_SECRET`
- email whitelist 統一轉小寫比對

## 驗證結果

- `npm run build`：通過
- `npm run test:run`：未全綠
  - 既有失敗：`src/lib/__tests__/itinerary-parser.test.ts`
  - 失敗項目：`處理沒有 Day 標題的行程`
  - 判斷為既有問題，非本次修改引入

## 仍待後續處理的風險

1. `/api/dashboard`、`/api/accounting`、`/api/sign-url` 目前仍信任前端送來的 `x-user-email`
2. `src/sanity/tools/pricing/PricingCalculator.tsx` 仍有 `container.innerHTML = html`
3. `npm audit` 仍有 32 個依賴漏洞待排程處理
4. owner whitelist 前後端多處重複硬編碼

## 新增檔案

- `CLAUDE_CODE_HANDOFF_2026-03-16.md`
- `docs/plans/2026-03-16-google-csp-and-export-hardening.md`

## Commit

- `7851312` `fix: harden google csp and signed exports`
