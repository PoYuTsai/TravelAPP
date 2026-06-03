# Partner-Group Responder 真模型 Adapter — Design（A-lite）

- 日期：2026-06-03
- Branch：`codex/line-oa-agent-mvp`（M2 第二批 · 第二小刀）
- 範圍：把 `PartnerGroupResponder` seam 接上**真 Anthropic 模型**（注入式 raw fetch）+ **model routing 純函數** + **feature flag 預設 stub**。
- 狀態：**design 定稿，未實作**（docs-only）。前置：[`2026-06-03-partner-group-mention-design.md`](2026-06-03-partner-group-mention-design.md)（§B seam 已釘）。
- 接續關係：本設計只「換接」上一刀釘好的 `PartnerGroupResponder` seam；handler / router / permissions / route 四層**不動**。

---

## 0. 目標與非目標

### 目標
- 為 `PartnerGroupResponder` 寫一個真 LLM adapter（`AnthropicPartnerGroupResponder`），打 Anthropic Messages API。
- 用**注入式 raw fetch**（transport），零新增 npm 依賴；測試以假 transport 覆蓋，不打真 API。
- 新增 **feature flag** `AI_AGENT_PARTNER_RESPONDER_MODE=stub|anthropic`，**預設 stub**；即使 `ANTHROPIC_API_KEY` 存在也不自動啟用。
- **model routing 純函數**：依 intent 選 `defaultModel` / `researchModel`。
- 鎖死 system prompt 人格與守門條款。
- error/fallback 一律 **safe-default 但大聲可觀測**（degraded stub，不 throw、不 500）。

### 非目標（這批一律不做）
- `LlmIntentClassifier` 真模型（command intent 分類維持 `safeDefaultLlmClassifier`）。
- web search、Notion 深查（RAG）、Google 查資料、OCR。
- Sanity quote formal write（仍卡 write-token gate）。
- customer OA auto-reply（永不）。
- 自動推送夥伴群（送出仍由 router + permission 的 `sendTarget` 決定）。
- Vercel AI Gateway / `@anthropic-ai/sdk`（未來要換，換 adapter 即可，seam 不動）。

---

## 1. 真實注入點（已 grep 驗證，非猜測）

`routeCommand` 兩個 caller：

| Caller | 帶什麼 | 與本設計關係 |
|---|---|---|
| `src/lib/line-agent/line/webhook-runtime.ts:48` | `{ event, store, llmClassifier }` | **注入點**——只有這條會帶 `event.sourceChannel === 'line_partner_group'` |
| `src/app/api/agent/commands/route.ts:95` | `{ command, llmClassifier, … }` | operator command 路徑，**不帶 event**，本批不動 |

`partnerGroupResponder` 只在 router 的 `event.sourceChannel === 'line_partner_group'` 分支（`router.ts:223 / 255`，`input.partnerGroupResponder ?? stubPartnerGroupResponder`）被取用，需要 `event` → 因此唯一注入點是 webhook 路徑。

---

## 2. Responder seam（鏡像既有 store seam）

在 `webhook-runtime.ts` 新增與 `getStore()/setStore()` 對稱的 seam：

```ts
getPartnerGroupResponder(): PartnerGroupResponder   // 鏡像 getStore()
setPartnerGroupResponder(r: PartnerGroupResponder): void  // 鏡像 setStore()，測試注入用
```

`defaultEventHandler` 改為：

```ts
await routeCommand({
  event,
  store,
  llmClassifier: safeDefaultLlmClassifier,
  partnerGroupResponder: getPartnerGroupResponder(),
})
```

- **lazy resolver**：首次讀取時呼叫 factory，記憶化（module-singleton），比照 `getStore()` 的「deferred fail-closed」語義。
- 預設 resolver：`createPartnerGroupResponder({ models: getPartnerResponderConfig(), transport: fetch })`。
  - **採解 B（見 §3.2）：用窄 selector，不走 all-or-nothing 的 `loadAgentConfig`** —— 否則缺任一無關 env（Notion/Storage…）也會讓夥伴群增強路徑 500。
- 測試以 `setPartnerGroupResponder(fake)` 覆蓋，**完全不碰 env、不打真 fetch**。
- 此模式與檔頭註解（route 讀 getter、test 用 setter 注入）一致，不引入新風格。

---

## 3. Factory / env 分層

```ts
createPartnerGroupResponder({ models, transport }): PartnerGroupResponder
```

- **唯一讀 env = `config.ts` 的 `loadAgentConfig()`**；factory **不讀 `process.env`**，只吃 `ModelsConfig` + 注入 transport。
- `ModelsConfig` 新增欄位：

```ts
export interface ModelsConfig {
  anthropicApiKey: string
  openaiApiKey: string
  defaultModel: string
  researchModel: string
  visionModel: string
  partnerResponderMode: 'stub' | 'anthropic'   // 新增
}
```

- 來源：`AI_AGENT_PARTNER_RESPONDER_MODE`，用既有 `optional(env, 'AI_AGENT_PARTNER_RESPONDER_MODE', 'stub')`，**預設 stub、不可 `require`**（沒設此 env 不會炸 `loadAgentConfig`）。
- factory 決策：

| 條件 | 回傳 | log |
|---|---|---|
| `mode !== 'anthropic'`（含未設） | `stubPartnerGroupResponder` | — |
| `mode === 'anthropic'` 且 `anthropicApiKey` 空 | **degraded stub responder**（見 §6.1） | warn：`mode=anthropic but ANTHROPIC_API_KEY missing` |
| `mode === 'anthropic'` 且有 key | `new AnthropicPartnerGroupResponder({ transport, apiKey, defaultModel, researchModel })` | — |

### 3.1 開放矛盾（Codex/Eric review 2026-06-03，實作前必先用測試釐清）

`loadAgentConfig` 目前 `require('ANTHROPIC_API_KEY')`，缺 key 會在 **config 階段先丟 `AgentConfigError`**。因此 §3 的「`mode=anthropic` + 空 key → factory degraded stub」分支，**在正常 webhook flow（先過 `loadAgentConfig` 才到 factory）裡不可達**。這是真矛盾，不是雙保險。

**拍板方向（Eric）**：`partnerResponderMode` 相關的 key 缺失應**降級 stub、不讓 webhook 500**；但**絕不可**為此放寬 `ANTHROPIC_API_KEY` 而打破其他「真的 require key」的既有測試。

**待下一輪用紅燈測試釐清的兩問**：
1. `mode=stub` + 缺 `ANTHROPIC_API_KEY`：partner responder **不應**成為 throw 來源（但 `loadAgentConfig` 若為其他既有用途仍 require key，可能本來就 throw——測試要先界定「是不是因 partner responder 而炸」）。
2. `mode=anthropic` + 缺 key：選 (a) `loadAgentConfig` 照舊 throw（webhook 500，與 Eric 方向相左）或 (b) 讓 key 對 partner 路徑可降級。

### 3.2 決定：解 B（Codex/Eric 拍板 2026-06-03）

partner responder 路徑**不走** all-or-nothing 的 `loadAgentConfig`（避免缺任一無關 env 也 500），改用**窄 selector**；`ANTHROPIC_API_KEY` 對此路徑**可空**。`loadAgentConfig` 既有行為**完全不動**（其他用途若 require key 仍 throw，既有測試不破壞）。

**窄 selector 合約**（新檔，名稱 `getPartnerResponderConfig` 或 `loadPartnerResponderModelsFromEnv`，下一輪定）：

```ts
// 只解析 partner responder 需要的欄位；ANTHROPIC_API_KEY 可空。
getPartnerResponderConfig(env = process.env): {
  partnerResponderMode: 'stub' | 'anthropic'   // optional，預設 'stub'
  anthropicApiKey: string                       // 可空字串（不 throw）
  defaultModel: string                          // 缺 → 降級訊號（見下）
  researchModel: string
}
```

- 此 selector **不 throw**。缺 `ANTHROPIC_API_KEY`（或 mode=anthropic 但缺 model 名）→ 產出仍可建立，由 factory 判定降級。
- **§2 的 webhook lazy resolver 改用此 selector**（不再 `loadAgentConfig().models`），transport 仍注入 `fetch`。
- factory 只吃此 selector 產出的 `ModelsConfig`-like object + transport（仍不讀 `process.env`）。

**降級規則對照**：

| mode | key | 結果 |
|---|---|---|
| unset / `stub` | 缺 | `stubPartnerGroupResponder`，**不 throw** |
| `anthropic` | 有 | `AnthropicPartnerGroupResponder` |
| `anthropic` | 缺/空 | **degraded stub**，`meta.error='missing_anthropic_api_key'`，warn log，**不 throw / 不 500** |

### 3.3 TDD 起手順序（下一輪，先紅燈再 adapter）

1. **config / selector tests**：
   - mode unset + 無 `ANTHROPIC_API_KEY` → 回 stub-capable config，**不 throw**
   - mode=`stub` + 無 key → **不 throw**
   - mode=`anthropic` + 無 key → config 可建立（供 factory 判降級）
   - **既有 `loadAgentConfig` required 行為不被破壞**（回歸）
2. **factory tests**：
   - mode `stub` → stub identity
   - mode `anthropic` + key → `AnthropicPartnerGroupResponder`
   - mode `anthropic` + 空 key → degraded stub（`meta.error='missing_anthropic_api_key'`）
3. **然後才寫 adapter**（§5）。

---

## 4. Model routing（純函數）

`model-routing.ts`：

```ts
export function routePartnerModel(
  intent: CommandIntent,
  models: { defaultModel: string; researchModel: string },
): string
```

| intent.action | 模型 |
|---|---|
| `respond` / `analyze` / `unknown` | `defaultModel` |
| `draft` / `parse` | `researchModel` |
| 其餘 / 未列 | `defaultModel`（fallback） |

- 純函數、無 I/O、無 env，完全可單測。
- 由 `AnthropicPartnerGroupResponder.respond()` **每次呼叫時**依 `input.intent` 動態選（不在 constructor 綁死單一 model）。

---

## 5. Adapter 內部（`AnthropicPartnerGroupResponder`）

constructor 吃 primitives（不吃整個 config，與 config shape 解耦）：

```ts
new AnthropicPartnerGroupResponder({
  transport,      // 注入的 fetch
  apiKey,         // models.anthropicApiKey
  defaultModel,   // models.defaultModel
  researchModel,  // models.researchModel
})
```

`respond(input: PartnerGroupRespondInput): Promise<PartnerGroupRespondResult>`：

1. `const model = routePartnerModel(input.intent, { defaultModel, researchModel })`
2. `const system = buildPartnerGroupSystemPrompt(input)`（見 §7）
3. `transport('https://api.anthropic.com/v1/messages', { method:'POST', headers, body })`
   - headers：`x-api-key: <apiKey>`、`anthropic-version: 2023-06-01`、`content-type: application/json`
   - body：`{ model, max_tokens, system, messages: [{ role:'user', content: input.text }] }`
4. 解析 `content[0].text` → 回 `{ text, meta: { responder:'llm', model } }`

**硬邊界（不可違反）**：adapter **不讀 env、不 import LINE client、不送 LINE、不碰 quote write**。它只產文字；是否送出由 router + permission（`sendTarget`）決定。

---

## 6. Error / Fallback 決策（safe-default 但大聲可觀測）

**不採 fail-closed throw。** 理由：夥伴群回答是增強功能、不是 case persistence；失敗不應造成 LINE webhook 500 / redelivery storm（重送會對同一事件重複打 API 浪費 billing、並干擾同 webhook 內其他事件）。因此與 case persistence 不同，採 degraded stub。

### 6.1 config-time：mode=anthropic 但缺 key
- **不 throw、不讓 webhook 500**；factory 回「degraded stub responder」（非一般 stub）。
- log warning：`mode=anthropic but ANTHROPIC_API_KEY missing`。
- 回覆仍用安全 stub 文字（`STUB_PARTNER_GROUP_REPLY`）。
- meta：

```ts
{ responder: 'stub', degraded: true, error: 'missing_anthropic_api_key' }
```

### 6.2 runtime：API throw / 非 200 / response parse 失敗
- **不 throw、不讓 LINE webhook 500**；回安全 stub 文字。
- log error/warn，保留可讀錯誤（**不得 minified**）。
- meta：

```ts
{
  responder: 'stub',
  model: attemptedModel,
  degraded: true,
  error: 'anthropic_api_error' | 'anthropic_non_200' | 'anthropic_parse_error',
}
```

### 6.3 成功
```ts
{ responder: 'llm', model }
```

### 6.4 meta type 擴充（`responder.ts`）
`PartnerGroupRespondResult.meta` 由目前的 `{ responder; model?; confidence? }` 擴充為：

```ts
meta?: {
  responder: 'stub' | 'llm'
  model?: string
  confidence?: string
  degraded?: boolean
  error?: string
}
```

> 「降級到 stub」**不等於靜默失敗**：`degraded` + `error` + 非 minified log 讓問題可追，符合全域「外部 API 必 try-catch、錯誤不得 minified」規則。

---

## 7. System prompt 鎖（`system-prompt.ts`）

常數 + 輕量組裝函數 `buildPartnerGroupSystemPrompt(input)`。鎖死條款：

- 繁體中文。
- 你是清微旅行**內部夥伴群** AI 助理，協助 Eric / @Tsai / @Chun 整理與初判。
- 簡短、可執行、條列；不長篇。
- **不得**聲稱已回覆 / 已聯繫客人。
- **不得**聲稱已查到即時資料（航班 / 門票 / 天氣 / 即時庫存皆不可宣稱已查）。
- **不得**給正式報價數字或對外正式承諾。
- 需要正式結論時明講「需 Eric 拍板」。
- 不確定就說不確定，不要編。

---

## 8. 測試矩陣（全假 transport、不打真 API、不需真 key）

1. `model-routing.test.ts` — 純映射：`respond/analyze/unknown→default`；`draft/parse→research`；未知 action→default fallback。
2. `system-prompt.test.ts` — 斷言 prompt 含所有 guardrail 字句（防 prompt 被悄悄改弱）。
3. `anthropic-responder.test.ts` — 假 transport 斷言：URL、`x-api-key`=注入 key、`anthropic-version` header、`body.model`=routed model、`body.system`=鎖定 prompt、`messages[0].content`=`input.text`；成功解析 → `text` + `meta.responder='llm'` + `meta.model`；**error path（throw / 非 200 / parse 失敗）→ stub 文字 + `meta.degraded=true` + 對應 `error`，永不 throw**。
4. `responder-factory.test.ts` — mode 缺/`stub`→`stubPartnerGroupResponder`（identity）；`anthropic`+key→`AnthropicPartnerGroupResponder` 實例；`anthropic`+空 key→degraded stub（不 throw，`error:'missing_anthropic_api_key'`）；factory 不讀 `process.env`。
5. `webhook-runtime` seam — `setPartnerGroupResponder` 可覆蓋；預設 resolver→stub；spy 斷言 `defaultEventHandler` 有把 responder 傳進 `routeCommand`。
6. 回歸（只跑不新增）：既有 partner-group / dev-action-denied / quote dry-run / customer-no-auto-reply guardrails 全綠。

---

## 9. 變更檔清單（實作時，供下一 session 參照）

新增：
- `src/lib/line-agent/partner-group/model-routing.ts`
- `src/lib/line-agent/partner-group/system-prompt.ts`
- `src/lib/line-agent/partner-group/anthropic-responder.ts`
- `src/lib/line-agent/partner-group/responder-factory.ts`
- `src/lib/line-agent/partner-group/responder-config.ts` — 窄 selector `getPartnerResponderConfig`（解 B，§3.2），`ANTHROPIC_API_KEY` 可空、不 throw
- 對應 `__tests__/` 測試（§8 + §3.3 config/selector + factory 紅燈）

修改：
- `src/lib/line-agent/partner-group/responder.ts` — 擴充 `PartnerGroupRespondResult.meta`（§6.4）
- `src/lib/line-agent/config.ts` — **解 B 下，`partnerResponderMode` 的權威來源改為窄 selector（§3.2），不要同時塞進 `loadAgentConfig` 的 `ModelsConfig` 造成雙來源**。`config.ts` 本批可不動；§3 早期片段把 mode 放進 `ModelsConfig` 的寫法以 §3.2 為準覆蓋。
- `src/lib/line-agent/line/webhook-runtime.ts` — 新增 responder seam + lazy resolver（§2）

不動：`router.ts` / `handlers.ts` / `permissions.ts` / `src/app/api/agent/commands/route.ts` / `intent.ts`（classifier 維持 stub）。

---

## 10. 新增 env（部署備忘）

| env | 必填 | 預設 | 說明 |
|---|---|---|---|
| `AI_AGENT_PARTNER_RESPONDER_MODE` | 否（optional） | `stub` | `stub`\|`anthropic`；有 key 也不自動啟用，必須顯式設 `anthropic` |

> `ANTHROPIC_API_KEY` / `AI_AGENT_DEFAULT_MODEL` / `AI_AGENT_RESEARCH_MODEL` 為既有 required env，不在本批新增。
