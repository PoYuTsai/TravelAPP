# 清微旅行 Chiangway Travel

清邁親子自由行包車服務官方網站 + 內部營運系統

## 專案資訊

- **品牌**：清微旅行 Chiangway Travel
- **網站**：https://chiangway-travel.com
- **服務**：清邁親子包車、客製旅遊、中文導遊
- **品牌核心**：「爸媽開的」清邁親子包車（台灣爸爸 Eric × 泰國媽媽 Min）
- **技術架構**：Next.js 14 + Sanity CMS + Tailwind CSS，部署於 Vercel

## 開發狀態

| Phase | 名稱 | 狀態 |
|-------|------|------|
| Phase 1 | 官網 + Landing Page | ✅ 完成 |
| Phase 2 | SEO 優化 + 部落格 | ✅ 完成 |
| Phase 3 | 內部營運工具（客戶行程表、財務 Dashboard、轉換追蹤）| ✅ 完成 |
| Phase 4 | 客戶體驗優化（行程頁、民宿、包車、About）| ✅ 完成 |
| Phase 5 | 10 角色綜合審查優化（多次迭代到 #10）| ✅ 完成 |
| Phase 6 | 記帳系統 + 知識庫 + 報價計算系統 | ✅ 完成 |
| 品牌 2026-04 | 「爸媽開的」定位全面同步（官網 / Sanity / 評價 / bio）| ✅ 完成 |
| 功能 2026-04 | `/quote/[slug]` 報價展示頁（LINE 動態互動報價）| ✅ 完成 |
| **Phase 7** | **LINE OA AI 客服助理** | 📋 規格完善、待實作 |

詳細歷史見 `git log` 與 `docs/plans/` 下的計畫文件；綜合審查歷次記錄見 `.claude/skills/comprehensive-review.md`。

## 核心功能

### 對外前台
- 響應式 Landing Page + LINE CTA + GA4/Google Ads 轉換追蹤
- 部落格：SEO 分類、分頁、搜尋、精選文章、結構化資料
- 包車 / 民宿 / About Us 頁面
- 歷史案例展示（狀態排序、年份分組、分頁載入）
- 品牌實體訊號集中於 `src/lib/brand-entity.ts`

### 內部營運工具（位於 `/studio`）
- **Sanity Studio** — 內容管理 + 工具入口
- **報價計算器（正式版）** — 智慧行程解析、多飯店房型、門票互斥群組、泰服體驗、三階段付款、超時計算、共享案例同步
- **報價展示頁 `/quote/[slug]`** — 計算器「產生報價連結」→ LINE 貼給客戶看動態互動報價；`/quote/sample` 為 LINE OA 公開 showcase
- **財務 Dashboard / 記帳** — Notion 業務成本串接、40 萬門檻警示，僅 owner 可存取
- **知識庫** — Notion 資料庫（餐廳、咖啡、飯店、景點、門票、話術 共 96 筆）

### 安全 / SEO / A11y 底層
- Studio token-only auth + allowlist
- Signed URL（HMAC-SHA256）保護 itinerary 匯出
- Rate limiting、CORS、CSP、HSTS、XSS 轉義、timingSafeEqual
- 44px 觸控目標、focus trap、鍵盤導航、aria 完整支援
- Canonical URLs、Schema.org（Organization、WebSite、TouristTrip、FAQ、BreadcrumbList）

## Phase 7：LINE OA AI 客服助理（待實作）

將 LINE OA 從「純手動回覆」升級為「AI 輔助 + 人工決策」：

- **目標**：初次回覆時間從 30-60 分鐘降至 5-10 分鐘
- **原則**：AI 準備草稿，Eric 決定是否送出（人機協作，不是全自動）
- **技術**：LINE Messaging API + Claude API + Telegram Bot + Sanity + Vercel KV
- **分階段**：
  - 7.1 Webhook + 需求抽取 + TG Topics
  - 7.2 草稿生成 + 一鍵回覆 + 圖片發送
  - 7.3 語音輸入 + 週報優化 + 內部派單
- **詳細規格**：`docs/plans/2026-03-22-phase7-line-oa-ai-assistant*.md`

## 技術架構

```
├── 前端：Next.js 14 (App Router)
├── CMS：Sanity Studio v3（含自訂 Pricing 工具）
├── 樣式：Tailwind CSS
├── 資料來源：Sanity + Notion API（含快取）
├── 部署：Vercel
├── 追蹤：GA4 + Google Tag Manager + Google Ads
├── API 文件：OpenAPI 3.0 / Swagger UI (/api-docs)
└── 監控：集中式 Logger
```

## 本地開發

```bash
npm install      # 安裝依賴
npm run dev      # 啟動開發伺服器
npm run build    # 建置
npm run test     # 測試
npm run lint     # Lint
```

## 環境變數

```env
# Sanity
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=
SANITY_API_TOKEN=

# Notion (Dashboard / 記帳 / 知識庫)
NOTION_TOKEN=

# 其他機密：REVALIDATE_SECRET、SIGNED_URL_SECRET 等見 .env.example
```

## 相關連結

- [官網](https://chiangway-travel.com)
- [LINE](https://line.me/R/ti/p/@037nyuwk)
- [Instagram](https://www.instagram.com/chiangway_travel)
- [Facebook](https://www.facebook.com/profile.php?id=61569067776768)

---

*由 Eric 與 [Claude Code](https://claude.ai/claude-code) 協作開發*

<!-- Last build trigger: 2026-04-24 README / CLAUDE.md cleanup -->
