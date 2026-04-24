# 清微旅行 Chiangway Travel

## 專案資訊

- **品牌**: 清微旅行 Chiangway Travel
- **服務**: 清邁親子包車、客製旅遊、中文導遊
- **網站**: https://chiangway-travel.com
- **技術架構**: Next.js 14 + Sanity CMS + Tailwind CSS

## 品牌定位（2026-04 定稿）

- **核心差異化（一個詞）**：「爸媽開的」—— 台灣爸爸 Eric × 泰國媽媽 Min，住在清邁、自己也帶小孩
- **戰略形式**：游擊戰（小池塘裡的大魚）+ 側翼戰（無爭地帶突襲）
- **品類**：清邁親子包車（新興品類，無強勢品牌佔據）
- **強優勢（不可複製）**：跨文化家庭身份 + 在地網絡 + 中文母語，天然稟賦
- **司機 + 導遊專業分工**（非一人包辦）是產品層的差異化

### 統一 Bio（IG / FB / TikTok）
```
爸媽開的清邁親子包車
台灣爸爸 Eric × 泰國媽媽 Min
158+ 組家庭平安暢遊清邁 🚐
LINE 聊聊行程 ↓
```

四行論證鏈：差異化+品類 → 身份證據 → 信任狀 → 低壓力 CTA
完整策略：`docs/plans/2026-04-19-positioning-diagnosis.md`

### 鐵律（所有 SEO / 文案 / 功能決策必看）
- 不做品牌延伸（民宿、票券代訂等）—— 蹺蹺板原則
- 不擴城市（曼谷、普吉、清萊）—— 兵力原則
- 不搶「最便宜」「最豪華」「No.1」—— 排他定律
- 只做中文家庭客群—— 不主打「中英泰文導遊」

## 重要文件

| 文件 | 用途 |
|------|------|
| `docs/prompts/seo-article-prompt.md` | SEO 文章撰寫指令（生成文章前必讀）|
| `docs/plans/2026-01-15-seo-content-strategy.md` | SEO 內容策略與文章清單 |
| `docs/plans/2026-01-13-landing-page-redesign.md` | 網站設計規範 |
| `docs/plans/2026-04-19-positioning-diagnosis.md` | **戰略基石**（顧軍輝定位框架分析報告）|
| `docs/plans/2026-04-20-quote-display-page.md` | `/quote/[slug]` 報價展示頁實作計畫 |
| `docs/plans/2026-03-22-phase7-line-oa-ai-assistant*.md` | Phase 7 LINE OA AI 客服規格（待實作）|

## 內部營運系統現況

- **Sanity Studio `/studio`** — 內容管理 + 內部工具入口
- **報價計算器（正式版）** — 協作者共用，門票原價計算、三階段付款
- **報價展示頁 `/quote/[slug]`** — 已上線。計算器可「產生報價連結」→ LINE 貼給客戶看動態互動報價；`/quote/sample` 是 LINE OA 公開 showcase
- **財務 Dashboard / 記帳** — 僅 owner 可存取
- **知識庫** — Notion 資料庫（餐廳/咖啡/飯店/景點/門票/話術）

## 自訂 Skills

| Skill | 觸發方式 | 用途 |
|-------|----------|------|
| `comprehensive-review` | `/comprehensive-review` | 10 角色全面審查網站（架構、UX、SEO、資安等）|

審查的執行流程、角色定義、SOP、歷史記錄都在 `.claude/skills/comprehensive-review.md` 裡，不重複。

## 工作流程

### 每次 commit / push 後要更新的文件

- `docs/plans/...` — 記錄當次修改項目、新增檔案、commit hash
- `README.md` — Phase 狀態表、`<!-- Last build trigger: YYYY-MM-DD -->` 註解
- `.claude/skills/comprehensive-review.md` — 只在綜合審查後更新歷史記錄

commit → push → 更新文件 → commit + push 文件更新（兩段式，避免功能與文件混在同一個 commit）

### 寫 SEO 文章時

1. 先讀取 `docs/prompts/seo-article-prompt.md`
2. 照著「強制協作流程」執行：先問問題、再寫大綱、最後撰寫全文
3. 文章結尾必須有 LINE CTA

### 審社群貼文 / 影片文案 / 心理學框架

詳見 memory `project_social_content_guide.md`（IG/FB 審稿清單、影片文案協作流程、文案心理學對照表）。開發對話不載入，Eric 開「幫我審貼文」這類話題時再拉出來參考。

### 社群連結

- LINE: https://line.me/R/ti/p/@037nyuwk
- Facebook: https://www.facebook.com/profile.php?id=61569067776768
- Instagram: https://www.instagram.com/chiangway_travel
