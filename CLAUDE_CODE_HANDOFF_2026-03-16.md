# Claude Code Handoff - 2026-03-16

## 目前狀態

本次原本是處理 Google 團隊通知的 CSP 問題，後來延伸把 Studio 內部驗證與報價匯出的安全面一起補強。  
目前 Google Ads CSP 修復、Studio session 驗證加固、PricingCalculator 的 XSS 面收斂都已完成，並已通過 production build。

## 這次已完成

### 1. Google Ads / GTM / GA4 CSP 修復

已依 Google 官方文件補齊 `next.config.js` 的 CSP 白名單，包含：

- `pagead2.googlesyndication.com`
- `googletagmanager.com`
- `google.com`
- `google.com.tw`
- `*.google-analytics.com`
- `*.g.doubleclick.net`
- `td.doubleclick.net`

另外加上：

- `base-uri 'self'`
- `object-src 'none'`
- `frame-ancestors 'none'`

### 2. Studio 驗證不再信任 `x-user-email`

已完成的架構：

- Sanity Studio 前端先取 Sanity auth token
- 呼叫 `/api/auth/session`
- 後端用 Sanity `users/me` 驗證目前登入者
- 驗證通過後，簽發 1 小時有效的短期 session token
- Dashboard / Accounting / `/api/sign-url` 改成只接受這個 session token

重點：

- production 不再把 `x-user-email` 當作正式驗證依據
- `x-user-email` 只保留 development fallback
- `DASHBOARD_ALLOWED_EMAILS` 已集中在 `src/lib/api-auth.ts` 統一處理

### 3. PricingCalculator 匯出前先 sanitize HTML

`src/sanity/tools/pricing/PricingCalculator.tsx` 仍維持現有 `html2pdf` 流程，但在 append 到 DOM 前新增 `sanitizeQuoteHtml()`：

- 移除 `script` / `iframe` / `svg` / `img` / `form` 等高風險標籤
- 移除所有 `on*` 事件屬性
- 移除 `javascript:` / `data:` 類型 URL

這一版先把可直接利用的 DOM XSS 面收斂住，避免大改報價工具 UI 結構。

## 已驗證

- `npm run build`: 通過
- `npm run test:run`: 通過，54/54 tests passed

## 建議 Claude 下一步優先處理

1. 依賴漏洞盤點與升級
   - `npm audit` 仍有既有風險
   - 建議先看 high / critical 是否可直接升版或只需調整 transitive dependencies

2. PricingCalculator 長期重構
   - 目前已加 sanitizer，短期風險已下降
   - 長期仍建議改成純 DOM API / React render，而不是整段 HTML 字串 + `innerHTML`

## 這次關鍵檔案

- `next.config.js`
- `src/app/api/auth/session/route.ts`
- `src/app/api/sign-url/route.ts`
- `src/lib/api-auth.ts`
- `src/lib/itinerary/parse-itinerary-with-fallback.ts`
- `src/lib/sanity-auth.ts`
- `src/lib/session-token.ts`
- `src/sanity/hooks/useSessionToken.ts`
- `src/sanity/tools/pricing/PricingCalculator.tsx`
- `src/sanity/actions/exportPdfAction.tsx`
- `src/sanity/actions/exportExcelAction.tsx`
- `src/sanity/actions/exportTextAction.tsx`
- `src/sanity/tools/dashboard/DashboardTool.tsx`
- `src/sanity/tools/accounting/AccountingTool.tsx`

## 先前 commit

- `7851312` `fix: harden google csp and signed exports`
- `650b80b` `docs: add csp security handoff`
- `74edf64` `fix: verify studio sessions and sanitize pricing export`
- `996968a` `fix: fallback parse itineraries without day titles`
