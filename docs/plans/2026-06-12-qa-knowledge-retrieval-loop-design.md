# 檢索閉環刀 — 沉澱 QA 回流 system prompt 設計

> 2026-06-12 定稿。前置：刀A（輸入理解）＋刀3（distilled-qa-writer）已落地。
> 目標：刀A 沉澱進 Notion「沉澱問答 DB」的**已批准** QA，要回流到
> partner-group responder 的 system prompt，讓 bot 答得出群裡沉澱過的知識。
> 驗收場景（真實）：Chun 問「兩大兩小小車會不會擠」→ bot 答案含「會擠、建議大車」方向。

## §0 範圍與鐵律

- 只動 TEXT 生成路徑：知識注入發生在 `anthropic-responder.ts` 組 system prompt 時。
  不碰 router / 送出閘 / OA 禁回規則。
- Fail-open：知識是 enhancement，不是依賴。任何失敗 ⇒ 退回現行 prompt，
  行為與本刀落地前 **byte-identical**。對照：RAG 草稿路徑（`cached-rag-source.ts`）
  是 fail-closed，因為那條路徑的產出**就是**檢索結果。
- 閘 default off：不開閘 ⇒ source 不建構 ⇒ 零行為差異、零 Notion 讀。
- Leak guard 同 `distilled-qa-writer.ts`：SDK error 收斂 fixed code，
  token / db id / notion url 永不入 log。

## §1 架構（四個觸點）

### 1. `qa-knowledge-source.ts`（新檔，partner-group/）

Mirror `distilled-qa-writer.ts` 紀律、方向相反（讀不是寫）：

- 注入式 SDK 最小面：`databases.retrieve`（解析 `data_sources[0]`，lazy cache）
  ＋ data source query（filter `狀態 select = 已批准`）。
- 撈已批准 QA → 格式化為知識區塊純文字：每條「Q：…／A：…」。
- **Cap 30 條**（page_size 控制 ＋ 防衛性截斷）；超過 cap 截斷照用，
  log `qa_knowledge_truncated`。
- 0 條已批准 ⇒ 回 `null`（不注入空區塊）。
- Notion 錯誤 / 超時 ⇒ 回 `null`，log `qa_knowledge_unavailable`。
- 介面：`QaKnowledgeSource = () => Promise<string | null>` — 與當則訊息無關
  （全量注入，不做 per-message 檢索；30 條量級下全量比相似度檢索簡單且夠用）。

### 2. `system-prompt.ts`

`buildPartnerGroupSystemPrompt` 加 optional 知識參數：

- 有知識 ⇒ 區塊接在 frozen persona 尾端：
  `【清微旅行沉澱問答｜以下為過往已確認的問答知識，優先依此回答】` ＋ QA 條目。
- 與引用脈絡（quote-to-bot）並存時：知識在前、引用在後（引用語意最貼近當則訊息，留最尾）。
- `null` / 未傳 ⇒ 輸出與現行 **byte-identical**（迴歸鎖測試）。

### 3. `anthropic-responder.ts`

- deps 加 optional `knowledgeSource?: QaKnowledgeSource`。
- respond 流程：budget gate 之後、組 prompt 之前 `await knowledgeSource()`，
  外層 try-catch fail-open（source throw ⇒ 當 null）。
- 未注入 ⇒ 不呼叫、prompt 不變 — 既有測試全綠即證明。

### 4. config / factory 接線

- 新 `resolveQaKnowledgeReadConfig`（mirror `knowledge-write-config.ts`）：
  三件齊才 enabled — `QA_KNOWLEDGE_READ_ENABLED='true'` ＋ `NOTION_KNOWLEDGE_TOKEN`
  ＋ `NOTION_DISTILLED_QA_DB`。任一缺 ⇒ `enabled:false` ＋ fixed reason。
- 真 SDK Client 只在 composition root 構建（同刀3 慣例）；factory 永不讀 env。
- 閘關 ⇒ `knowledgeSource` 不接線 ⇒ responder 拿到 `undefined`，行為不變。

## §2 快取、成本、失敗路徑、測試與驗收

### 快取

TTL **10 分鐘**＋single-flight。重用 `createCachedRagAnswerSource` 的泛型核心；
若它跟 `respondInput` 耦合太深，就抽一個 `cached-loader.ts` 小泛型（TTL＋
single-flight＋注入 clock），兩邊共用。含義：CC 寫新知識進 Notion 後最慢
10 分鐘生效；群裡訊息頻率低，每 10 分鐘最多一次 Notion query，成本可忽略。

注意快取失敗語意差異：rag 路徑 fail-closed（error 上拋、不快取失敗）；
本刀 fail-open（error 收斂成 null）— null 結果**不快取**，下一則訊息重試。

### 成本影響

30 條 QA cap ≈ 多 2–4k input tokens/則。以 Haiku/Sonnet 計一則多 $0.001–0.01，
日上限閘（DAILY_COST_CAP）照管，不需新 cap。

### 失敗路徑（全 fail-open）

| 情況 | 行為 | log code |
|------|------|----------|
| 閘關 / token 缺 | source 不建構，responder 拿到 undefined，行為 byte-identical | — |
| Notion 錯誤/超時 | 回 null，原 prompt 照常答 | `qa_knowledge_unavailable` |
| 0 條已批准 | 回 null（不注入空區塊） | — |
| 超過 cap | 截斷照用 | `qa_knowledge_truncated` |

### 測試（TDD，沿用既有模式）

- `qa-knowledge-source.test.ts` — fake SDK：撈已批准、過濾非批准、cap 截斷、
  錯誤→null、TTL 快取命中/過期、single-flight。
- `system-prompt.test.ts` 加 — 有知識→區塊在尾端、null→prompt 與現行
  byte-identical（迴歸鎖）。
- `anthropic-responder.test.ts` 加 — knowledgeSource 注入後 system 含知識；
  source throw 不影響回覆。
- factory/config — 閘關→不接線。

### 驗收

CLI 黑箱（inline env 帶閘＋key）問「兩大兩小小車會不會擠」→ 答案含
「會擠、建議大車」方向；之後真群 Chun 場景重測。
