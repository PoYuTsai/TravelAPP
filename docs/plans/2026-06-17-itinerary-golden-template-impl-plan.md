# 行程類截圖走 Golden 範本 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans（或 superpowers:subagent-driven-development）逐 task 實作本 plan。
> 設計來源：`docs/plans/2026-06-17-line-agent-itinerary-golden-template-design.md`（brainstorm 定案）。
> 分支：`codex/line-oa-agent-mvp`（branch as-is，暫不 merge/PR）。

**Goal:** 夥伴在群裡貼客人截圖 tag bot，若是行程類需求，bot 以「兩套 golden 招牌範本為主幹、套日期、依需求微調」產出可複製草稿，過 `gateCustomerItineraryDraft` 後兩段回群；非行程類維持現有 agentic smart-reply（byte-identical）。

**Architecture:** 不新造 responder。vision 流程在 fork 點（`vision-smart-reply-surfacing.ts` step 5）先用現有 intent classifier 判 brief，`draft` 分支複用 `AnthropicPartnerGroupResponder` 的 `intent.action='draft'` 路（已內建 golden 注入→gate→重產→降級），把草稿包成現有兩段格式；`respond` 分支不動。§5.4 反轉落在 `itinerary-reference-template.ts` + `selectItineraryReference`：兩套 golden 為主幹、RAG 相似案降為選配微調素材。draft 路一律關 web_search。

**Tech Stack:** TypeScript / vitest（`npm run test:run`）/ Anthropic Messages API / 既有 line-agent 模組。測試在 `src/lib/line-agent/__tests__/`，fixture 在 `src/lib/line-agent/notion/__fixtures__/`。

---

## 架構決策（plan author 定，review 可否決）

- **AD-1 複用 draft responder**：vision-draft 不另造 LLM 迴圈，複用 `AnthropicPartnerGroupResponder`（`anthropic-responder.ts:365` 的 `intent.action==='draft'` tripwire）。新增的 `draftAgent` 只組 need 文字 + 包兩段。理由：gate/重產/降級/成本閘已驗證且綠，重造＝重複風險面。
- **AD-2 兩套 golden 一起餵**：§4 兩套範本是「帶空白骨架」（非過 lint 成品），進 `itinerary-reference-template.ts`。`selectItineraryReference` 改成「兩套 golden 主幹恆注入 + RAG 相似案（若有，sanitize 過）當『可微調素材』附後」。`source` 訊號：`template`＝只有 golden、`case`＝golden+RAG 相似案。
- **AD-3 兩段對映**：golden 草稿正文＝對外段（`OUTBOUND_HEADER`）；`brief.gaps`（截圖缺的航班/住宿/上車點）＝內部待確認段（`INTERNAL_HEADER`）。複用 `ensureTwoSegments`（`smart-reply-agent.ts:53`）。
- **AD-4 web 全關**：draft intent 一律不掛 web_search（改 `anthropic-responder.ts:188` 的 `allowWebSearch`）。

## 護欄（每 task 不可破）

- 三閘 default off ⇒ gate-off 與現行 **byte-identical**（沿用 `itinerary-reference-wiring.ts:20`）。
- bot 只回夥伴群；客人 OA 永不自動回。
- responder 永不讀 env、永不 import LINE client / Notion client（env 由 factory/composition root 擁有）。
- 每個外部呼叫 try-catch、fail-open/fail-closed 依現有紀律。

## Task 執行順序（依 §8 風險：先資產與反轉、再日期、再接線）

1. Two golden skeletons（資產）
2. `selectItineraryReference` 反轉（§5.4，最高風險）
3. draft 路關 web（§5.6）
4. 日期 OCR 回歸修復（§5.1，最高風險）
5. vision→intent classify fork（§5.2）
6. `draftAgent`：組 need + 包兩段（AD-1/AD-3）
7. Composition root 接線 + gate-off byte-identical（§5.7 + 護欄）

---

### Task 1: 兩套 Golden 骨架常數

**Files:**
- Modify: `src/lib/line-agent/notion/itinerary-reference-template.ts`
- Test: `src/lib/line-agent/__tests__/itinerary-reference-template.test.ts`（若不存在則 Create）

**前置**：先 `Read` 現有 `itinerary-reference-template.ts`，確認 `ITINERARY_TEMPLATE_SKELETON` 的 export 形狀與既有 drift-guard 測試（§itinerary-reference-source.ts:43 提到 drift-guard）。新常數比照其風格。

**Step 1: 寫失敗測試**

新增測試斷言兩個新 export 的結構不變量（不是逐字比對全文，避免脆弱；只鎖「會被下游依賴的結構」）：

```typescript
import { describe, it, expect } from 'vitest'
import {
  GOLDEN_CHIANGMAI_FAMILY_5D4N,
  GOLDEN_NORTHERN_DEEP_6D5N,
} from '../notion/itinerary-reference-template'

describe('golden itinerary skeletons', () => {
  it('清邁親子 5D4N 有 Day 1..Day 5 連續標題', () => {
    for (let d = 1; d <= 5; d++) {
      expect(GOLDEN_CHIANGMAI_FAMILY_5D4N).toContain(`Day ${d}｜`)
    }
    expect(GOLDEN_CHIANGMAI_FAMILY_5D4N).not.toContain('Day 6｜')
  })

  it('泰北深度 6D5N 有 Day 1..Day 6 連續標題', () => {
    for (let d = 1; d <= 6; d++) {
      expect(GOLDEN_NORTHERN_DEEP_6D5N).toContain(`Day ${d}｜`)
    }
    expect(GOLDEN_NORTHERN_DEEP_6D5N).not.toContain('Day 7｜')
  })

  it('兩套都標 header 占位（日期/人數）讓 LLM 套', () => {
    for (const g of [GOLDEN_CHIANGMAI_FAMILY_5D4N, GOLDEN_NORTHERN_DEEP_6D5N]) {
      expect(g).toMatch(/日期/)
      expect(g).toMatch(/人數/)
    }
  })
})
```

**Step 2: 跑測試確認 fail**

Run: `npm run test:run -- itinerary-reference-template`
Expected: FAIL（`GOLDEN_CHIANGMAI_FAMILY_5D4N` is not exported）

**Step 3: 加常數**

在 `itinerary-reference-template.ts` export 兩個常數，內容**逐字**取自設計 doc §4.1（5D4N）與 §4.2（6D5N，Day1–6）。用 template literal，保留原換行。註明來源：

```typescript
/** 清邁親子 5 天 4 夜經典套餐骨架（Eric 招牌設計，design 2026-06-17 §4.1）。 */
export const GOLDEN_CHIANGMAI_FAMILY_5D4N = `<清邁5天4夜>
📅 日期：2026//～/
👨‍👩‍👧‍👦 人數：幾大幾小（幾歲，身高，需不需要兒童座椅，有無長輩，有無特殊備註事項）
... (逐字貼 §4.1 全文，到 Day 5 送機行)`

/** 泰北芳縣深度 6 天 5 夜骨架（design 2026-06-17 §4.2）。 */
export const GOLDEN_NORTHERN_DEEP_6D5N = `Day 1｜抵達清邁 -> 湄登 -> 清道 -> 芳縣
... (逐字貼 §4.2 全文，Day 1–6)`
```

**Step 4: 跑測試確認 pass**

Run: `npm run test:run -- itinerary-reference-template`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/line-agent/notion/itinerary-reference-template.ts src/lib/line-agent/__tests__/itinerary-reference-template.test.ts
git commit -m "feat(line-agent): 加兩套 golden 行程骨架常數（5D4N／6D5N）"
```

---

### Task 2: `selectItineraryReference` 反轉 — golden 主幹 + RAG 微調素材

**Files:**
- Modify: `src/lib/line-agent/notion/itinerary-reference-source.ts:51-58`
- Test: `src/lib/line-agent/__tests__/itinerary-reference-source.test.ts`

**前置**：`Read` 現有 `itinerary-reference-source.test.ts:51-123`，看清現有「RAG 案優先／無命中退 template」的測試斷言——這些斷言的語意要**反轉**（不是刪掉重寫，是改成新優先序）。

**Step 1: 寫失敗測試**

新行為：無論有無 RAG 命中，skeleton **恆含兩套 golden**；有命中時額外附「可微調素材」段、`source==='case'`；無命中時只有兩套 golden、`source==='template'`。

```typescript
it('無 RAG 命中：skeleton 含兩套 golden，source=template', () => {
  const index = makeEmptyIndex() // 沿用既有 helper
  const r = selectItineraryReference(index, '清邁親子五天')
  expect(r.source).toBe('template')
  expect(r.skeleton).toContain('Day 5｜')        // 5D4N 在
  expect(r.skeleton).toContain('清道溶洞')        // 6D5N 在（泰北 Day1 特徵）
})

it('有 RAG 命中：兩套 golden 仍在，且附相似案微調素材，source=case', () => {
  const index = makeIndexWithCase(/* 既有 fixture */)
  const r = selectItineraryReference(index, '清邁親子五天')
  expect(r.source).toBe('case')
  expect(r.skeleton).toContain('Day 5｜')        // golden 主幹仍恆在
  expect(r.skeleton).toMatch(/微調素材|參考真實案例/) // RAG 段有標籤
})
```

**Step 2: 跑測試確認 fail**

Run: `npm run test:run -- itinerary-reference-source`
Expected: FAIL（現行回單一 skeleton，不含兩套 golden）

**Step 3: 改實作**

```typescript
import {
  GOLDEN_CHIANGMAI_FAMILY_5D4N,
  GOLDEN_NORTHERN_DEEP_6D5N,
} from './itinerary-reference-template'

/** 兩套 golden 主幹恆注入；LLM 依需求自選一套再套日期/微調（design §2 #4）。 */
function goldenTrunk(): string {
  return [
    '【標準範本 A：清邁親子 5 天 4 夜】',
    GOLDEN_CHIANGMAI_FAMILY_5D4N,
    '',
    '【標準範本 B：泰北芳縣深度 6 天 5 夜】',
    GOLDEN_NORTHERN_DEEP_6D5N,
  ].join('\n')
}

export function selectItineraryReference(index: RagIndex, need: string): SelectedReference {
  const trunk = goldenTrunk()
  const hits = retrieveRagCases(index, need)
  for (const hit of hits) {
    const ref = toItineraryReference(hit)
    if (ref) {
      // golden 為主幹、RAG 相似案降為「可微調素材」附後（design §5.4 反轉）。
      const skeleton = `${trunk}\n\n【參考真實案例（可微調素材，非主幹）】\n${ref.skeleton}`
      return { source: 'case', skeleton }
    }
  }
  return { source: 'template', skeleton: trunk }
}
```

> 註：原 `templateSkeleton()` / `ITINERARY_TEMPLATE_SKELETON` import 若已無其他使用者，移除以保 DRY；若 drift-guard 測試仍引用則保留。執行時 grep 確認。

**Step 4: 跑測試確認 pass**

Run: `npm run test:run -- itinerary-reference-source itinerary-reference-template`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/line-agent/notion/itinerary-reference-source.ts src/lib/line-agent/__tests__/itinerary-reference-source.test.ts
git commit -m "feat(line-agent): selectItineraryReference 反轉為 golden 主幹＋RAG 微調素材"
```

---

### Task 3: draft intent 一律關 web_search

**Files:**
- Modify: `src/lib/line-agent/partner-group/anthropic-responder.ts:188-191`
- Test: `src/lib/line-agent/__tests__/anthropic-responder.test.ts`

**Step 1: 寫失敗測試**

```typescript
it('draft intent 永不掛 web_search（即使 webSearchEnabled）', async () => {
  const captured: any[] = []
  const transport = makeTransportCapturing(captured) // 既有 fake transport helper
  const r = new AnthropicPartnerGroupResponder({
    /* ...既有 deps... */ webSearchEnabled: true,
  })
  await r.respond(makeInput({ intent: { action: 'draft', confidence: 'high', source: 'deterministic' }, botDirected: true }))
  const body = JSON.parse(captured[0].body)
  expect(body.tools).toBeUndefined() // draft 不帶 web tool
})
```

**Step 2: 跑測試確認 fail**

Run: `npm run test:run -- anthropic-responder`
Expected: FAIL（現行 draft 仍會掛 web tool）

**Step 3: 改實作**

```typescript
const allowWebSearch =
  this.webSearchEnabled &&
  input.intent.action !== 'draft' &&            // ← 新增：行程類關 web（design §5.6）
  input.event.sourceChannel !== 'line_oa' &&
  (input.botDirected ?? input.event.mentionsBot) === true
```

**Step 4: 跑測試確認 pass + 全 responder 測試不回歸**

Run: `npm run test:run -- anthropic-responder`
Expected: PASS（含既有 respond-路徑 web 測試不變）

**Step 5: Commit**

```bash
git add src/lib/line-agent/partner-group/anthropic-responder.ts src/lib/line-agent/__tests__/anthropic-responder.test.ts
git commit -m "feat(line-agent): 行程類 draft intent 一律關 web_search"
```

---

### Task 4: 日期 OCR 回歸修復（7/1–7/5 不可讀成跨月）

**Files:**
- Modify: `src/lib/line-agent/partner-group/vision-need-extraction.ts:50-59`（system instruction）
- Test: `src/lib/line-agent/__tests__/vision-need-extraction.test.ts`

**前置**：`Read` `vision-need-extraction.ts` 全檔。日期是 LLM 在 system prompt 層抽進 `knownFacts`，**無獨立 parser**。修復＝強化 prompt 指令 + 加 fixture 回歸。先確認測試怎麼注入 fake vision 回傳（stub transport 回固定 JSON），回歸測試要鎖「給定模型回傳含 `7/1-7/5` 時，knownFacts 保留為 5 天連續區間、不得出現跨月字樣」。

**Step 1: 寫失敗測試（回歸）**

```typescript
it('7/1-7/5 抽成同月 5 天區間，不誤判跨月', async () => {
  const need = makeVisionNeedSource(stubReturning({
    isConversation: true,
    summary: '客人要 7/1 到 7/5 清邁親子行程',
    knownFacts: ['日期：7/1-7/5（5 天）'],
    gaps: ['航班', '住宿'],
  }))
  const brief = await need(fakeImage())
  expect(brief.knownFacts.join()).toContain('7/1-7/5')
  expect(brief.knownFacts.join()).not.toMatch(/1月7日|跨.*月|7月5日.*1月/)
})
```

> 說明：此測試鎖的是「抽取層不破壞已正確的日期 + prompt 不引導跨月誤讀」。模型端真實誤讀屬 prompt 品質，由 Step 3 prompt 強化處理；測試提供 byte-level 防回歸網。

**Step 2: 跑測試確認狀態**

Run: `npm run test:run -- vision-need-extraction`
Expected: 視現行 stub 而定；若既有 stub 已能過，補一條「模型若回 `7/1-7/5` 原樣保留」的最小斷言使其有意義。

**Step 3: 強化 system instruction**

在 vision-need-extraction 的 date 抽取指令補一句明確規則（避免 `7/1–7/5` 被讀成 `1月7日–7月5日`）：

```
- 日期一律照截圖數字原樣記，斜線格式 M/D 視為「月/日」，不得把 7/1-7/5 解讀成跨月或跨年；
  同段內前後數字屬同一年同一月區間時，明確記成「7/1～7/5（共N天）」。
```

**Step 4: 跑測試確認 pass**

Run: `npm run test:run -- vision-need-extraction`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/line-agent/partner-group/vision-need-extraction.ts src/lib/line-agent/__tests__/vision-need-extraction.test.ts
git commit -m "fix(line-agent): vision 日期抽取防 7/1-7/5 誤判跨月＋回歸測試"
```

---

### Task 5: vision→intent classify fork（draft vs respond）

**Files:**
- Modify: `src/lib/line-agent/partner-group/vision-smart-reply-surfacing.ts:54-61,141-143`
- Test: `src/lib/line-agent/__tests__/vision-smart-reply-surfacing.test.ts`

**前置**：`Read` `commands/intent.ts` 的 `classifyIntent` 簽名與 `vision-smart-reply-surfacing.test.ts` 現有測試（怎麼注入 fake `agent`）。

**設計**：在 `CreateVisionSmartReplyResponderDeps` 加兩個注入：`classify`（brief.summary → 'draft' | 'respond'）與 `draftAgent`（Task 6 產出，signature 同 `agent`）。fork 在 step 5：

**Step 1: 寫失敗測試**

```typescript
it('行程類 brief → 走 draftAgent，不走 agent', async () => {
  const agent = vi.fn()
  const draftAgent = vi.fn().mockResolvedValue({ text: '草稿', meta: { responder: 'llm' } })
  const responder = createVisionSmartReplyResponder({
    fetchImage: okImage, need: okBrief({ summary: '想排清邁五天行程' }),
    classify: async () => 'draft', agent, draftAgent,
  })
  await responder.respond(makeInput())
  expect(draftAgent).toHaveBeenCalledOnce()
  expect(agent).not.toHaveBeenCalled()
})

it('開放題 brief → 走 agent，不走 draftAgent（現行行為不變）', async () => {
  const agent = vi.fn().mockResolvedValue({ text: '回覆', meta: { responder: 'llm' } })
  const draftAgent = vi.fn()
  const responder = createVisionSmartReplyResponder({
    fetchImage: okImage, need: okBrief({ summary: '清邁現在天氣如何' }),
    classify: async () => 'respond', agent, draftAgent,
  })
  await responder.respond(makeInput())
  expect(agent).toHaveBeenCalledOnce()
  expect(draftAgent).not.toHaveBeenCalled()
})
```

**Step 2: 跑測試確認 fail**

Run: `npm run test:run -- vision-smart-reply-surfacing`
Expected: FAIL（deps 無 classify/draftAgent）

**Step 3: 改實作**

deps 加 `classify: (summary: string) => Promise<'draft' | 'respond'>` 與 `draftAgent: SmartReplyAgent`。step 5 改：

```typescript
// 5. 真客人對話 ⇒ 先判行程類 vs 開放題（design 決策 #2）。
input.log?.('route_decision', { path: 'vision_intake' })
const kind = await deps.classify(brief.summary)
if (kind === 'draft') {
  input.log?.('vision_intent', { kind: 'draft' })
  return await deps.draftAgent(brief, input)
}
input.log?.('vision_intent', { kind: 'respond' })
return await deps.agent(brief, input)
```

> fail-open：`classify` 內部失敗應收斂成 `'respond'`（保守走現行 agentic 路），由 Task 7 的 composition root wiring 保證（classify wrapper try-catch）。本 task 測試以注入 stub 為主。

**Step 4: 跑測試確認 pass**

Run: `npm run test:run -- vision-smart-reply-surfacing`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/line-agent/partner-group/vision-smart-reply-surfacing.ts src/lib/line-agent/__tests__/vision-smart-reply-surfacing.test.ts
git commit -m "feat(line-agent): vision 流程接 intent classify，行程類分叉 draftAgent"
```

---

### Task 6: `draftAgent` — 組 need + 複用 draft responder + 包兩段

**Files:**
- Create: `src/lib/line-agent/partner-group/vision-draft-agent.ts`
- Test: `src/lib/line-agent/__tests__/vision-draft-agent.test.ts`

**設計（AD-1/AD-3）**：`createVisionDraftAgent({ responder })` 回一個 `SmartReplyAgent`。內部：
1. 把 `brief`（summary + knownFacts）組成 need 文字。
2. 構造 `input2 = { ...input, intent: { action: 'draft', confidence: 'high', source: 'deterministic' }, text: need }`，呼叫注入的 `responder.respond(input2)`（＝`AnthropicPartnerGroupResponder`，已含 golden 注入→gate→重產→降級）。
3. 把回傳正文當對外段、`brief.gaps` 當內部待確認段，用 `ensureTwoSegments` 收尾。

**Step 1: 寫失敗測試**

```typescript
import { OUTBOUND_HEADER, INTERNAL_HEADER } from '../partner-group/smart-reply-agent'

it('draftAgent：以 draft intent 呼叫 responder 並包成兩段', async () => {
  const responder = { respond: vi.fn().mockResolvedValue({ text: '<清邁5天4夜>\nDay 1｜...', meta: { responder: 'llm' } }) }
  const draftAgent = createVisionDraftAgent({ responder })
  const out = await draftAgent(
    { isConversation: true, summary: '清邁親子五天', knownFacts: ['日期：7/1-7/5'], gaps: ['航班', '住宿'] },
    makeInput()
  )
  // responder 收到 draft intent + brief 組出的 need 文字
  const calledInput = responder.respond.mock.calls[0][0]
  expect(calledInput.intent.action).toBe('draft')
  expect(calledInput.text).toContain('7/1-7/5')
  // 兩段：對外段含草稿、內部段含 gaps
  expect(out.text).toContain(OUTBOUND_HEADER)
  expect(out.text).toContain(INTERNAL_HEADER)
  expect(out.text).toContain('航班')
})

it('responder 降級時仍回兩段、不 throw', async () => {
  const responder = { respond: vi.fn().mockResolvedValue({ text: '草稿⚠️', meta: { responder: 'llm', degraded: true, error: 'itinerary_gate_failed' } }) }
  const out = await createVisionDraftAgent({ responder })(
    { isConversation: true, summary: 's', knownFacts: [], gaps: [] }, makeInput()
  )
  expect(out.text).toContain(OUTBOUND_HEADER)
})
```

**Step 2: 跑測試確認 fail**

Run: `npm run test:run -- vision-draft-agent`
Expected: FAIL（檔案不存在）

**Step 3: 寫實作**

```typescript
import type { PartnerGroupResponder, PartnerGroupRespondInput, PartnerGroupRespondResult } from './responder'
import type { VisionNeedBrief } from './vision-need-extraction'
import { OUTBOUND_HEADER, INTERNAL_HEADER, ensureTwoSegments } from './smart-reply-agent'

export interface CreateVisionDraftAgentDeps {
  /** 行程類 draft responder（＝AnthropicPartnerGroupResponder，已內建 golden 注入＋gate）。 */
  responder: PartnerGroupResponder
}

/** brief → 行程類草稿（兩段）。複用 draft responder 的 golden/gate 機制（AD-1）。 */
export function createVisionDraftAgent(deps: CreateVisionDraftAgentDeps) {
  return async (
    brief: VisionNeedBrief,
    input: PartnerGroupRespondInput
  ): Promise<PartnerGroupRespondResult> => {
    const need = [brief.summary, ...brief.knownFacts].filter(Boolean).join('\n')
    const draftInput: PartnerGroupRespondInput = {
      ...input,
      text: need,
      intent: { action: 'draft', confidence: 'high', source: 'deterministic' },
    }
    const result = await deps.responder.respond(draftInput)

    const gapsLine =
      brief.gaps.length > 0
        ? brief.gaps.map((g) => `・${g}`).join('\n')
        : '無'
    const twoSegment = `${ensureTwoSegments(result.text)}\n\n${INTERNAL_HEADER}\n待確認（截圖未提及、報價/排程需要）：\n${gapsLine}`
    return { ...result, text: twoSegment }
  }
}
```

> 註：`ensureTwoSegments` 已保證對外段有 `OUTBOUND_HEADER`；此處再補一個 `INTERNAL_HEADER` 段。若 `result.text` 已含 `INTERNAL_HEADER`（理論上 draft responder 不會），執行時改用「只在缺時補」的判斷（比照 `ensureTwoSegments` 寫法）。

**Step 4: 跑測試確認 pass**

Run: `npm run test:run -- vision-draft-agent`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/line-agent/partner-group/vision-draft-agent.ts src/lib/line-agent/__tests__/vision-draft-agent.test.ts
git commit -m "feat(line-agent): vision-draft-agent 複用 draft responder 並包兩段"
```

---

### Task 7: Composition root 接線 + gate-off byte-identical

**Files:**
- Modify: `src/lib/line-agent/partner-group/responder-factory.ts`（或 vision responder 的 wiring 點）
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`（vision responder 組裝處）
- Test: `src/lib/line-agent/__tests__/webhook-runtime-vision-smart-reply.test.ts`、`src/lib/line-agent/__tests__/itinerary-reference-wiring.test.ts`

**前置**：`Read` `responder-factory.ts`、`webhook-runtime.ts` 中 `createVisionSmartReplyResponder` 的組裝點，與 `itinerary-reference-wiring.ts:20` 的三閘讀法。確認 `AI_AGENT_NOTION_RAG_ENABLED` 關閉時的 byte-identical 不變量怎麼被測。

**接線內容**：
1. 組一個 `classify` wrapper：呼叫現有 `classifyIntent`（`commands/intent.ts`），map `action==='draft'` → `'draft'`、其餘 → `'respond'`，try-catch fail-open 回 `'respond'`。
2. 組 `draftAgent = createVisionDraftAgent({ responder: <AnthropicPartnerGroupResponder 實例，注入 itineraryReferenceSource + webSearchEnabled:false> })`。
3. 把 `classify` / `draftAgent` 傳進 `createVisionSmartReplyResponder`。
4. **三閘關**（`AI_AGENT_NOTION_RAG_ENABLED` 非 'true'）時：`itineraryReferenceSource` 不注入 → draft responder 無 golden 注入 → 行為與現行 byte-identical（draft 仍可跑但無 golden 骨架）。確認 classify fork 在閘關時不改變 `respond` 路徑輸出。

**Step 1: 寫失敗/守門測試**

```typescript
it('gate-off：vision respond 路徑與現行 byte-identical', async () => {
  // 既有 byte-identical harness：閘關時 system prompt / 輸出不變
})
it('gate-on：行程類截圖觸發 draftAgent，輸出含兩段且過 gate', async () => {
  // 端到端：fake image → brief(draft) → draftAgent → 兩段
})
```

**Step 2: 跑測試確認 fail**

Run: `npm run test:run -- webhook-runtime-vision-smart-reply itinerary-reference-wiring`
Expected: FAIL

**Step 3: 接線實作**（依前置讀到的實際結構填）

**Step 4: 全套件回歸**

Run: `npm run test:run`
Expected: 全綠（含 1748+ 既有測試不回歸）

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(line-agent): 行程類 golden 範本路 composition root 接線（gate-off byte-identical）"
```

---

## 收尾

- 全套件綠後，更新設計 doc §8 標記實作完成、更新 memory `project_line_oa_agent_m1.md`。
- 開閘真群驗收（flip `AI_AGENT_NOTION_RAG_ENABLED=true`）＝對外步驟，需 Eric＋查 `.env.local`，不在本 plan 自動執行。
- **明確排除**（YAGNI / 另案）：web search 搜尋品質、報價計算器串接、非行程開放題 agentic 路徑改動。
```
