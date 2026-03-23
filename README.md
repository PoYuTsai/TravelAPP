# 清微旅行 Chiangway Travel

清邁親子自由行包車服務官方網站 + 內部營運系統

## 專案資訊

- **品牌**: 清微旅行 Chiangway Travel
- **網站**: https://chiangway-travel.com
- **服務**: 清邁親子包車、客製旅遊、中文導遊
- **技術架構**: Next.js 14 + Sanity CMS + Tailwind CSS

## 開發狀態

| Phase | 名稱 | 狀態 |
|-------|------|------|
| Phase 1 | 官網 + Landing Page | ✅ 完成 |
| Phase 2 | SEO 優化 + 部落格 | ✅ 完成 |
| Phase 3 | 內部營運工具 | ✅ 完成 |
| Phase 4 | 客戶體驗優化 | ✅ 完成 |
| Phase 5 | 綜合審查優化 | ✅ 完成 |
| Phase 5.1 | UX 精緻化 | ✅ 完成 |
| Phase 5.2 | 10 角色全面審查 | ✅ 完成 |
| Phase 5.3 | 安全性與無障礙優化 | ✅ 完成 |
| Phase 5.4 | 綜合審查後續優化 | ✅ 完成 |
| Phase 5.5 | 手機 UX 優化 | ✅ 完成 |
| Phase 5.6 | 政策與 FAQ 優化 | ✅ 完成 |
| Phase 6 | 記帳系統 + 知識庫 | ✅ 完成 |
| Phase 6.1 | 審查 #5 系統優化 | ✅ 完成 |
| Phase 6.2 | 審查 #6 SEO/A11y 優化 | ✅ 完成 |
| Phase 6.3 | API 安全性強化 | ✅ 完成 |
| Phase 6.4 | 審查 #7 + UX 優化 | ✅ 完成 |
| Phase 6.5 | Blog 分頁 + Schema 補強 | ✅ 完成 |
| Phase 6.6 | 審查 #8 A11y/資安優化 | ✅ 完成 |
| Phase 6.7 | 審查 #10 SEO/行銷追蹤優化 | ✅ 完成 |
| Phase 6.8 | 報價計算系統 | ✅ 完成 |
| 維護 2026-03-16 | Google CSP / Studio / Parser 穩定性 | ✅ 完成 |
| 維護 2026-03-17 | CMS 內容營運收斂 + 前端回退原始設計 | ✅ 完成 |
| 維護 2026-03-22 | Phase 7 規格完善 + Implementation Plan + Handoff | ✅ 完成 |
| 維護 2026-03-22 | Phase 7 shared runtime / KV / processor 實作 | ✅ 完成 |
| 維護 2026-03-22 | Phase 7 Telegram Bot API / forum topic / callback ack | ✅ 完成 |
| 維護 2026-03-23 | Phase 7 webhook processor kickoff | ✅ 完成 |
| 維護 2026-03-23 | Footer credit cleanup + dashboard allowlist fix | ✅ 完成 |
| 維護 2026-03-23 | Phase 7 Anthropic draft generation + Studio auth sync | ✅ 完成 |
| 維護 2026-03-23 | Phase 7 Telegram action prompts + callback tokens | ✅ 完成 |
| 維護 2026-03-23 | Phase 7 image delivery flow | ✅ 完成 |
| **Phase 7** | **LINE OA AI 客服助理** | 🚧 Phase 7.2 實作中 |
| Phase 7.1 | Webhook + 需求抽取 + TG Topics | 🚧 TG 真實整合 + webhook kickoff + Anthropic AI draft + Telegram action prompts 完成 |
| Phase 7.2 | 草稿生成 + 一鍵回覆 + 圖片發送 | 🚧 TG 收圖 / 選客人 / LINE image push 完成，live staging 待驗證 |
| Phase 7.3 | 語音輸入 + 週報優化 + 內部派單 | 📋 待實作 |

### Phase 1：官網
- 響應式 Landing Page
- LINE CTA 整合
- GA4 + Google Ads 追蹤

### Phase 2：SEO 優化
- 部落格系統
- SEO 文章內容策略
- 結構化資料

### Phase 3：內部營運工具
- **客戶行程表系統**：快速建立、結構化編輯、PDF/Excel/文字匯出
- **財務 Dashboard**：Notion 資料視覺化、年度比較、趨勢圖
- **Google Ads 轉換追蹤**：頁面瀏覽、LINE 點擊事件

### Phase 4：客戶體驗優化
- **行程頁面**：豐富行程展示、照片輪播、FAQ
- **民宿頁面**：民宿介紹、設施列表、預約引導
- **包車介紹**：車型介紹、價格透明化、服務流程
- **About Us**：品牌故事、團隊介紹、移民緣由

### Phase 5：綜合審查優化
10 角度專業審查並實施改進：

- **安全性**：API 安全 headers、CORS 配置
- **效能優化**：Notion 快取機制（5 分鐘 TTL）、Loading Skeletons
- **SEO 強化**：Blog 搜尋功能、分類頁面 SEO URLs、相關文章推薦、內部連結優化
- **開發者體驗**：OpenAPI/Swagger 文件、集中式 Logger
- **UX 改善**：404 頁面優化、動態家庭數量顯示
- **iOS 相容性**：Safari 觸控事件、CSS 動畫優化
- **品牌一致性**：Footer 分類連結、協作開發署名

### Phase 5.1：UX 精緻化
基於實際使用回饋的細節優化：

- **Notion 整合強化**：動態家庭數量、泰國時區狀態判斷、旅遊日期排序
- **行程案例狀態**：已完成 / 旅遊中（綠色）/ 即將出發 三種狀態
- **2025 過往案例**：預設隱藏、展開/收回功能
- **Trust Badge 優化**：文案改進、星星 hover 發光效果
- **LINE CTA 精簡**：移除重複按鈕、保留浮動按鈕 + Header
- **故事連結**：WhoWeAre 區塊新增「閱讀我們的故事」按鈕

### Phase 5.2：10 角色全面審查
從 10 個專業角度進行全面審查並實施優化：

- **SA 架構**：Sanity CDN 啟用、Logger 整合
- **後端**：API Key 生產強制、輸入驗證強化、Email whitelist 修復
- **QA 測試**：Lightbox 鍵盤支援（Esc 關閉）、背景滾動防止
- **SEO**：Canonical URLs、Sitemap 完善、FAQ Schema、OG Image
- **行銷**：文章閱讀追蹤、表單提交追蹤
- **資安**：CORS 修復、Debug log 清理、HSTS Header
- **UI/UX**：Hero 圖片比例修復、表單驗證完善、Loading Skeleton
- **開發者體驗**：10 角色審查 Skill 文件（自學習機制）

### Phase 5.3：安全性與無障礙優化
基於綜合審查的深度安全與無障礙改進：

- **安全性**：Revalidate API 時間攻擊防護（timingSafeEqual）、Authorization header 支援
- **SEO**：Blog 分類頁 Schema（CollectionPage + BreadcrumbList）、內部連結優化
- **無障礙**：Lightbox focus trap、aria-expanded/aria-current、Touch target 44px+
- **程式碼品質**：API 路由統一使用集中式 Logger
- **防索引**：/api-docs noindex 設定

### Phase 5.4：綜合審查後續優化
10 角色全面審查後的關鍵問題修復：

- **SEO**：Canonical URLs 統一為絕對路徑（blog + tours 頁面）
- **安全性**：PDF/Excel 模板 HTML 轉義（XSS 防護）、移除 REVALIDATE_SECRET URL 參數
- **日誌系統**：Notion client 統一使用集中式 Logger
- **配置完善**：.env.example 補齊遺漏環境變數
- **表單驗證**：ContactForm 電話欄位長度驗證
- **UX 改善**：SearchBox 觸控目標增大至 44px+

### Phase 5.5：手機 UX 優化
修復手機端水平滾動問題，提升移動裝置瀏覽體驗：

- **水平滾動防止**：html/body 加入 `overflow-x: hidden`
- **響應式媒體**：img/video/iframe/pre 統一加入 `max-width: 100%` 約束
- **測試驗證**：production build 通過，確保無破壞性變更

### Phase 5.6：政策與 FAQ 優化
完善取消政策與包車服務說明：

- **服務方式說明**：泰文司機 + 中文導遊專業分工模式、行程事先確定
- **超時費用政策**：清邁 10 小時 / 清萊 12 小時、超時費 200 泰銖/小時
- **旺季連續用車**：2月春節、4月潑水節、11月水燈節、12-1月跨年不接受跳天
- **入境須知**：TDAC 填寫提醒、20,000 泰銖現金要求
- **包車 FAQ 優化**：新增司機語言、超時計算等常見問題（Sanity CMS）

### Phase 6：記帳系統 + 知識庫
個人財務追蹤與業務知識傳承系統：

- **個人記帳**：Sanity Studio 記帳工具（/studio → 💰 記帳）
  - 日期區間 + 餘額輸入、入金記錄管理
  - Notion 業務成本自動串接、40 萬門檻警示
- **成本解析器**：Notion 自由格式文字解析（規則式 + 不確定值標記）
- **知識庫系統**：Notion 資料庫（96 筆）+ 連結審計腳本
  - 🍜 餐廳推薦：21 筆
  - ☕ 咖啡廳推薦：10 筆
  - 🏨 飯店推薦：19 筆
  - 🏔️ 景點推薦：8 筆
  - 🎫 門票資訊：22 筆
  - 💬 話術範本：16 筆

### Phase 6.1：審查 #5 系統優化
全面系統審查與優化（10 個問題修復）：

- **資安強化**：
  - 移除 Revalidate API query param secret 支援（僅 header）
  - 成本解析器加入 2000 字元長度限制（ReDoS 防護）
- **行銷追蹤修復**：
  - 修正 Form 轉換追蹤 ID、移除 LINE 點擊雙重追蹤
  - 新增 Video 播放追蹤（start/25%/50%/75%/complete）
  - 新增 Scroll Depth 追蹤（25/50/75/90%）
- **SEO 強化**：
  - 新增 4 個頁面 Schema（/tours、/blog、/contact、/homestay）
  - Tour 詳情頁加入 BreadcrumbList Schema
- **無障礙改善**：
  - Testimonial dots 觸控目標增大至 44px（WCAG）
  - Lightbox 加入方向鍵導航 + 圖片計數

### Phase 6.2：審查 #6 SEO/A11y 優化
10 角色審查後的 SEO 與無障礙改善：

- **SSG 優化**：Tour 詳情頁 generateStaticParams
- **無障礙**：44px 觸控目標（Carousel dots、SearchBox）、Mobile menu focus trap
- **A11y**：Unique aria-labels、Video 鍵盤支援
- **SEO**：Studio noindex metadata

### Phase 6.3：API 安全性強化
Itinerary API 存取控制強化：

- **Signed URL**：時效性 Token 驗證（5 分鐘過期）
- **API 保護**：PDF/Excel/Text 匯出 API 需驗證 token
- **流程整合**：Sanity Actions 先取得 signed URL 再開啟匯出連結

### Phase 6.4：審查 #7 + UX 優化
綜合審查與使用者體驗改善：

- **評論整合**：Google 評論加入 Testimonials、5 星 badge 連結改為 Google
- **案例展示優化**：
  - 狀態優先排序（旅遊中 > 即將出發 > 已完成）
  - 歷史案例按年份分組、每年 10 筆分頁載入
  - 浮動收回按鈕（位於 LINE 按鈕上方）
- **無障礙改善**：
  - OverviewVideo：dialog role、Escape 鍵、focus trap、48px 按鈕
- **資安強化**：
  - signed-url 改用 HMAC-SHA256（Node.js crypto）
  - /api/tours/cases 加入 rate limiting
- **行銷追蹤修正**：
  - 移除 Button 自動 LINE 追蹤（防重複）
  - 移除 ContactForm 雙重轉換計數
- **SEO**：Organization + WebSite Schema、robots.txt 更新

### Phase 6.5：Blog 分頁 + Schema 補強
部落格分頁功能與政策頁面 Schema 強化：

- **Blog 分頁**：每頁 9 篇文章、WCAG 44px 觸控目標
- **精選文章**：只在第一頁且無篩選時顯示
- **URL 支援**：分頁與 category/search 參數共存
- **WebPage Schema**：新增至 privacy、terms、cancellation 頁面

### Phase 6.6：審查 #8 A11y/資安優化
第 8 次全面審查，重點改善無障礙與程式碼品質：

- **A11y 強化**：PortableTextRenderer Lightbox 完整鍵盤支援（Esc、focus trap）
- **觸控目標**：StopsCarousel、FloatingLineButton 增大至 44px+ (WCAG)
- **資安改善**：Rate limit 清理機制、HMAC 增強、logger 統一
- **程式碼品質**：Google Ads ID 集中管理、FAQSection role="region"

### Phase 6.7：審查 #10 SEO/行銷追蹤優化
第 10 次全面審查，SEO 與行銷追蹤改善：

- **SEO 優化**：頁面 meta 改善、結構化資料補強
- **行銷追蹤**：Google Tag Manager 遷移、轉換追蹤優化
- **程式碼品質**：集中式追蹤管理

### Phase 6.8：報價計算系統
Sanity Studio 內部報價計算工具：

- **智能行程解析**：貼入行程文字自動解析
  - 日期解析：自動偵測天數、日期格式
  - 活動匹配：關鍵字匹配 + 已知打錯字處理（避免泰服/泰拳誤判）
  - 飯店解析：自動帶入住宿資訊
  - 車費欄位：日期自動帶入，金額手動填寫
- **住宿系統**：多飯店支援、4 類房型 × 3 子類型（12 種房型配置）
- **門票系統**：
  - 多階方案（基本/進階）、回扣計算
  - 互斥群組（大象營、人妖秀、射擊、飛索、泰拳）
  - 新增：泰拳 VIP/一般、騎馬
  - 泰服體驗整合進門票區塊（動態天數顯示）
- **兒童設施**：汽座（0-2歲/2-5歲）、增高墊定價
- **三階段付款**：住宿全額 → 餐費門票 → 車導尾款（送機前一天）
- **超時計算**：清邁 10hr / 清萊 12hr、200 泰銖/小時
- **報價單匯出**：
  - 內部報價：含成本利潤分析
  - 外部報價 PDF：棕色主題配色、與 UI 一致
  - 行程概覽：以車費天數為準，支援動態天數
- **政策說明**：退款政策（車導/住宿/門票餐費）、隱私政策（TM30 申報）
- **UX 優化**：
  - 房型分類可收合展開（預設：有房間才展開）
  - 品牌配色統一（棕色主題）
  - 押金勾選（代收/提醒客人自付）
  - Footer 官網 + LINE 連結
  - 直接下載 PDF（html2pdf.js 客戶端產生）

### 維護：Google CSP / 匯出權限加固 (2026-03-16)
Google Ads 轉換追蹤與內部匯出 API 安全加固：

- **Google CSP 修復**：補齊 Google Ads / GTM / GA4 所需來源
  - `script-src`: `pagead2.googlesyndication.com`, `googletagmanager.com`, `google.com`, `google.com.tw`
  - `img-src`: `*.g.doubleclick.net`, `pagead2.googlesyndication.com`, `google.com.tw`
  - `connect-src`: `*.googletagmanager.com`, `*.google-analytics.com`, `*.g.doubleclick.net`
  - `frame-src`: `td.doubleclick.net`, `googletagmanager.com`
- **基礎 CSP 加固**：新增 `base-uri 'self'`、`object-src 'none'`、`frame-ancestors 'none'`
- **Studio 驗證加固**：`/api/auth/session` 會先用 Sanity `users/me` 驗證目前登入者，再簽發短期 session token
- **匯出安全加固**：`/api/sign-url`、Dashboard、Accounting 現在只接受已驗證的 session token，不再依賴可偽造 email header
- **Parser 相容修復**：行程文字在只有日期、缺少 `Day X` 標題時，現在會自動 fallback 解析
- **簽名密鑰收斂**：移除 public env fallback，簽名僅允許使用 server-side `REVALIDATE_SECRET`
- **驗證結果**：`npm run build` 通過

### 維護：CMS 內容營運收斂 + 前端回退原始設計 (2026-03-17)
針對內容結構、全站聯絡一致性與公開前端版本做收斂：

- **CMS 結構保留**：`siteSettings`、首頁 / 包車 / 民宿欄位擴充與內容營運結構維持保留
- **聯絡入口收斂**：全站 LINE / 社群入口、追蹤與內容模型仍維持統一來源
- **品質閘恢復**：補上 `.eslintrc.json` 並讓 `npm run lint` 回到可用狀態
- **公開前端回退**：首頁、`/tours`、`/blog`、詳頁與包車頁的新版承接頁改動已完整 fallback 回原始設計與原本文字
- **保留後端修正**：Google CSP、Studio session、`/api/sign-url`、parser fallback 等後端與安全修正不回退
- **驗證結果**：`npm run lint`、`npm run build` 通過

### 維護：Footer credit cleanup + dashboard allowlist fix (2026-03-23)

- Public footer 移除 `由 Eric 與 Claude Code 協作開發` 額外署名，只保留標準版權行
- `src/lib/api-auth.ts` 內建白名單 fallback：`eric19921204@gmail.com`
- Dashboard / Accounting / Sign URL 相關保護路由沿用同一套 allowlist 判斷
- 新增測試：
  - `src/lib/__tests__/api-auth.test.ts`
  - `src/components/__tests__/Footer.test.tsx`
- 驗證：`npm run test:run`、`npm run lint`、`npm run build` 全部通過

### Phase 7：LINE OA AI 客服助理系統
將 LINE OA 客服從「純手動回覆」升級為「AI 輔助 + 人工決策」模式：

- **核心目標**：初次回覆時間從 30-60 分鐘降至 5-10 分鐘
- **設計原則**：AI 準備草稿，Eric 決定是否送出（人機協作，不是全自動）
- **目前狀態**：規格 v2.1、implementation plan、Claude handoff、shared runtime / KV / processor、真實 Telegram Bot API topic + callback ack、webhook best-effort processor kickoff、Anthropic AI draft、Telegram action prompts、image delivery flow 都已完成；cron rollout 設定與 live staging 驗證待補
- **Phase 7.1 - MVP**：
  - LINE Webhook fast-ack 接收訊息（不觸發已讀）
  - Claude Haiku 需求抽取（日期、人數、景點、特殊需求）
  - Telegram Topics 通知（每客人獨立對話串，上下文隔離）
  - 冪等處理、Topic mapping、對話狀態追蹤
  - Anthropic AI draft generation，保留 safe fallback，未設 API key 時仍走 local template
  - Telegram action prompts + compact callback tokens，callback 不再依賴過長 JSON payload
  - Image delivery flow：TG 收圖 → 選客人 → LINE image push，並透過 `/api/line-media/[token]` 安全代理圖片
- **Phase 7.2 - 完整功能**：
  - Claude Sonnet + RAG 草稿生成（參考成交對話、行程範本、話術）
  - 一鍵送出 / 編輯送出 / 自己回
  - 圖片發送（TG 發圖 → 選客人 → LINE 發送）
  - 成交標記、封存、資料生命週期管理
  - 快速回饋按鈕（👍 📏 🎭 ❄️）+ 每日摘要（20:00）
- **Phase 7.3 - 進階**：
  - 語音輸入（Whisper API）
  - 收單信號偵測（AI 建議發 QR Code 時機）
  - 週報 + Prompt 優化建議
  - 內部派單記錄（/new /assign /cost）
- **技術架構**：LINE Messaging API + Claude API + Telegram Bot + Sanity + Vercel KV
- **關鍵約束**：webhook fast-ack、event/action idempotency、Notion 只作舊客提示、Prompt 更新必須人工批准
- **詳細規格**：[docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md](docs/plans/2026-03-22-phase7-line-oa-ai-assistant.md)
- **實作計畫**：[docs/plans/2026-03-22-phase7-line-oa-ai-assistant-implementation-plan.md](docs/plans/2026-03-22-phase7-line-oa-ai-assistant-implementation-plan.md)
- **本輪進度**：[docs/plans/2026-03-22-phase7-shared-runtime-and-kv-implementation.md](docs/plans/2026-03-22-phase7-shared-runtime-and-kv-implementation.md)
- **Telegram 整合進度**：[docs/plans/2026-03-22-phase7-telegram-bot-api-integration.md](docs/plans/2026-03-22-phase7-telegram-bot-api-integration.md)
- **Webhook Kickoff 進度**：[docs/plans/2026-03-23-phase7-webhook-processor-kickoff.md](docs/plans/2026-03-23-phase7-webhook-processor-kickoff.md)
- **Anthropic Draft + Studio Auth 進度**：[docs/plans/2026-03-23-phase7-anthropic-draft-generation-and-studio-auth-sync.md](docs/plans/2026-03-23-phase7-anthropic-draft-generation-and-studio-auth-sync.md)
- **Telegram Action Prompt 進度**：[docs/plans/2026-03-23-phase7-telegram-action-prompts-and-callback-tokens.md](docs/plans/2026-03-23-phase7-telegram-action-prompts-and-callback-tokens.md)
- **Image Delivery 進度**：[docs/plans/2026-03-23-phase7-image-delivery-flow.md](docs/plans/2026-03-23-phase7-image-delivery-flow.md)
- **交接文件**：[CLAUDE_CODE_HANDOFF_2026-03-22_PHASE7.md](CLAUDE_CODE_HANDOFF_2026-03-22_PHASE7.md)

## 技術架構

```
├── 前端：Next.js 14 (App Router)
├── CMS：Sanity Studio v3
├── 樣式：Tailwind CSS
├── 資料來源：Sanity + Notion API（含快取）
├── 部署：Vercel
├── 追蹤：GA4 + Google Ads
├── API 文件：OpenAPI 3.0 / Swagger UI (/api-docs)
└── 監控：集中式 Logger
```

## 本地開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 建置
npm run build

# 測試
npm run test
```

## 環境變數

```env
# Sanity
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=
SANITY_API_TOKEN=

# Notion (Dashboard)
NOTION_TOKEN=
```

## 相關連結

- [官網](https://chiangway-travel.com)
- [LINE](https://line.me/R/ti/p/@037nyuwk)
- [Instagram](https://www.instagram.com/chiangway_travel)
- [Facebook](https://www.facebook.com/profile.php?id=61569067776768)

---

*由 Eric 與 [Claude Code](https://claude.ai/claude-code) 協作開發*

<!-- Last build trigger: 2026-03-23 phase 7 image delivery flow -->
