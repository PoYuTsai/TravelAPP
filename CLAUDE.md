# 清微旅行 Chiangway Travel

## 專案資訊

- **品牌**: 清微旅行 Chiangway Travel
- **服務**: 清邁親子包車、客製旅遊、中文導遊
- **網站**: https://chiangway-travel.com
- **技術架構**: Next.js 14 + Sanity CMS + Tailwind CSS

## 品牌定位

- 台灣爸爸 (Eric) + 泰國媽媽 (Min)，住在清邁的真實家庭
- 專為親子家庭設計的包車服務
- 司機 + 導遊專業分工（非一人包辦）

## 重要文件

| 文件 | 用途 |
|------|------|
| `docs/prompts/seo-article-prompt.md` | SEO 文章撰寫指令（生成文章前必讀）|
| `docs/plans/2026-01-15-seo-content-strategy.md` | SEO 內容策略與文章清單 |
| `docs/plans/2026-01-13-landing-page-redesign.md` | 網站設計規範 |

## 自訂 Skills

| Skill | 觸發方式 | 用途 |
|-------|----------|------|
| `comprehensive-review` | `/comprehensive-review` | 10 角色全面審查網站（架構、UX、SEO、資安等）|

### 全面審查 Skill 使用方式

```
觸發: /comprehensive-review 或 "請執行全面性審查"

此 Skill 會:
1. 從 10 個專業角度審查網站
2. 產出結構化報告（含嚴重程度）
3. 自動更新歷史記錄
4. 詢問你要優化哪些項目
```

## 工作流程

### Commit/Push 後自動更新文件

每次完成 commit → push 後，**必須**更新以下文件：

| 文件 | 更新時機 | 內容 |
|------|----------|------|
| `docs/plans/...` | 每次 | 記錄當次修改項目、新增檔案、commit hash |
| `README.md` | 每次 | 更新開發狀態表格、Phase 說明、build trigger 日期 |
| `.claude/skills/comprehensive-review.md` | 審查後 | 更新歷史審查記錄 |

**標準流程**：
```
1. 修改代碼
2. git add && commit (功能)
3. git push
4. 更新 docs/plans + README.md
5. git add && commit (文件更新)
6. git push
```

**README.md 更新重點**：
- Phase 狀態表格（新增/更新狀態）
- Phase 說明區塊（重點功能）
- `<!-- Last build trigger: YYYY-MM-DD Phase X.X -->` 註解

### 寫 SEO 文章時

1. 先讀取 `docs/prompts/seo-article-prompt.md`
2. 照著「強制協作流程」執行：先問問題、再寫大綱、最後撰寫全文
3. 文章結尾必須有 LINE CTA

### 社群貼文審稿（IG/FB）

Eric 會請 Claude 審稿社群貼文，審稿時務必檢查：

**內容**
- 是否呼應品牌定位（台灣爸爸 × 泰國媽媽、親子家庭、司機導遊分工）
- 一篇貼文只傳達一個核心概念

**格式與排版**
- 乾淨簡潔，易於快速掃讀
- 服務特點最多 3-4 點（不要列太多）
- Hashtag 固定 3 個：`#清微旅行 #清邁親子包車 #親子自由行`
- CTA 輕輕帶，不硬推（bio 已有 LINE，不用每篇重複）

**常見問題**
- ❌ 「中英泰文導遊」→ ✅ 「中文導遊」（聚焦目標客群）
- ❌ 太多 emoji → ✅ 適量點綴
- ❌ 長段落 → ✅ 分段、善用換行
- ❌ 「留言 X 拿資訊」→ ✅ 不用，我們是在地家庭不是行銷帳號
- ❌ 刻意隱藏資訊製造懸念 → ✅ 大方分享更有溫度

### IG 影片文案協作流程

```
1. Eric 把影片丟給 Gemini，請它描述內容並產初版文案
2. Eric 把 Gemini 的回覆貼給 Claude
3. Claude 根據品牌定位優化：
   - 精簡長度（快速掃讀）
   - 檢查每句話的存在目的
   - 確保自然分享的溫度（不像業配）
   - 套用固定 hashtag
4. Eric 確認細節（翻譯、數字等）
5. 定稿發布
```

**文案結構參考**
```
[Hook - 第一行抓注意力]

[內容 - 2-3 句重點]
（輕描淡寫帶入親子元素）

📍 [資訊 - 店名/地點]

—

🚐 清微旅行｜清邁親子包車
💬 想排行程？歡迎私訊

#清微旅行 #清邁親子包車 #親子自由行
```

### 文案心理學設計原則

每句話都有存在目的，審稿時對照檢查：

| 元素 | 心理學原理 | 品牌呼應 |
|------|-----------|---------|
| 「泰國老婆的...」| 好奇心缺口 | 泰國媽媽 Min 的在地資源 |
| 「只剩 X 間」| 稀缺性原則 | 我們帶你去的不是網紅店 |
| 「離我們家最近，常常來」| 社會認同 + 真實感 | 在地家庭的日常生活 |
| 「Min 說：...」| 實用價值 + 權威性 | 泰國媽媽的在地知識 |
| 「（我們女兒...）」| 情感連結（括號 = 輕描淡寫）| 親子家庭，我們也是爸媽 |
| 📍 店名地點 | 資訊價值 + 大方分享 | 朋友分享，不是業者推銷 |
| 「想排行程？歡迎私訊」| 低壓力 CTA | 有溫度的邀請 |

**心理路徑**
```
好奇 → 稀缺 → 信任 → 價值 → 情感 → 資訊 → 輕邀請
```

**核心邏輯**：價值先行，推銷最後（80% 分享生活，20% 帶到服務）

### 社群連結

- LINE: https://line.me/R/ti/p/@037nyuwk
- Facebook: https://www.facebook.com/profile.php?id=61569067776768
- Instagram: https://www.instagram.com/chiangway_travel
