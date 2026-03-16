# Google CSP 與 Studio Session 驗證加固

**日期**: 2026-03-16  
**狀態**: 已完成

## 背景

Google 團隊通知網站的 Google Ads 轉換追蹤因 CSP 設定不足而無法正常運作。  
在修補 CSP 的過程中，也同步檢查了 Sanity Studio 內部匯出、Dashboard、Accounting 的驗證流程，並把原本可被偽造的 email header 改為真正的 token 驗證流程。

## 本次完成項目

### 1. Google Ads / GTM / GA4 CSP 修復

更新 `next.config.js` 的 CSP 白名單，補齊 Google 官方文件需要的來源：

- `script-src`: `pagead2.googlesyndication.com`, `googletagmanager.com`, `google.com`, `google.com.tw`
- `img-src`: `*.g.doubleclick.net`, `pagead2.googlesyndication.com`, `google.com.tw`
- `connect-src`: `*.googletagmanager.com`, `*.google-analytics.com`, `*.g.doubleclick.net`
- `frame-src`: `td.doubleclick.net`, `googletagmanager.com`

另外補上基礎安全指令：

- `base-uri 'self'`
- `object-src 'none'`
- `frame-ancestors 'none'`

### 2. Studio 驗證改為 Sanity token-backed session

調整檔案：

- `src/app/api/auth/session/route.ts`
- `src/lib/api-auth.ts`
- `src/lib/sanity-auth.ts`
- `src/lib/session-token.ts`
- `src/sanity/hooks/useSessionToken.ts`
- `src/sanity/actions/exportPdfAction.tsx`
- `src/sanity/actions/exportExcelAction.tsx`
- `src/sanity/actions/exportTextAction.tsx`
- `src/sanity/tools/dashboard/DashboardTool.tsx`
- `src/sanity/tools/accounting/AccountingTool.tsx`

調整內容：

- Sanity Studio 前端先取得 Sanity auth token
- `/api/auth/session` 以 Sanity `users/me` 驗證目前登入者
- 驗證通過後，才簽發 1 小時有效的短期 session token
- Dashboard / Accounting / `/api/sign-url` 改為只接受已簽發的 session token
- `x-user-email` 僅保留 development fallback，不再是 production 驗證依據
- `DASHBOARD_ALLOWED_EMAILS` 集中在 `src/lib/api-auth.ts` 統一正規化與比對

### 3. 報價 PDF 匯出 XSS 面收斂

調整檔案：

- `src/sanity/tools/pricing/PricingCalculator.tsx`

調整內容：

- 保留現有 `html2pdf` 匯出流程
- 在 HTML append 到 DOM 前先跑 `sanitizeQuoteHtml()`
- 移除 `script`、`iframe`、`svg`、`img`、`form` 等高風險標籤
- 移除所有 `on*` 事件屬性
- 移除 `javascript:` / `data:` 類型的危險 URL 屬性

## 驗證結果

- `npm run build`: 通過
- `npm run test:run`: 仍有 1 個既有失敗
  - 檔案：`src/lib/__tests__/itinerary-parser.test.ts`
  - 測試：`處理沒有 Day 標題的行程`
  - 此失敗與本次 CSP / auth / pricing sanitizer 修補無直接關聯

## 目前剩餘風險

1. `npm audit` 仍有既有依賴漏洞需要後續盤點與升級
2. `PricingCalculator` 目前仍是 `html2pdf` + HTML 字串架構
   - 雖然實際 XSS 面已先用 sanitizer 收斂
   - 若後續要再往上加固，建議改成純 DOM API 或 React render 後再輸出
3. itinerary parser 既有測試失敗仍待獨立修復

## 相關文件

- `CLAUDE_CODE_HANDOFF_2026-03-16.md`
- `README.md`

## Commit

- `7851312` `fix: harden google csp and signed exports`
- `74edf64` `fix: verify studio sessions and sanitize pricing export`
