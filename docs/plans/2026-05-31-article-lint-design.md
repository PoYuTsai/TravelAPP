---
status: implemented
author: Eric + Claude (brainstorm)
date: 2026-05-31
topic: SEO 文章自動檢核腳本 article-lint
---

# article-lint 設計文件

> **實作完成 2026-05-31（commit 6c0e8de）**：`scripts/article-lint.mjs`（純函式 export）
> + `scripts/article-lint.test.mjs`（34 個 vitest 單元測試，TDD）+ npm script `lint:article`。
> SEO/AEO 分桶採 §7 旁的預設分法（Eric 拍板）：SEO＝標題/描述/關鍵字/封面+alt/字數；
> AEO＝FAQ/問號≥8/提示框/螢光≥3/內文圖≥3。執行：`npm run lint:article <slug>`。

> **一句話**：把 `seo-article-prompt.md` 第五部分檢核表 + 禁止事項，變成一支「給 slug 就吐 PASS/FAIL + ⭐評級」的機器閘門。發布前最後一道關，不能被模型嘴硬騙過。
>
> **背景**：來自「AI agent 27 小時 / /goal」影片研究的落地結論——Eric 的 reward 是品味與在地知識（無法自動化），但「機械閘門」可以。這支就是那個閘門。研究全文脈絡見對話；此文件可被全新 session 冷讀直接實作。

## 1. 目標與非目標

**目標**：發布前對 Sanity 上的 `post` 文件跑一次客觀檢核，FAIL 就擋、WARN 就提醒，最後印出對齊現有「⭐ A/B/C/D」體系的評級。

**非目標（YAGNI，別做）**：
- ❌ 不做 LLM 自評（那是 evaluator markdown 的事，可被 reward-hack，這支只做客觀規則）
- ❌ 不做品牌對齊/經驗真實性判斷（那是 Eric 人工把關，模型會放行 generic 廢話）
- ❌ 不自動修文（只報告，不改 Sanity）

## 2. 輸入與執行方式

- **吃 Sanity 文件**（不是 markdown 草稿）。理由：第五部分一半是 Sanity 欄位（SEO Title/Desc/Keywords/封面），草稿階段驗不到，而那半最影響排名、最常漏。
- 執行：`node scripts/article-lint.mjs <slug>`，建議再加 npm script `"lint:article": "node scripts/article-lint.mjs"`。
- 檔名 **`.mjs`**（對齊現有 40 支腳本慣例，不是 `.ts`）。
- Sanity client 照現有 `scripts/list-posts.mjs` 寫法：
  ```js
  import { createClient } from '@sanity/client'
  const client = createClient({
    projectId: 'xefjjue7', dataset: 'production',
    apiVersion: '2024-01-01', useCdn: false,
  })
  ```
- GROQ 抓需要的欄位：
  ```groq
  *[_type == "post" && slug.current == $slug][0]{
    title, "slug": slug.current, excerpt,
    "mainImage": mainImage{asset, alt},
    seoTitle, seoDescription, seoKeywords,
    body
  }
  ```

## 3. post schema 對照（實作時的欄位真相）

| 檢核需要 | Sanity 欄位 | 備註 |
|----------|-------------|------|
| SEO Title | `seoTitle`（留空 → fallback `title`） | 有效標題 = `seoTitle \|\| title`，schema 限 max 60 |
| SEO Description | `seoDescription`（留空 → fallback `excerpt`） | 有效描述 = `seoDescription \|\| excerpt`；**空才 FAIL**，長度只 WARN，甜蜜區 60-90 字（CJK 尺度，見 §5 註） |
| Keywords | `seoKeywords`（string 陣列） | 算長度 |
| 封面 | `mainImage` + `mainImage.alt` | 兩者都要 |
| 字數 / FAQ / 問號 / 禁用詞 | `body`（Portable Text 陣列） | 見 §4 抽取規則 |
| 螢光標記 | body block 內 mark = `'highlight'` | 算 span 數 |
| 提示框 | body member `_type == 'tipBox'` | 算數量 |
| 內文圖 | body member `_type == 'image'`（各自 `.alt`） | 算數量 |
| H2/H3 層級 | block `style` ∈ `h2/h3/h4` | FAQ 用 H2 偵測 |

## 4. body（Portable Text）文字抽取規則

實作要寫一個 `extractText(body)`：
- 取 `_type == 'block'` 的 children spans 的 `.text`（涵蓋 normal/h2/h3/h4/blockquote）
- 加上 `tipBox.content`、`tableBlock.rows[].cells[]`、`ctaBlock` 不算內容字數（CTA 是系統件）
- 圖片/影片只算「數量」，文字不計
- **字數**：中文用「去空白後字元數」較準（`[...text.replace(/\s/g,'')].length`），不是空白切詞
- **問號**：`(text.match(/[？?]/g) || []).length`
- **FAQ 段落**：存在某個 `style==='h2'` 的 block，其文字含「常見問題」或「FAQ」

## 5. 檢核項與 FAIL / WARN 切分（Eric 2026-05-31 拍板）

### 🔴 FAIL（擋發布）
| 檢查 | 條件 |
|------|------|
| 禁用詞命中 | 見 §6 FAIL 清單，命中任一 |
| 字數 | < 1500 |
| FAQ 段落 | 找不到「常見問題/FAQ」H2 |
| 問號數 | < 5 |
| SEO Title | 有效標題缺、或 > 60 字 |
| SEO Description | **有效描述完全缺**（seoDescription 與 excerpt 都空）。長度不再 FAIL — 見下方 WARN 與註 |
| Keywords | `seoKeywords` < 5 |
| 封面圖 | `mainImage` 缺、或 `mainImage.alt` 缺 |

### 🟡 WARN（提醒不擋）
| 檢查 | 條件 |
|------|------|
| SEO Description 長度 | < 60 字（略短）或 > 90 字（偏長、恐被 Google 截斷）|
| 字數 | 1500-1999（建議 2000+） |
| 問號數 | 5-7（建議 8+） |
| 螢光標記 | < 3 |
| 提示框 | < 1 |
| 內文圖 | < 3（或某張缺 alt） |
| H2/H3 層級 | 出現跳級（如 H2 後直接 H4） |
| 禁用「句型」命中 | 見 §6 WARN patterns |

> **註：SEO 描述長度為何用 60-90（CJK 尺度）而非 120-160（2026-05-31 校正）**
> 初版照英文 SEO 慣例設 120-160（≈155 個拉丁字母）並當 FAIL。全站盤點（`scripts/article-lint-all.mjs`）一跑，7 篇 A 級文章 **100% 在這條 FAIL**——而它們的描述其實都寫得很好（問句開頭＋關鍵字＋品牌口吻），落在 59-73 字。
> 根因：`descLen` 數的是**中文字元**，但 Google 是按**像素寬度**截斷（桌機 ~920px）。中文字寬約拉丁字母 2 倍，**約 70-80 個中文字就填滿整條摘要**。把描述補到 120-160 個中文字反而會在 ~70-80 字處被截斷，後半永遠不顯示——SEO 更差。
> 結論：①長度改 WARN（甜蜜區 60-90），唯「描述完全空」才 FAIL；②一道讓 100% A 級文章都 FAIL 的閘門是雜訊、不是把關。日後若拿到中文 SERP 實測截斷數據，再微調 60/90 這兩條線即可（改 `evaluate()` 的描述 WARN 與 SEO 計分項）。

## 6. 禁用詞 / 句型清單（會持續長大 → 做成可維護 config）

實作成**檔案頂部的 config 物件**（`const BANNED = { fail: [...], warn: [...], warnPatterns: [/.../] }`），方便日後加詞，不要散在邏輯裡。

### FAIL — 固定詞，近乎零誤判的 AI 味
```
總而言之、綜上所述、總的來說、綜合以上、不難看出、眾所周知、
最專業、最優質、最頂級、業界第一、第一品牌、
在這篇文章中、本文將、我們將為您介紹
```

### WARN — 高誤判風險的詞（正常句也會用，提醒即可）
```
最佳、最便宜、最豪華、No.1、最好的
```
> 註：「最便宜/最豪華/No.1」同時是 CLAUDE.md 品牌鐵律禁區，但因為會誤殺正常句（「最適合小小孩」），先降 WARN，靠人看一眼。

### WARN — AI 味「句型」（regex，Eric：「還有很多」→ 持續補）
```
不是…而是…        /不是.{1,20}[，,]?而是/
與其說…不如說…     /與其說.{1,20}不如說/
不僅僅是…更是…     /不僅僅?是.{1,20}更是/
在這個…的時代      /在這個.{1,12}的時代/
讓我們一起…        /讓我們一起/
```
> 句型一律 WARN（中文正常也會用「不是 A 而是 B」），命中只提示 Eric 複查，不擋。Eric 會陸續補新句型進這個陣列。

## 7. 輸出格式

對齊現有評級（第五部分）：`高價值 = SEO ≥ 4/5 + AEO ≥ 3/5`、`⭐ A 9-10 / B 7-8 / C 5-6 / D <5`。

```
📋 article-lint: <slug>
────────────────────────
🔴 FAIL (2)
  ✗ 禁用詞「總而言之」出現在內文（第 N 處）
  ✗ SEO Description 缺（且 excerpt 也空）
🟡 WARN (1)
  ⚠ 螢光標記只有 1 處（建議 ≥3）
────────────────────────
SEO 檢核 3/5 ｜ AEO 檢核 4/5
評級：⭐⭐⭐ C（5-6 分）
結果：FAIL — 修正上面 2 項紅燈再發布
```

- 有任何 FAIL → `process.exit(1)`（方便日後接 CI / pre-publish hook）
- 全綠 → `exit(0)`

## 8. 測試（vitest，專案已有）

把純函式（`extractText`、`countWords`、`countQuestions`、`scanBanned`、`evaluate`）拆出來放 `scripts/article-lint.mjs` export，測試放 `scripts/article-lint.test.mjs`：
- 禁用詞 FAIL：含「總而言之」的 body → 命中
- 誤判防護：含「最適合小小孩」→ 不命中 FAIL（「最佳」在 WARN 才算）
- 句型 WARN：「不是貴，而是值得」→ 命中 warnPattern
- 字數邊界：1499 → FAIL、1500 → pass、1999 → WARN
- 描述長度（CJK 尺度，WARN 不擋）：59 略短 WARN / 60 / 90 / 91 偏長 WARN；空描述才 FAIL
- FAQ 偵測：有/無 H2「常見問題」
- 評級計算：SEO 4/5 + AEO 3/5 → 高價值門檻

> Sanity 抓取那層不寫單元測試（純 IO），用一支真實 slug 手動 smoke test 即可。

## 9. 實作順序（給執行 session）

1. 寫 `extractText` + 純檢核函式 + export → 先寫測試（TDD）
2. config（§6 清單）放檔頂
3. `evaluate(post)` 組裝 FAIL/WARN/評級
4. 接 Sanity fetch + CLI arg + 輸出/exit code
5. 加 npm script `lint:article`
6. 真實 slug smoke test（如 `night-safari` 那篇）
7. 跑 `npm run test:run` 全綠後 commit

## 10. 未來延伸（先不做，記著）
- 接 pre-publish：上傳腳本成功後自動跑這支
- `preview-evaluator.md`（設計 5 維 rubric）是另一條線，不在此檔範圍
- WARN 句型清單長期維護——Eric 每抓到新 AI 味句型就補進 §6
