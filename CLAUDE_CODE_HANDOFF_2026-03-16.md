# Claude Code Handoff - 2026-03-16

## 本次任務背景

使用者回報 Google 團隊通知：

- Google Ads / 轉換追蹤因為 CSP 設定不完整而無法正常運作
- 需要依照 Google Tag Platform CSP 文件修正網站設定
- 修完後再做一輪隱性漏洞與風險盤點

## 已完成項目

### 1. Google Ads / GTM CSP 修復

已更新 `next.config.js` 的全站 CSP 設定，補上 Google Ads / GTM / GA4 需要的來源，包含：

- `pagead2.googlesyndication.com`
- `www.googletagmanager.com`
- `*.googletagmanager.com`
- `www.google.com`
- `google.com`
- `www.google.com.tw`
- `google.com.tw`
- `*.google-analytics.com`
- `*.g.doubleclick.net`

另外也補上：

- `base-uri 'self'`
- `object-src 'none'`
- `frame-ancestors 'none'`

說明：

- 這次沒有改成 nonce-based CSP
- 原因是目前網站大量使用 SSG / ISR，若整站改成 nonce 流程，Next.js 會迫使頁面改成動態渲染，會直接影響既有 SEO / 效能策略
- 因此本次採用「維持靜態 headers + 補齊 Google 官方要求來源」的穩健修法

### 2. 匯出簽名 URL 權限加固

在檢查過程中發現 `/api/sign-url` 有實際風險：

- 原本只做 rate limit
- 任何知道 itinerary id 的人理論上都能請求簽名匯出 URL

已修正為：

- `/api/sign-url` 現在會走 `validateDashboardAccess()`
- Sanity 匯出 action（PDF / Excel / LINE 文字）會附帶 `x-user-email`
- `getSigningSecret()` 現在只允許使用 server-side `REVALIDATE_SECRET`
- 移除 `NEXT_PUBLIC_SIGNING_SECRET` fallback，避免設計上把簽名密鑰公開化

### 3. Email whitelist 正規化

`src/lib/api-auth.ts` 已將 `DASHBOARD_ALLOWED_EMAILS` 做 `trim().toLowerCase()`，避免大小寫或空白造成誤判。

## 已驗證

- `npm run build`：成功
- Google Ads CSP 相關修改已通過 production build

## 目前仍存在的風險 / 建議 Claude 接手處理

### 高優先

1. `x-user-email` 仍是可偽造 header
   - 目前 `/api/dashboard`、`/api/accounting`、`/api/sign-url` 都信任前端送來的 `x-user-email`
   - 雖然 Sanity UI 前端有做 owner gate，但 API 層仍缺真正的 server-side 身份驗證
   - 建議改成：
     - Sanity session / token-based server verification
     - 或至少改成伺服器可驗證的簽章 / JWT

2. 報價工具仍有 `innerHTML`
   - `src/sanity/tools/pricing/PricingCalculator.tsx` 仍使用 `container.innerHTML = html`
   - 若未來更多動態欄位直接拼進模板，存在 DOM XSS 風險
   - 建議中期改成：
     - 更嚴格的 escape
     - 或改用 DOM API / React render 而不是直接 innerHTML

### 中優先

3. 依賴漏洞數量偏高
   - `npm audit --json` 顯示 32 個漏洞
   - 其中包含：
     - `next` 14.2.35
     - `sanity` 3.99.0 / `next-sanity` 9.12.3
     - 以及多個 transitive packages
   - 這不代表站一定已被利用，但屬於應排程處理的技術債

4. Dashboard / Accounting 前端白名單重複硬編碼
   - `DashboardTool.tsx` 與 `AccountingTool.tsx` 內都各自硬編碼 owner email
   - 後端也另有 `DASHBOARD_ALLOWED_EMAILS`
   - 建議集中成單一設定來源，避免前後端 whitelist 漂移

## 本次功能 commit

- `7851312` `fix: harden google csp and signed exports`

## 檔案變更（功能）

- `next.config.js`
- `src/app/api/sign-url/route.ts`
- `src/lib/api-auth.ts`
- `src/lib/signed-url.ts`
- `src/sanity/actions/exportPdfAction.tsx`
- `src/sanity/actions/exportExcelAction.tsx`
- `src/sanity/actions/exportTextAction.tsx`

## 備註

- `vitest` 目前有一個既有失敗測試：`src/lib/__tests__/itinerary-parser.test.ts`
- 失敗案例是「處理沒有 Day 標題的行程」
- 這個失敗在本次 CSP 修復之前就存在，與本次改動無直接關係
