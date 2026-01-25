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

### 社群連結

- LINE: https://line.me/R/ti/p/@037nyuwk
- Facebook: https://www.facebook.com/profile.php?id=61569067776768
- Instagram: https://www.instagram.com/chiangway_travel
