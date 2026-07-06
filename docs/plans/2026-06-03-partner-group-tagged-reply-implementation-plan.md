# Partner-Group Tagged Reply — Implementation Plan (第一刀)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 夥伴群裡 tag bot 後，bot 以 LINE **reply**（非 push）回同一則訊息，內容為 text-only 模型回覆；其餘平面（客人 OA、dev、quote write）行為完全不變。

**Architecture:** 在 `webhook-runtime.ts` 的 `defaultEventHandler` 內接上一道**窄 send gate**：保留 `routeCommand()` 回傳的 `RouterDecision`，當且僅當命中 reply gate 時，透過注入式 reply client seam 呼叫既有 `replyMessage()`。`PartnerGroupResponder` 由既有 factory/seam 提供，預設 stub。Responder 仍純產文字、不送 LINE；送出唯一發生在 webhook send gate。

**Tech Stack:** Next.js 14 App Router、TypeScript、既有 LINE Messaging REST client（`message-client.ts`）、Vitest（既有測試風格：注入式 seam + fake transport，零真 key、零真 API）。

---

## 0. Scope

### In scope（這一刀）
1. partner group 裡 tag bot（`mentionsBot === true`）後，bot 用 LINE reply 回同一則訊息。
2. **只**支援 text-only responder（`handlerResult.outboundText`）。
3. 使用**既有** `PartnerGroupResponder` seam（`responder.ts`）/ factory（`responder-factory.ts`）/ config selector（`responder-config.ts`）/ adapter（`anthropic-responder.ts`）。
4. mode 預設 **stub**；有 key 也不自動開 anthropic。

### Out of scope（明標下一階段，本刀不做）
- ❌ web search / OCR / Notion RAG / 長行程或報價 review / quote formal write（皆 deferred gate；見 `2026-06-03-partner-group-responder-model-adapter-design.md` §0）。
- ❌ **quote-to-bot message tracking**（quote/reply 到 bot-authored 訊息即視為對 bot 說話）→ **下一階段**。本刀 reply gate 只認 `mentionsBot === true`，不認 `quotedRef`-to-bot。
- ❌ **scheduled reminder push**（cron / CUA 掃描產生的提醒推播）→ **下一階段**。
- ❌ push 對外、主動貼群、@人（仍走既有 `send` 權限門，本刀不碰）。

---

## 1. 現況（已 grep 驗證，非猜測）

| 元件 | 現況 | 本刀是否動 |
|---|---|---|
| `routeCommand()` | partner group + tag → 回 `{ action:'respond', source, handlerResult, intent }`（`router.ts:223-257`） | 不動 |
| `handlerResult.outboundText` | responder `result.text` 已塞入（`handlers.ts:128`） | 不動 |
| `PartnerGroupResponder` seam / stub | `responder.ts`：`stubPartnerGroupResponder`、`STUB_PARTNER_GROUP_REPLY` 已存在 | 不動 |
| factory / config / adapter | `responder-factory.ts`、`responder-config.ts`（`getPartnerResponderConfig`，never throws）、`anthropic-responder.ts` 已存在 | 不動 |
| `replyMessage()` | `message-client.ts:114`：`replyMessage(replyToken, messages, accessToken, fetchFn?)`；非 2xx 丟 `LineApiError`；reply token 單次、~30s 過期 | 不動（只呼叫） |
| `NormalizedLineEvent.replyToken` | **不存在**（normalizer 未捕捉） | **要加** |
| `webhook-runtime.defaultEventHandler` | `routeCommand(...)` 回傳被**丟棄**；**未**注入 `partnerGroupResponder`；無 send | **要改** |
| `webhook-runtime` responder seam | **不存在**（無 `getPartnerGroupResponder/set`） | **要加** |
| `webhook-runtime` reply client seam | **不存在** | **要加** |
| route | `src/app/api/line/webhook/route.ts`：await handler 後回 200 | 不動（send 留在 handler 內，route 維持薄） |

設計依據：`2026-06-03-partner-group-reply-gate-billing-design.md` §3/§4/§5/§6（reply gate、runtime shape、event shape、error handling）。

---

## 2. 需要修改 / 新增的檔案

**修改：**
- `src/lib/line-agent/line/event-normalizer.ts` — `NormalizedLineEvent` 加 `replyToken?: string`；message 事件捕捉 `raw.replyToken`（OA 事件也捕捉，但**不**改 `mentionsBot:false`、**不**寫入 case storage）。
- `src/lib/line-agent/line/webhook-runtime.ts` — 加 `getPartnerGroupResponder/setPartnerGroupResponder`（lazy default = `createPartnerGroupResponder({ models: getPartnerResponderConfig(), transport: fetch })`）；加 reply client seam（`getReplyClient/setReplyClient`，default 綁 `LINE_CHANNEL_ACCESS_TOKEN` + 真 `replyMessage`）；改寫 `defaultEventHandler` 保留 `RouterDecision` + 接 send gate。

**新增：**
- `src/lib/line-agent/line/partner-reply-gate.ts` — 純函數 `shouldReplyToPartnerGroup(event, decision): boolean`（§3 條件），無 I/O、可單測。
- 對應 `__tests__/`：`partner-reply-gate.test.ts`、`webhook-runtime` send 行為測試、`event-normalizer` replyToken 測試。

**不動：** `router.ts` / `handlers.ts` / `permissions.ts` / `intent.ts` / `responder*.ts` / `message-client.ts` / route 檔。

---

## 3. Reply Gate 條件（全部為真才送；任一假 → 不送）

純函數 `shouldReplyToPartnerGroup(event, decision)`：

1. `decision.source === 'line_partner_group'`
2. `event.mentionsBot === true`（**本刀只認此項**；quote-to-bot 下一階段）
3. `decision.action === 'respond'`
4. `decision.denied !== true`
5. `decision.handlerResult?.outboundText` 為非空字串
6. `event.replyToken` 為非空字串

任一不成立 → 不呼叫 LINE，不 throw；缺 `replyToken` 時 log warning 並維持 webhook 200。

> reply 不用 push（reply-gate §3）：reply token 天然綁定觸發訊息、且證明 event-bound；push 留給未來 operator send / scheduled reminder。

---

## 4. Idempotency / Duplicate Reply 防護

兩層，務求「同一 tag 不重覆回兩次」：

1. **LINE reply token 單次語義（主防線）**：reply token 單次使用、~30s 過期。LINE at-least-once 重送同事件時，重複用同一已用 token → LINE 回非 2xx → 走 §5 失敗路徑（log + 200，不 throw、不再送）。
2. **messageId send-once 追蹤（次防線，可選但建議）**：以 `event.messageId` 為 key 記「此 partner-group 訊息已嘗試回覆」於 store（沿用既有 case idempotency set 風格，`handlers.ts:242` 已有 messageId dedup 樣板）。重送命中 → 直接 skip send。
   - 空 `messageId` 一律**不**dedup（與既有 OA 規則一致，`handlers.ts:246`）。
   - 此追蹤**只**防重複 send，不寫入客人 case 內容、不影響客人 OA 平面。

> 本刀最小可接受 = 只靠第 1 層（reply token 單次）即不會送出兩則成功 reply；第 2 層為防「重送觸發重複模型呼叫浪費 billing」的加強，列為 Task 5（可於本刀內完成或緊接下一刀，視 review）。

---

## 5. LINE Reply Failure 行為（reply-gate §6）

- `replyMessage` 丟 `LineApiError`（網路錯 / 非 2xx）→ **捕捉、不 rethrow**。
- log **非 minified** 可讀錯誤（全域規則：外部 API 必 try-catch、錯誤不得 minified）。
- **不**因 reply 失敗回 500；webhook 回 **200**。理由：夥伴群助理是增強功能，LINE 重送會重複打模型、放大 billing 與干擾同 webhook 其他事件。
- reply 失敗**絕不**回退去碰客人平面、不轉 push。

---

## 6. 不變量（守門，必須有測試證明）

### 6.1 客人 OA inbound 永不呼叫 LLM、永不 send
- `event.mentionsBot` 對 `line_oa` 恆 `false`（normalizer HARD RULE，已存在）→ gate 第 2 條必假 → 不送。
- `routeCommand` 對 `line_oa` 走 persist-only 分支（`router.ts:189`），不取 `partnerGroupResponder`。
- 測試：OA 文字含字面 `@bot` → responder spy **0 次呼叫**、reply client spy **0 次呼叫**、webhook 200。

### 6.2 dev / code / deploy / quote formal write denied 仍成立
- dev action 對夥伴群在 `intent.ts` / `permissions.ts` 已 deny → `decision.action === 'denied'`（`router.ts:233`）→ gate 第 3 條必假 → 不送。
- quote formal write 仍卡 write-token gate（Phase C dry-run only），本刀不新增任何 Sanity 寫入路徑。
- 測試：夥伴群 dev 指令 → denied、reply client spy 0 次。

### 6.3 responder 純度不破
- send 唯一發生在 webhook send gate；`PartnerGroupResponder` 不 import LINE client、不碰 token、不決定送出（adapter 設計 §5 硬邊界）。

---

## 7. 環境變數需求

| env | 必填 | 預設 | 說明 |
|---|---|---|---|
| `AI_AGENT_PARTNER_RESPONDER_MODE` | 否 | `stub` | `stub`\|`anthropic`。**預設 stub；即使 `ANTHROPIC_API_KEY` 存在也不自動開 anthropic，必須顯式設 `anthropic`。** |
| `ANTHROPIC_API_KEY` | 視 mode | — | 僅 `mode=anthropic` 時需要；缺則 factory 回 degraded stub（不 throw、不 500）。 |
| `AI_AGENT_DEFAULT_MODEL` | 視 mode | — | `respond/analyze/unknown` 路由用（model-routing）。 |
| `AI_AGENT_RESEARCH_MODEL` | 視 mode | — | `draft/parse` 路由用。本刀 text-only，多半走 default model。 |
| `LINE_CHANNEL_ACCESS_TOKEN` | 是 | — | reply client default 綁定，呼叫 `replyMessage` 用。 |
| `LINE_BOT_USER_ID` | 是 | — | normalizer 結構化 mention 比對（`mentionsBot`）已用。 |

**關鍵宣告：** mode 預設 **stub**。本刀部署即使帶齊 `ANTHROPIC_API_KEY` / model 名，**不會**自動產生模型費用——夥伴群 tag 只會收到 `STUB_PARTNER_GROUP_REPLY`，直到 Eric 顯式設 `AI_AGENT_PARTNER_RESPONDER_MODE=anthropic`。

---

## 8. TDD Task 拆分（bite-sized；每步 2–5 分鐘）

### Task 1：`NormalizedLineEvent` 捕捉 `replyToken`

**Files:**
- Modify: `src/lib/line-agent/line/event-normalizer.ts`
- Test: `src/lib/line-agent/__tests__/event-normalizer.test.ts`（沿用既有檔）

**Step 1 — 寫失敗測試**
- partner group text 事件（含 `replyToken`）→ `normalized.replyToken === '<token>'`，且 `mentionsBot` 行為不變。
- OA text 事件（含 `replyToken`）→ `normalized.replyToken` 被捕捉，但 `mentionsBot === false` 不變。

**Step 2 — 跑測試確認 FAIL**
Run: `npx vitest run src/lib/line-agent/__tests__/event-normalizer.test.ts`
Expected: FAIL（`replyToken` undefined / 欄位不存在）。

**Step 3 — 最小實作**
`NormalizedLineEvent` 加 `replyToken?: string`；各 message 分支 `replyToken: raw.replyToken`（present 時）。

**Step 4 — 跑測試 PASS**
Run: 同上。Expected: PASS。

**Step 5 — Commit**
`feat(line-agent): capture replyToken on normalized LINE events`

---

### Task 2：reply gate 純函數

**Files:**
- Create: `src/lib/line-agent/line/partner-reply-gate.ts`
- Test: `src/lib/line-agent/__tests__/partner-reply-gate.test.ts`

**Step 1 — 寫失敗測試**（§3 六條件的真值表）
- 全條件成立 → `true`。
- 逐一翻假（非 partner group / `mentionsBot=false` / `action!=='respond'` / `denied===true` / `outboundText` 空 / `replyToken` 空）各 → `false`。

**Step 2 — FAIL**
Run: `npx vitest run src/lib/line-agent/__tests__/partner-reply-gate.test.ts`

**Step 3 — 最小實作**
`export function shouldReplyToPartnerGroup(event: NormalizedLineEvent, decision: RouterDecision): boolean`（§3）。純布林、無 I/O。

**Step 4 — PASS**

**Step 5 — Commit**
`feat(line-agent): add partner-group reply gate predicate`

---

### Task 3：webhook responder seam + lazy default

**Files:**
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`
- Test: `src/lib/line-agent/__tests__/webhook-runtime.test.ts`（沿用/新增）

**Step 1 — 寫失敗測試**
- `setPartnerGroupResponder(fake)` 後，`defaultEventHandler` 對 partner-group tag 事件呼叫 fake responder。
- 預設（未注入）resolver → stub（`getPartnerResponderConfig` 預設 mode=stub）。

**Step 2 — FAIL**（seam 不存在）

**Step 3 — 最小實作**
比照既有 `getStore/setStore`：加 `getPartnerGroupResponder/setPartnerGroupResponder`，lazy memoized default = `createPartnerGroupResponder({ models: getPartnerResponderConfig(), transport: fetch })`；`defaultEventHandler` 改為帶 `partnerGroupResponder: getPartnerGroupResponder()` 進 `routeCommand`。

**Step 4 — PASS**

**Step 5 — Commit**
`feat(line-agent): wire partner-group responder seam into webhook runtime`

---

### Task 4：reply client seam + send gate（核心）

**Files:**
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`
- Test: `src/lib/line-agent/__tests__/webhook-runtime.test.ts`

**Step 1 — 寫失敗測試**（fake responder + fake reply client）
- partner group tagged 事件 → reply client 被呼叫**恰一次**，引數 = `(event.replyToken, [outboundText], …)`。
- partner group 未 tag → reply client **0 次**。
- OA 事件含 `@bot` → responder **0 次**、reply client **0 次**、回 200。
- dev 指令（denied）→ reply client **0 次**。
- `respond` 但無 `replyToken` → reply client **0 次** + warning log，回 200。

**Step 2 — FAIL**

**Step 3 — 最小實作**
加 `getReplyClient/setReplyClient`（default：`(replyToken, messages) => replyMessage(replyToken, messages, requireEnv('LINE_CHANNEL_ACCESS_TOKEN'))`）。`defaultEventHandler` 改為：
```ts
const decision = await routeCommand({ event, store, llmClassifier: safeDefaultLlmClassifier, partnerGroupResponder: getPartnerGroupResponder() })
if (shouldReplyToPartnerGroup(event, decision)) {
  try {
    await getReplyClient()(event.replyToken!, [{ type: 'text', text: decision.handlerResult!.outboundText! }])
  } catch (err) {
    // 非 minified log；不 rethrow；維持 200（§5）
  }
}
```
缺 `replyToken` 但 `action==='respond'` → log warning（不送）。

**Step 4 — PASS**

**Step 5 — Commit**
`feat(line-agent): send partner-group tagged reply via webhook send gate`

---

### Task 5：duplicate-reply 加強（messageId send-once，次防線）

**Files:**
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`（或薄 helper）
- Test: `webhook-runtime.test.ts`

**Step 1 — 寫失敗測試**
- 同一 partner-group tagged 事件（同 `messageId`）連送兩次 → reply client 合計**恰一次**。
- 空 `messageId` → 不 dedup（兩次各送，與既有 OA 規則一致）。

**Step 2 — FAIL**

**Step 3 — 最小實作**
送出前查/標記 `messageId` 於 store 的 sent-reply set（沿用 `handlers.ts` idempotency 樣板）；命中則 skip。

**Step 4 — PASS**

**Step 5 — Commit**
`feat(line-agent): dedupe partner-group reply on redelivered messageId`

> 若 review 認為「reply token 單次」已足夠，Task 5 可降為下一刀；本刀 Task 1–4 即構成可運作的最小 send gate。

---

### Task 6：守門回歸（只跑、不新增邏輯）

**Step 1** Run 全套相關回歸：
`npx vitest run src/lib/line-agent`
**Step 2** 確認綠：客人 OA no-auto-reply、dev-action-denied、quote dry-run、idempotent redelivery 全 PASS。
**Step 3** Commit（若有測試檔微調）：`test(line-agent): regression guards for tagged-reply send gate`

---

## 9. 測試矩陣（全假 transport / fake client，零真 key、零真 API）

| # | 測試 | 斷言 |
|---|---|---|
| 1 | normalizer：partner group text | 捕捉 `replyToken`；`mentionsBot` 不變 |
| 2 | normalizer：OA text | 捕捉 `replyToken`；`mentionsBot===false` |
| 3 | reply-gate 真值表 | 全成立→true；六條件逐一翻假→false |
| 4 | webhook：partner tagged | reply client 恰一次，引數含 `outboundText` |
| 5 | webhook：partner 未 tag | reply client 0 次 |
| 6 | webhook：OA 含 `@bot` | responder 0 次、reply client 0 次、200 |
| 7 | webhook：dev 指令（denied） | reply client 0 次 |
| 8 | webhook：respond 無 replyToken | reply client 0 次 + warning、200 |
| 9 | webhook：reply 失敗（client throw） | 不 rethrow、200、log 非 minified |
| 10 | webhook：重送同 messageId | reply client 恰一次（Task 5） |
| 11 | factory：mode 預設 | 未設 env → stub identity（不打 API） |
| 12 | 回歸 | OA 持久化 idempotency / dev-denied / quote dry-run 全綠 |

---

## 9.5 Manual Smoke Before Task 5

> Task 1–4 + P1 billing fix（`07e410d`）已落地、自動測試全綠（479/479）。進 Task 5（messageId send-once 次防線）**之前**，先在真實 LINE 平面跑一輪手動 smoke，確認 send gate + tag 流程在實機行為正確。**第一輪一律 stub mode，零 Anthropic billing。**

### 1. 環境變數確認（部署前）

| env | 期望 | 說明 |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | 存在 | reply client default 綁定，呼叫 `replyMessage` 用 |
| `LINE_BOT_USER_ID` | 存在 | normalizer 結構化 mention 比對（`mentionsBot`） |
| `LINE_PARTNER_GROUP_ID` | 存在 | partner group 來源判定 |
| `AI_AGENT_PARTNER_RESPONDER_MODE` | **`stub`**（第一輪） | 第一輪 smoke 一律 stub |
| `ANTHROPIC_API_KEY` | 可有可無 | **即使存在也不會啟用**——除非顯式 `AI_AGENT_PARTNER_RESPONDER_MODE=anthropic` |

### 2. 第一輪用 stub，不用 Anthropic

- **目的**：驗證 LINE reply **send gate** 與 partner group **tag 流程**端到端打通（normalizer → router → gate → reply client → LINE）。
- **不測**模型回覆品質——stub 回固定文字 `STUB_PARTNER_GROUP_REPLY`，足以證明送出路徑正確。
- 模型品質 / anthropic mode 留待 stub 全 PASS 後另一輪。

### 3. 手動測試步驟

| # | 操作 | 預期 |
|---|---|---|
| 1 | 夥伴群 **tag** 官方 LINE bot 問一句正常問題 | bot 回固定 **stub** 文字（一則、reply 形式） |
| 2 | 夥伴群**不 tag** bot 發一句閒聊 | **不回** |
| 3 | OA 客人 1:1 傳含字面 `@bot` 的訊息 | **不回客人**、**不呼叫 responder** |
| 4 | 夥伴群發 dev/deploy 類文字並 tag bot | **denied**、**不回** |
| 5 | replyToken missing/expired 的 tagged 事件（如重送過期事件） | **不回**、log warning、**不呼叫 real responder** |

### 4. 觀察項（Vercel logs / LINE 行為）

- [ ] 是否出現 `partner-group reply failed`（reply send 失敗的非 minified log）？
- [ ] 是否有任何 **customer OA reply** 發生？→ 應為 **0**。
- [ ] 同一 tag 是否出現 **多次 duplicate reply**？→ 應為 **1**（reply token 單次語義；Task 5 加次防線）。
- [ ] stub mode 下是否有任何 **Anthropic API call**？→ 應為 **0**。

### 5. 通過標準（全部成立才進 Task 5）

- ✅ 只有 **partner group tagged 正常問題**會收到**一則** reply。
- ✅ **OA 客人永遠不收到** bot 自動回。
- ✅ **untagged** group chat 不回。
- ✅ **dev / quote / code** 類不回（denied）。
- ✅ **stub mode 不產生任何 Anthropic billing**。

> 任一項不成立 → 停下、開 bug packet（`chiangway-quote-automation-debug` 風格），不要硬進 Task 5。

---

## 10. 下一階段（明標，不在本刀）

1. **quote-to-bot message tracking**：bot-authored 訊息 id 持久化 + `quotedRef`-to-bot 命中也觸發 reply gate 第 2 條（reply-gate §5 末段）。
2. **scheduled reminder push**：cron / CUA 掃描 → reminder candidate → 明確 send intent 才 push（case-intelligence §5.2 選 2）。
3. **deferred tool gates**：web search / OCR / Notion RAG / 報價 review / quote formal write，各需獨立 explicit gate。

---

## 11. 邊界自檢（對照 CLAUDE.md Operating Boundaries）

- ✅ CC/tmux 是 operator，bot 只是 LINE 執行通道。
- ✅ 客人 OA 訊息**不自動回覆**（gate 第 2 條對 OA 恆假）。
- ✅ 貼夥伴群/對外 push 仍需明確 send intent（本刀只做 reply，不碰 push）。
- ✅ 報價 dry-run only，本刀**不**新增 Sanity 寫入。
- ✅ 無 secrets 進 repo；LLM 預設 stub、測試零真 key。

---

## 12. Task 6 執行紀錄（守門回歸 · 2026-06-04）

**指令**：`npx vitest run src/lib/line-agent` → **38 test files / 488 tests 全 PASS**（branch `codex/line-oa-agent-mvp`，tip `5b08916`，工作樹 clean）。

範圍鎖定：只跑回歸、不開 anthropic mode、不碰 quote-to-bot、不碰 reminder push、零新增邏輯。

五條守門對應的綠燈實證（fake transport / fake client，零真 key、零真 API）：

| 守門 | 證據測試 |
|---|---|
| OA 客人不自動回 | `webhook-runtime`「never replies to an OA customer event, even one containing a literal "@bot"」；`m2-guardrails`「a customer OA message routes to create/update only — never a send action」；`auto-reply-mapping`「全域總開關恆為 false」「每個 mapping enabled 皆為 false」 |
| partner group tag 才回 | `webhook-runtime`「replies exactly once to a partner-group tagged event」；`partner-reply-gate`「returns true when all six conditions are satisfied」 |
| untagged 不回 | `webhook-runtime`「does not reply to a partner-group message that does not mention the bot」；`partner-reply-gate`「returns false when event.mentionsBot is false」 |
| dev/code/deploy/quote denied 不回 | `webhook-runtime`「does not reply to a denied dev command from the partner group」；`partner-reply-gate`「returns false when decision.denied is true / action is not respond」 |
| messageId 重送 dedup | `webhook-runtime`「replies only once when the same partner-group messageId is redelivered」「does not re-invoke the responder on a redelivered messageId (no re-bill)」「never dedupes an empty messageId」 |

**Step 3 commit 判定**：測試檔零微調 → 依 Task 6 規格不需 test commit。本紀錄為 docs 收尾。

> Vercel preview 實機手動 smoke **已完成**（2026-06-04）：env 已補齊 `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_BOT_USER_ID` / `LINE_PARTNER_GROUP_ID` / `AI_AGENT_PARTNER_RESPONDER_MODE=stub`，並重新部署到 `https://travel-o33et42ql-poyutsais-projects.vercel.app`。Eric 實機確認：私人 partner group tag bot → 收到一則 stub reply；partner group 不 tag → 無 reply；OA 後台人類管理員手動回客人 → bot 未插手；客人 plane 依 code guard（`line_oa` `mentionsBot=false` + reply gate source pin）不會觸發 AI reply。Vercel logs 無 `partner-group reply failed` / Anthropic 相關 log，stub mode 維持零 Anthropic billing。Task 5 後新版 Preview 也已 smoke：tag bot → 一則 stub reply，logs 無錯。
