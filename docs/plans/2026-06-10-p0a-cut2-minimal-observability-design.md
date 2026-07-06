# P0-A 刀 2 — 最小 Observability（structured log + request ID + Anthropic 每日成本上限）

> 狀態：IMPLEMENTED（2026-06-10，feature commit `4bda558`；§Checkpoint 見文末）
> 前置：P0-A 刀 1「真 Notion API adapter」查核後確認**已於 M3.2 完成**（`notion-rag-client.ts` 真 v5 adapter、
> `install-default-partner-rag.ts` 真 SDK 組合根、`webhook-runtime.ts:370` lazy install 已接、
> M3.4a 真 masked smoke 索引 92 筆、M3.6b tracer 證「翻閘即達」）。體檢報告「Notion client 還是 mock」
> 為過時敘述（被 fixture-first 檔頭舊註解誤導）。本刀直接做清單第 2 項。

## 目標

開 partner gate 前的硬前置：任何一則訊息出事時能用 requestId 串出完整軌跡；LLM 花費有每日硬上限，
打爆就煞車退 deterministic 路徑，絕不無上限燒錢。

## 範圍（Eric 定案）

- 成本上限：**KV 計量、雙 fail-closed**（超限不打 LLM；KV 未設定/壞掉也不打；cap env 未設＝disabled＝不打）。
- Log：**主鏈關鍵點 + 收編 webhook 鏈上既有 console.\***；CLI / smoke / module-load 期的點不動。
- 競態：check 與 record 非原子，v1 接受（流量個位數、最壞超限一次 Haiku 呼叫 ≈ $0.01 級；
  上限是煞車不是發票）。`DailyCostCap` 為注入式介面，未來流量上升只換實作不動呼叫點。

## 新模組 `src/lib/line-agent/observability/`

### `structured-log.ts`

- `createAgentLogger({ requestId, sink? })` → `log(event, fields?)`，輸出單行 JSON
  `{ ts, requestId, event, ...fields }`；`sink` 預設 `console.log`，測試注入。
- **masked by construction**：fields 是閉集型別（model/tokens/costUsd/reason code/channel/path 等
  列舉欄位），結構上放不進 token、db id、訊息原文、PII。
- requestId 由 webhook 收件時 `crypto.randomUUID()` 生成，經 RouterInput 新增 optional 欄位下傳（向後相容）。

五類事件（closed union `AgentLogEvent`）：

| event | fields |
|---|---|
| `webhook_received` | channel(oa/partner_group)、messageKind、botDirected |
| `route_decision` | path（rag_composer/quoted_draft/base/no_reply）、gate 狀態字樣（enabled/disabled，不印 env 值） |
| `llm_call` | model、latencyMs、inputTokens、outputTokens、costUsd、outcome(ok/degraded)、degradedReason |
| `cost_cap` | checkOutcome、當日累計 micro-USD |
| `reply_sent` / `reply_skipped` | sendOutcome、reason code |

### `daily-cost-cap.ts`

- `createDailyCostCap({ kv, env, now? })` → `{ checkBudget(), recordSpend(usd) }`；
  `checkBudget()` 回 `ok | over_cap | kv_unavailable | disabled`。
- KV key `line-agent:llm-cost:YYYY-MM-DD`，**UTC+7（曼谷）日切**，TTL 48h；
  以 **micro-USD 整數** `INCRBY` 累計（避免浮點漂移）。
- `KvClient` 介面新增一個 primitive `incrByWithTtl`（Upstash `INCRBY` + `EXPIRE NX`；MemoryStore 同步補）。
- cap 來源 env `AI_AGENT_DAILY_COST_CAP_USD`；未設或非法 → `disabled` → 不打 LLM
  （與 gate 文化一致：要開 LLM 必須明示預算）。

### 價目表與估算

- `MODEL_PRICING`（USD/MTok）code 常數，只列 agent 用的模型：haiku-4-5（in $1/out $5）、
  sonnet-4-6（in $3/out $15）。**未知模型用表中最貴費率**（寧高估）。JSDoc 註明換模型必同步更新。
- `estimateCostUsd(model, inputTokens, outputTokens)` 純函式。response 缺 `usage` →
  以 `MAX_TOKENS=1024` output + 保守 input 估值記帳並 log `usage_missing`。

## 接點

`anthropic-responder.ts`（唯一 production LLM 呼叫點）：

1. `respond()` 組 prompt 前 `checkBudget()`，非 `ok` → 既有 `degraded(model, reason)` 路徑，
   reason ∈ `cost_cap_exceeded | cost_cap_disabled | cost_cap_kv_unavailable`。
2. 成功 response 讀 `usage.input_tokens/output_tokens` → `estimateCostUsd` → `recordSpend()`。
3. `recordSpend` 失敗：回覆照常送出（不丟掉已付費的回覆），log `cost_record_failed`。

refine tier 未來接 production 時共用同一 cap 實例；本刀只接這一點。

## 失敗模式矩陣（全部有測）

| 情境 | 行為 |
|---|---|
| 額度內 | 照打，事後 recordSpend |
| 超上限 | 不打，degraded `cost_cap_exceeded` |
| cap env 未設/非法 | 不打，`cost_cap_disabled` |
| `AGENT_KV_URL` 缺 | 不打，`cost_cap_kv_unavailable` |
| KV read/incr throw | 不打，同上；log 只記 code 不記 raw error |
| recordSpend 失敗 | 回覆照送，log `cost_record_failed` |

## 收編範圍

改走 logger：`webhook-runtime.ts` 3 處、`anthropic-responder.ts` 4 處、`rag-draft-surfacing.ts` 1 處。
不動：`ensure-partner-rag-installed.ts`（已 code-only、有注入 seam）、`responder-factory.ts`（module-load 期無 requestId）。

## 測試計畫（TDD）

- logger 純函式：JSON shape、閉集欄位、sink 注入。
- cost-cap：失敗矩陣 6 條 + UTC+7 日切 + micro-USD 取整。
- anthropic-responder 整合：超限不發 transport、usage→recordSpend、record 失敗不丟回覆。
- webhook e2e 一條：同一則訊息多筆 log 共享同一 requestId。
- 反洩漏：含 token/PII 假輸入跑全鏈，斷言 sink 每行 JSON 無禁字。

## 硬邊界

不翻任何 gate、不接 LINE live、不寫 Sanity、log 永不含訊息原文/PII/token/db id/url。

## Checkpoint（2026-06-10，feature `4bda558`）

照設計落地，含實作期小偏離（皆已測試鎖定）：

- **事件 union 加第 7 個 `store_write_failed`**：bot-msg bookkeeping 失敗原走
  console.error 帶 err.message，收編成 code-only（`bot_msg_record_failed`）。
- **`reply_skipped` 全覆蓋**：每則訊息的 trace 必終結於 `reply_sent` 或
  `reply_skipped`（OA＝`not_reply_candidate`、重複 claim＝`duplicate_claim`、
  無 token＝`missing_reply_token`、gate 未過＝`send_gate`）。
- **dispatcher `route_decision` 帶 `ragDraftGate` enabled/disabled** —— 把 M3.6b
  發現的「gate-off 靜默落回 base」觀察缺口（原 option C）順手關掉。
- **rag source 失敗收編**：`createRagPartnerGroupResponder` catch 不再印 raw
  message（可能含 token/notion url），改 `route_decision` + `partner_rag_source_failed`。
- **`setDefaultAgentLogSink`**：structured-log 的測試 seam（深鏈 logger 無 sink 注入點時用），production 不呼叫。
- **舊測試遷約**：webhook-runtime.test 5 個 console-spy 斷言改為 structured log
  斷言；§6.6 responder purity allowed keys 加 `log`（write-only telemetry，非 send capability）。
- **驗證**：line-agent **1112/1112** 綠（+34）；改動 .ts tsc clean
  （`partner-rag-draft-surfacing.test.ts` 2 錯為既有，clean stash 重現證明）。

**未做（刻意）**：refine tier 接 production cap（接點留好，等 refine 進 production 同刀做）、
原子預扣（v1 接受 check/record 競態，升級條件寫在 daily-cost-cap.ts JSDoc）、
`scanRefinePromptLeak` 進 production path（P0-A 刀 3）、開 partner gate（P0-A 刀 4，
需 Eric 拍板 + preview 設 `AI_AGENT_DAILY_COST_CAP_USD`）。
