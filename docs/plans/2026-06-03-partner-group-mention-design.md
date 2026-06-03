# Partner-Group Bot-Mention 第一小刀 — Design

- 日期：2026-06-03
- Branch：`codex/line-oa-agent-mvp`（M2 第二批 · 第一小刀）
- 範圍：夥伴群被 tag → respond **stub** + 守門測試 + 釘 LLM adapter seam
- 狀態：**design only**，待 Eric review 後再決定是否進實作

---

## 0. 目標與非目標

### 目標
- 夥伴群（`line_partner_group`）被 mention（@清微AI助理 等）時，bot 回一段**安全 stub 文字**。
- 把 mention 偵測收斂到單一來源（normalizer），permissions 只讀布林。
- 釘好未來接真 LLM 的 **PartnerGroupResponder** 注入 seam，介面位置一次定死。
- 守門測試先行：客人 OA 永不自動回、夥伴群 dev/quote 類仍 deny、送出仍需 explicit `sendTarget`。

### 非目標（這批一律不做）
- 真 LLM / billing / 讀任何 model env key / 新增 Anthropic adapter
- web search、Notion 深查、Google 查資料
- rich menu postback live trigger
- quote formal write（仍卡 Sanity write-token gate）

---

## A. Mention 偵測（normalizer 單一來源）

`event-normalizer.ts` 的 `normalizeLineEvent` 新增第三參數 `botUserId?: string`（來自新 env `LINE_BOT_USER_ID`，**可空**）。normalizer 解析 raw event 的 `message.mention.mentionees`，計算正規化布林 `mentionsBot`，寫進 `NormalizedLineEvent`。

> **`mentionsBot` 用 required `boolean`（非 optional）**，由 normalizer 一律賦值，`line_oa` 恆為 `false`。避免 permissions 還要處理 `undefined`。

### 硬規則（務必在實作與測試中鎖死）
- **`mentionsBot` 只對 `sourceChannel === 'line_partner_group'` 有效。**
- **`line_oa` customer event 即使文字含 `@bot`／任何喚醒詞，`mentionsBot` 一律為 `false`，永遠不能觸發回覆。**
- 因此所有文字 fallback（含 `@` 與非 `@` 喚醒詞）**只在 partner group 生效**。
- 結構化 mention 雖然實務上也只發生在群組，但**實作仍以 `sourceChannel === 'line_partner_group'` 為唯一 gate**，不依賴 LINE 的 mention 行為假設。

### 偵測邏輯
```
mentionsBot =
  sourceChannel === 'line_partner_group' && (
    (botUserId 非空 && mentionees.some(m => m.userId === botUserId))   // 結構化優先
    || aliasRegex.test(text)                                          // 文字 fallback
  )
```

### alias fallback 清單
- `@` 前綴（夥伴正式 tag）：
  `@清微旅行chiangway_travel`、`@清微旅行`、`@清微AI助理`、`@清微AI`、`@AI`、`@bot`、`@cc`
- 非 `@` 喚醒詞（夥伴口語呼叫，例如「清微AI 幫我看一下」）：
  `清微AI`、`清微助理`、`bot`

### 誤觸防護
- 拉丁字（`@AI`／`@bot`／`@cc`／裸字 `bot`）加 word boundary：`/\bbot\b/i`。
  - 註：`\bbot\b` **不會**誤中 `robot`／`chatbot`（內部 `bot` 兩側都是 word char，boundary 不成立），只命中獨立的 `bot`。但仍可能命中「我問 bot 過了」這類句子——這是 Eric 刻意接受的喚醒成本（口語呼叫優先）。
- CJK 喚醒詞直接比對字面（CJK 無有效 `\b`）。
- 客人 OA 完全不吃 fallback（見硬規則），所以客人打 `@bot` 不會誤觸。

### permissions 改動
- B1 `canRespondToPartnerGroupTag` / B2 `shouldIgnoreCasualPartnerGroupChat` 改讀 `event.mentionsBot`，**不再各自跑 regex**（消除重複、單一事實來源）。
- 既有 `@bot`／`@cc` 測試需維持綠燈（alias 為超集，向後相容）。

### 硬規則：`group_quoted` 不再 implies active（**行為變更**）
現有 `permissions.ts` 以 `ACTIVE_PARTNER_GROUP_KINDS = {'group_quoted'}` 在 B1(:97)／B2(:133) 把**任何引用回覆**當成 active request。本批新規格是「**mention 才觸發**」，須改成：
- 觸發判定**只看 `event.mentionsBot`**，移除 `ACTIVE_PARTNER_GROUP_KINDS.has(kind)` 這個 OR 分支（或令該集合為空）。
- `group_quoted` + `mentionsBot === false` → **silent**。引用對話 ≠ 叫 bot 回（團隊常用引用討論，不應誤觸）。
- `group_quoted` + `mentionsBot === true` → respond（與一般 tag 同路徑）。
- **未來**若要支援「引用 bot 上一則訊息」免 @ 即觸發，**必須先追蹤 bot 自己的 messageId / sender**，再判斷被引用的訊息是否來自 bot——**不在本批**。
- ⚠️ 既有斷言「`group_quoted` 無 mention → active/respond」的測試須一併更新為 silent。

---

## B. PartnerGroupResponder seam（注入式，零 send 權限）

新檔 `src/lib/line-agent/partner-group/responder.ts`：

```ts
import type { CommandIntent } from '../commands/intent'

export interface PartnerGroupRespondInput {
  event: NormalizedLineEvent
  intent: CommandIntent      // repo 既有型別；無 `Intent` 型別
  text: string
  actor?: { lineUserId?: string }
  caseId?: string          // 未來群組引用 case 用；這批留空
  context?: unknown        // 先 optional，不接 Notion/Google
}

export interface PartnerGroupRespondResult {
  text: string
  meta?: { responder: 'stub' | 'llm'; model?: string; confidence?: string }
}

export interface PartnerGroupResponder {
  respond(input: PartnerGroupRespondInput): Promise<PartnerGroupRespondResult>
}

export const stubPartnerGroupResponder: PartnerGroupResponder = { /* 回固定文字 */ }
```

### Responder 邊界（doc 級釘死，實作不得違反）
- responder **只產生文字**。
- responder **不得 import LINE client / message-client**。
- responder **不得讀任何 token / model env key**。
- responder **不決定是否送出**。
- **送出權限只屬於 router / permission layer**（B4 `sendTarget`）。responder 產出的 text 是否真的回群，由 router + permission 控制。

### stub 文字（定稿）
> 收到，我先記下來。這批我目前先跑安全版助理流程，會先協助整理與判斷；需要正式結論或外部確認時，請 Eric 再拍板。

（無 emoji；不寫「tag Eric」以免像系統測試訊息。）

---

## C. 接線（router / handler）

- `handleRespondToPartnerGroup(event, intent, responder)` 改為呼叫注入的 `responder.respond(...)` 取得 `result`，作為 `RouterAction: 'respond'` 的回覆內容。
- router 透過既有 deps 模式注入 responder，M2 預設給 `stubPartnerGroupResponder`（與 `safeDefaultLlmClassifier` 同款 safe-default 注入）。

### responder text 回 `HandlerResult` 的固定位置（避免實作各放各的）
`HandlerResult`（handlers.ts:54）新增 optional `outboundText?: string`：
```ts
export interface HandlerResult {
  handler: string
  status: 'stub_ok' | 'stub_skipped' | 'error'
  outboundText?: string        // 新增：要回到群組的純文字（仍由 router/permission 決定是否送）
  meta?: Record<string, unknown>
}
```
`handleRespondToPartnerGroup` 回傳：
```ts
{
  handler: 'handleRespondToPartnerGroup',
  status: 'stub_ok',
  outboundText: result.text,
  meta: { responder: result.meta },   // { responder: 'stub' } 等
}
```
`outboundText` 只是「擬回文字」，**不代表已送出**；實際送出仍走 router + B4 `sendTarget`。responder 全程不碰 LINE。
- **不動 B3 / B4 / B5。** 未來接 GPT＝新增一個 `PartnerGroupResponder` impl 換接，handler/router/permission 邊界與測試皆不動。

---

## D. 測試（guardrail-first，vitest）

放 `src/lib/line-agent/__tests__/`，沿用 `makePartnerGroupEvent()` / `makeOaEvent()` fixture。

1. **normalizer mention**
   - 結構化命中 `botUserId` → `mentionsBot: true`
   - 結構化 mentionee 非 bot → `mentionsBot: false`（除非文字 fallback 命中）
   - 各 alias（`@` 與非 `@`）純文字、partner group → `true`
   - 閒聊無喚醒詞 → `false`
   - `botUserId` 空 → 只走文字 fallback
   - **`line_oa` 文字含 `@bot` → `mentionsBot: false`（硬規則）**
   - `\bbot\b` 命中獨立 `bot`、不命中 `robot`/`chatbot`

2. **permissions**
   - B1：partner group + `mentionsBot` → respond
   - B2：partner group 閒聊 / `unknown_group` 無喚醒詞 → silent
   - **`group_quoted` + `mentionsBot:false` → silent**（引用 ≠ 叫 bot 回；行為變更）
   - **`group_quoted` + `mentionsBot:true` → respond**

3. **handler seam**
   - 注入 fake responder，斷言 `handleRespondToPartnerGroup` 確實呼叫 seam
   - **斷言 `result.outboundText === fakeResponder 的 text`**（固定欄位）
   - 斷言 responder 物件上**沒有任何 send / push / reply method**

4. **零越界守門**
   - 客人 OA event 永不 reply（B3，含「OA 文字含 @bot 仍不回」）
   - partner group dev/code/deploy/parser/schema/quote 類仍 `denied`（B5）
   - `post_to_partner_group` 仍需 explicit `sendTarget`（B4）

---

## 受影響檔案（預估）

**核心：**
- `src/lib/line-agent/line/event-normalizer.ts` — `NormalizedLineEvent` 新增 `mentionsBot: boolean`（required）；`normalizeLineEvent` 新增第三參數 `botUserId?: string`；mention 解析 + alias regex。（NormalizedLineEvent 定義在此檔，**不在** `types.ts`）
- `src/lib/line-agent/permissions.ts` — B1/B2 改讀 `event.mentionsBot`；**移除 `ACTIVE_PARTNER_GROUP_KINDS` 的 `group_quoted` auto-active**（:97/:133），改純 `mentionsBot` gate
- `src/lib/line-agent/partner-group/responder.ts` — **新檔**，interface（`CommandIntent`）+ `stubPartnerGroupResponder`
- `src/lib/line-agent/commands/handlers.ts` — `HandlerResult` 新增 `outboundText?: string`；`handleRespondToPartnerGroup` 接 responder 並回 `outboundText`
- `src/lib/line-agent/commands/router.ts` — deps 注入 responder（safe default）

**env / config wiring（實作必接，否則 runtime 不會把 botUserId 傳進 normalizer）：**
- `src/app/api/line/webhook/route.ts` — **真實 raw→normalize caller**。新增 `const botUserId = process.env.LINE_BOT_USER_ID ?? ''`，傳第三參數：`normalizeLineEvent(rawEvent, partnerGroupId, botUserId)`。沿用既有 `partnerGroupId`（route.ts:83 直讀 env）同款模式。
  - 註：route 目前對 `partnerGroupId` 是**直讀 `process.env`**，非走 `config.ts`。`botUserId` 比照直讀即可。
- `src/lib/line-agent/config.ts` — **可選**：若要走結構化 config，新增 optional `lineBotUserId`（非 `require`，可空）。若加，須與 route 共用**單一來源**，不要 env 直讀與 config 兩套並存。
- `.env.example` — 新增 `LINE_BOT_USER_ID=` placeholder（可空；空則只走文字 fallback）

**測試：**
- `src/lib/line-agent/__tests__/*` — 上述 D 段測試

---

## 硬邊界對照（實作後須仍全部成立）

| 邊界 | 規則 | 這批是否變動 |
|------|------|--------------|
| B3 | 客人 OA 永不自動回 | 不變，且新增「OA 含 @bot 仍不回」測試 |
| B5 | partner group deny dev/code/deploy/parser/schema/quote | 不變 |
| B4 | 送出 partner group 需 explicit `sendTarget` | 不變 |
| responder | 只產文字、無 send 權限、不讀 token | 新增並鎖死 |
