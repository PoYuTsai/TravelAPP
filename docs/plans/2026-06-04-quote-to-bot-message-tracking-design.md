# Quote-to-Bot Message Tracking — Design (第二刀)

> **狀態：** design only。本文不含 code；實作另開 implementation plan（superpowers:writing-plans），再走 executing-plans。
> **前置：** Partner-Group Tagged Reply（第一刀，tip `7993173`）已上線、實機三項 smoke PASS（tag→reply / untagged→no reply / dev-denied→no reply）。

**Goal:** 夥伴在 partner group 內**引用/回覆 bot 先前發出的訊息**時，即使**不再 tag** bot，也視為「對 bot 說話」並產生一則 LINE reply；引用**真人**訊息則維持不回。其餘平面（客人 OA、dev、quote formal write）行為完全不變。

**核心轉變：** 把 bot-directed 判定從「只認 `mentionsBot`」放寬為 `botDirected = mentionsBot || isBotAuthoredQuote`，且 `isBotAuthoredQuote` **只**在 partner group 的 `group_quoted` 路徑計算——客人 OA plane 恆 false。

---

## 0. Scope

### In scope（這一刀）
1. partner group `group_quoted` 事件：`quotedRef.quotedMessageId` 命中 bot-authored id store → 視同 addressed（免重 tag）。
2. 追蹤 **bot-authored partner-group message id**：從 `replyMessage` 的 LINE response `sentMessages[].id` 取得並持久化（TTL 7 天）。
3. 新增 runtime derived 授權信號 `botDirected`，貫穿 runtime precondition → dedup claim → routeCommand/permissions → 純函數 gate。
4. 沿用第一刀的 send gate、reply（非 push）、Task 5 inbound `messageId` send-once dedup。

### Out of scope（明標，本刀不做）
- ❌ anthropic mode（仍預設 stub；有 key 也不自動開）。
- ❌ scheduled reminder push / cron / CUA。
- ❌ quote formal write / Sanity 寫入（dry-run only 不變）。
- ❌ 「人類多次引用同一 bot 訊息」的複雜 UX——只靠 Task 5 inbound `messageId` send-once 防 redelivery，不做額外去重。
- ❌ 追蹤 case card / 未來 push 產生的 bot 訊息——目前唯一 bot send site 是 send gate 的 tagged/quoted reply，只追蹤該處。
- ❌ 解析/保存 `quoteToken`（YAGNI；本刀只需 message id 比對）。

---

## 1. 現況（已 grep 驗證）

| 元件 | 現況 | 本刀是否動 |
|---|---|---|
| normalizer `quotedRef.quotedMessageId` | **已捕捉**；group + quote → kind `group_quoted`（`event-normalizer.ts:233-251`） | 不動（已足夠） |
| permissions B1/B2 | `canRespondToPartnerGroupTag` / `shouldIgnoreCasualPartnerGroupChat` **只讀 `event.mentionsBot`**；`group_quoted` 刻意不觸發（`permissions.ts:64-122`） | **要改**（改讀 `botDirected`） |
| `replyMessage` | 回 `Promise<void>`，**丟棄** LINE response body（`message-client.ts:114-150`） | **要改**（回傳 `sentMessageIds`） |
| `webhook-runtime.mayProducePartnerGroupReply` | precondition 用 `mentionsBot===true`，把關 dedup claim(`:93`) + responder resolve(`:109`) | **要改**（改用 `botDirected`，且須 async） |
| `shouldReplyToPartnerGroup` | 純函數，第 2 條 `event.mentionsBot===true`（`partner-reply-gate.ts`） | **要改**（吃參數 `botDirected`） |
| `claimPartnerReply(messageId)` | Task 5 send-once（`webhook-runtime.ts:94`） | 不動（位置調整到 `botDirected` 判定後） |
| KV store | 既有 case idempotency set 風格（`kv-store.ts`） | **要加** 2 個方法 |

---

## 2. 資料結構 — bot-authored id store

KV set，沿用既有 `kv-store.ts` 風格。

```
key:   line-agent:partner-bot-msg:<botMessageId>
value: "1"（存在即代表「此 id 是 bot 在夥伴群發過的訊息」）
TTL:   604800s（7 天）
```

**namespace 保證：** 前綴 `partner-bot-msg:` 只由 send gate（partner group 路徑）寫入；客人 OA plane 永不寫此前綴 → OA 的任何 `quotedMessageId`（即使理論上湊巧）都不可能命中。

**CaseStore 新增方法（注入式 seam，可 fake 單測）：**
- `putBotAuthoredPartnerMsg(messageId: string): Promise<void>` — 寫入，TTL 7 天。空 id 一律 no-op。
- `isBotAuthoredPartnerMsg(messageId: string): Promise<boolean>` — 查存在。空 id 回 false。

---

## 3. Control flow（修正版，含 router 貫穿）

新增 runtime derived 授權信號 `botDirected`（與 raw `mentionsBot` 分離，不竄改 normalizer）。

```
botDirected = mentionsBot || isBotAuthoredQuote
```

**`defaultEventHandler` 順序（修正自第一刀）：**
```
1. isBotAuthoredQuote = false
   if sourceChannel==='line_partner_group'
      && kind==='group_quoted'
      && quotedRef.quotedMessageId 非空:
        try   isBotAuthoredQuote = await store.isBotAuthoredPartnerMsg(qid)
        catch isBotAuthoredQuote = false        // fail-safe：讀不到/超時 → 非 bot

2. botDirected = (mentionsBot === true) || isBotAuthoredQuote

3. replyCandidate = sourceChannel==='line_partner_group'
                    && typeof replyToken==='string' && replyToken.trim()!==''
                    && botDirected               // ← 取代舊的 mentionsBot

4. if replyCandidate && messageId !== '':         // dedup 在 botDirected 判定後、responder 前
        if !(await store.claimPartnerReply(messageId)) return

5. decision = await routeCommand({
        event, store, llmClassifier,
        botDirected,                              // ← 貫穿進 permissions
        partnerGroupResponder: replyCandidate ? getPartnerGroupResponder() : undefined,
   })

6. if shouldReplyToPartnerGroup(event, decision, botDirected):
        text = decision.handlerResult!.outboundText!
        try:
            sentIds = await getReplyClient()(replyToken!, [{type:'text', text}])
            for id of sentIds: await store.putBotAuthoredPartnerMsg(id)   // 寫回 store
        catch err: console.error(非 minified)     // §4：不 rethrow、webhook 仍 200
        return

7. // 診斷：respond-worthy 但缺 replyToken（重建 probe event 仍要帶 botDirected）
   if !replyToken && shouldReplyToPartnerGroup({...event, replyToken:'probe'}, decision, botDirected):
        console.warn('partner-group respond decision had no replyToken; skipping reply')
```

**permissions 改動：** `routeCommand` 接受 `botDirected`，B1/B2 讀它取代直接讀 `event.mentionsBot`。
- B1 `canRespondToPartnerGroupTag`：`sourceChannel==='line_partner_group' && botDirected` → allowed。
- B2 `shouldIgnoreCasualPartnerGroupChat`：partner group 且 `!botDirected` → ignore。

**gate 純函數：** `shouldReplyToPartnerGroup(event, decision, botDirected)`——第 2 條由 `event.mentionsBot===true` 改為 `botDirected===true`；其餘 5 條不變。

**為何貫穿到 router/permissions：** 若只改 runtime precondition，bot-authored quote 進 `routeCommand` 仍被 permissions 判成「未 addressed」→ 不產生 `respond`/`outboundText` → gate 即使放行也沒內容可回（「runtime 想回但 router 判未 addressed」的斷層）。

---

## 4. `replyMessage` 回傳變更

LINE `/v2/bot/message/reply` 成功回 `{ sentMessages: [{ id, quoteToken }] }`——bot-authored id 的**唯一可靠來源**（LINE 不會把 bot 自己的訊息用 webhook echo 回來）。

- `replyMessage(...)` 由 `Promise<void>` 改回 `Promise<string[]>`（`sentMessages[].id`，缺欄位回 `[]`）。
- 解析失敗（body 非預期）→ 回 `[]`，**不** throw（reply 已成功送出，追蹤失敗只是「下次引用此訊息要重 tag」，可接受）。
- reply client seam 型別同步更新；既有失敗語義（非 2xx 丟 `LineApiError`）不變。

---

## 5. 失敗處理（守門，全部要測試）

| 失敗點 | 行為 | 理由 |
|---|---|---|
| `isBotAuthoredPartnerMsg` 讀失敗/超時 | catch → `isBotAuthoredQuote=false`（**fail-safe**） | 無法確認屬 bot → 不觸發 LLM、不回；最壞=夥伴重 tag |
| `replyMessage` 送失敗（`LineApiError`） | 捕捉、不 rethrow、log 非 minified、webhook 200、**不**寫 store、不退客人平面/不轉 push | 第一刀 §5 既有規則延用 |
| `replyMessage` 成功但 response 解析不出 id | 回 `[]`，store 不寫，reply 仍算成功 | 追蹤失效僅造成「下次引用需重 tag」 |
| `putBotAuthoredPartnerMsg` 寫失敗 | catch、log、不影響已送出的 reply、webhook 200 | 同上，便利功能不得拖垮主路徑 |
| `claimPartnerReply` 已被佔（redelivery/併發） | return，不解析 responder、不送 | Task 5 send-once，含 quote-to-bot redelivery |

---

## 6. 不變量（守門，必須有測試證明）

1. **客人 OA 永不 botDirected：** `isBotAuthoredQuote` 只在 `sourceChannel==='line_partner_group'` 計算；OA 路徑恆 `botDirected=false` → responder 0 次、reply client 0 次、200。
2. **引用真人訊息不回：** `group_quoted` 但 `quotedMessageId` 不在 store 且 `mentionsBot=false` → `botDirected=false` → 不回。
3. **引用 bot 訊息免重 tag：** `group_quoted` + `quotedMessageId ∈ store` + `mentionsBot=false` → `botDirected=true` → 恰一則 reply。
4. **dev/code/deploy/quote denied 仍成立：** `botDirected=true` 也救不了 denied——gate 第 4 條 `decision.denied!==true` 擋下。
5. **redelivery 不重燒：** 同 `messageId` 重送（含 quote-to-bot）→ `claimPartnerReply` 第二次失敗 → responder 不再呼叫、不重送。
6. **responder 純度：** send 與 store 寫入唯一發生在 webhook send gate；responder 不碰 LINE client / token / store。
7. **stub 預設：** 無 `AI_AGENT_PARTNER_RESPONDER_MODE=anthropic` → 永遠 `STUB_PARTNER_GROUP_REPLY`，零 billing。

---

## 7. 測試矩陣（全 fake transport / fake store，零真 key、零真 API）

| # | 測試 | 斷言 |
|---|---|---|
| 1 | `replyMessage` 成功解析 | 回 `['<id>']`（取自 `sentMessages[].id`） |
| 2 | `replyMessage` response 缺 `sentMessages` | 回 `[]`，不 throw |
| 3 | store `put`/`is` round-trip | put 後 is=true；TTL=604800 傳入 KV |
| 4 | store `is` 空 id | 回 false（不查 KV） |
| 5 | runtime：quote-to-bot（命中 store, 無 mention） | responder 1 次、reply client 1 次、送後 `put` 被呼叫 |
| 6 | runtime：quote 真人訊息（未命中, 無 mention） | responder 0 次、reply client 0 次、200 |
| 7 | runtime：store `is` 讀 throw | fail-safe→不回、responder 0 次、200 |
| 8 | runtime：OA `group`-like 含 quote（理論） | `botDirected=false`、responder 0 次、reply 0 次 |
| 9 | runtime：quote-to-bot + dev 指令 | denied、reply client 0 次 |
| 10 | runtime：quote-to-bot redelivery 同 messageId | reply client 恰 1 次、responder 不二次呼叫 |
| 11 | runtime：quote-to-bot 無 replyToken | 不回、warn、real responder 0 次 |
| 12 | permissions B1：partner + `botDirected=true`（無 mention） | allowed |
| 13 | permissions B2：partner + `botDirected=false` | ignore=true |
| 14 | gate：第 2 條改吃 `botDirected` 真值表 | `botDirected` 翻假→false；其餘 5 條回歸不破 |
| 15 | 回歸 | 第一刀 488 測試全綠（mentionsBot 既有路徑不變） |

---

## 8. 需修改 / 新增檔案

**修改：**
- `src/lib/line-agent/line/message-client.ts` — `replyMessage` 回 `Promise<string[]>`（解析 `sentMessages[].id`）。
- `src/lib/line-agent/line/webhook-runtime.ts` — async precondition、`botDirected` 計算、claim 位置、貫穿 routeCommand、送後寫 store、診斷 probe 帶 botDirected；reply client seam 型別。
- `src/lib/line-agent/permissions.ts` — B1/B2 改讀 `botDirected`。
- `src/lib/line-agent/line/partner-reply-gate.ts` — `shouldReplyToPartnerGroup(event, decision, botDirected)`。
- `routeCommand`（其所在檔）— 接受並貫穿 `botDirected` 給 permissions。
- `kv-store.ts`（+ store 介面 + fake store）— `putBotAuthoredPartnerMsg` / `isBotAuthoredPartnerMsg`。

**不動：** event-normalizer（quotedRef 已足夠）、responder*、intent、route 檔、客人 OA 路徑。

---

## 9. 環境變數

無新增。沿用第一刀：`AI_AGENT_PARTNER_RESPONDER_MODE`（預設 stub）、`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_BOT_USER_ID`、`LINE_PARTNER_GROUP_ID`、KV 連線。

---

## 10. 邊界自檢（對照 CLAUDE.md Operating Boundaries）

- ✅ 客人 OA 訊息**不自動回覆**（`botDirected` 對 OA 恆 false）。
- ✅ 對外 push / 主動貼群仍需明確 send intent（本刀只做 reply）。
- ✅ 報價 dry-run only，**不**新增 Sanity 寫入。
- ✅ 無 secrets 進 repo；LLM 預設 stub、測試零真 key。
- ✅ CC/tmux 是 operator，bot 只是 LINE 執行通道。

---

## 11. 下一階段（明標，不在本刀）

1. anthropic mode 啟用（顯式 env，另一輪 smoke）。
2. scheduled reminder push（cron / CUA → reminder candidate → 明確 send intent）。
3. quote formal write（須 Eric 批准 server-side Sanity write token）。
4. 其餘 deferred gates（web search / OCR / Notion RAG / 報價 review）。
