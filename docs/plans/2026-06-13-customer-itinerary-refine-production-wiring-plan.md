# Customer Itinerary Refine — Production Wiring Implementation Plan

> **✅ 完成（2026-06-13，subagent-driven）**：4 task 全落地，commits `4476f37`（Task 1 seam）/`98ae64e`（Task 2 gate+adapter）/`ddd196b`（Task 3 觀測）。line-agent **1681 綠**（原 1674＋7 新），觸及檔 tsc 零錯。gate `AI_AGENT_CASE_INTAKE_REFINE_ENABLED` default off、關閘 byte-identical。下一步＝Eric 真群開閘驗收。
>
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `refineCustomerItineraryDraft`（已完成、含三道 deterministic guard 與 Haiku/Sonnet adapter）接進真實 LINE 路徑的 case_intake sufficient→draft seam，讓正式行程在事實逐字鎖死下被 LLM 暖化措辭。

**Architecture:** refine 只接 `case-intake-enrichment.ts` 的 sufficient→draft 分支（唯一同時握有 deterministic draft + constraints 之處）。沿用既有 optional-source 慣例：gate `AI_AGENT_CASE_INTAKE_REFINE_ENABLED`（default off）由 adapter factory 依 env 決定是否注入 `refineSource`；關閘或未注入 → enrichment 走原路 → byte-identical 現況。harness 本身已 fail-closed，cost cap 由共用 `callAnthropicMessages` 內建。

**Tech Stack:** TypeScript、Vitest、既有 `callAnthropicMessages`（transport + daily-cost-cap）、`createAnthropicRefineSource`。

設計依據：`docs/plans/2026-06-13-customer-itinerary-refine-production-wiring-design.md`

---

### Task 1: enrichment 接 refine（sufficient→draft seam）

**Files:**
- Modify: `src/lib/line-agent/partner-group/case-intake-enrichment.ts`（interface ~66-69；sufficient 分支 ~372-403）
- Test: `src/lib/line-agent/__tests__/case-intake-enrichment-refine.test.ts`（新建）

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { enrichCaseIntakeReply } from '../partner-group/case-intake-enrichment'
import { triageCaseIntake } from '../partner-group/case-intake-triage'
// 用一份「資訊足夠」的需求原文，讓 triage.flow === 'sufficient'。
// （參照既有 case-intake-enrichment 測試怎麼組 sufficient triage + draftSource 回 JSON。）

const SUFFICIENT_TEXT = /* 取自既有 sufficient fixture */ ''
const DRAFT_JSON = /* 取自既有 sufficient fixture 的 {constraints, requirements} JSON 字串 */ ''

function baseSources() {
  return {
    questionSource: async () => '[]',
    draftSource: async () => DRAFT_JSON,
  }
}

describe('enrichCaseIntakeReply — refine wiring', () => {
  it('採用 refined 草稿（refineSource 暖化只動開場/結尾）', async () => {
    const triage = triageCaseIntake(SUFFICIENT_TEXT)
    const det = await enrichCaseIntakeReply({
      triage, requirementText: SUFFICIENT_TEXT, sources: baseSources(),
    })
    const warmed = (s: string) => `親愛的貴賓您好 🌿\n\n${s}\n\n期待與您同遊清邁！`
    const refined = await enrichCaseIntakeReply({
      triage, requirementText: SUFFICIENT_TEXT,
      sources: { ...baseSources(), refineSource: async ({ deterministicDraft }) => warmed(deterministicDraft) },
    })
    expect(refined.enrichment).toBe('llm_draft')
    expect(refined.replyText).not.toBe(det.replyText)
    expect(refined.replyText).toContain('親愛的貴賓您好')
  })

  it('refineSource 被 guard 打回 → 退 deterministic，與無 refine byte-identical', async () => {
    const triage = triageCaseIntake(SUFFICIENT_TEXT)
    const det = await enrichCaseIntakeReply({ triage, requirementText: SUFFICIENT_TEXT, sources: baseSources() })
    const tampered = await enrichCaseIntakeReply({
      triage, requirementText: SUFFICIENT_TEXT,
      // 動了事實（Day 1 標題）→ structuralDiffGuard 打回 → fail-closed
      sources: { ...baseSources(), refineSource: async ({ deterministicDraft }) =>
        deterministicDraft.replace(/Day 1｜[^\n]*/, 'Day 1｜被竄改的主題') },
    })
    expect(tampered.replyText).toBe(det.replyText)
  })

  it('refineSource 缺席 → 與現況 byte-identical（regression 鎖）', async () => {
    const triage = triageCaseIntake(SUFFICIENT_TEXT)
    const a = await enrichCaseIntakeReply({ triage, requirementText: SUFFICIENT_TEXT, sources: baseSources() })
    const b = await enrichCaseIntakeReply({ triage, requirementText: SUFFICIENT_TEXT, sources: { ...baseSources() } })
    expect(a.replyText).toBe(b.replyText)
  })

  it('refineSource throw（模擬 cost cap 超額）→ deterministic', async () => {
    const triage = triageCaseIntake(SUFFICIENT_TEXT)
    const det = await enrichCaseIntakeReply({ triage, requirementText: SUFFICIENT_TEXT, sources: baseSources() })
    const capped = await enrichCaseIntakeReply({
      triage, requirementText: SUFFICIENT_TEXT,
      sources: { ...baseSources(), refineSource: async () => { throw new Error('budget') } },
    })
    expect(capped.replyText).toBe(det.replyText)
  })

  it('primary 打回、rescue 過 → 用 rescue 暖化版', async () => {
    const triage = triageCaseIntake(SUFFICIENT_TEXT)
    const warmed = (s: string) => `您好 🌿\n\n${s}\n\n清微旅行 敬上`
    const out = await enrichCaseIntakeReply({
      triage, requirementText: SUFFICIENT_TEXT,
      sources: {
        ...baseSources(),
        refineSource: async ({ deterministicDraft }) => deterministicDraft.replace(/Day 1｜[^\n]*/, 'Day 1｜竄改'),
        rescueRefineSource: async ({ deterministicDraft }) => warmed(deterministicDraft),
      },
    })
    expect(out.replyText).toContain('清微旅行 敬上')
  })
})
```

> 註：`SUFFICIENT_TEXT` / `DRAFT_JSON` 直接從既有 sufficient→draft 測試（搜尋 `enrichment === 'llm_draft'` 的測試檔）複用，不要自創一份新 fixture。

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/line-agent/__tests__/case-intake-enrichment-refine.test.ts`
Expected: FAIL（refineSource 型別不存在 / refine 未接，採用版測試掛掉）

**Step 3: Write minimal implementation**

3a. interface 加兩個 optional source（import 型別）：

```ts
import type { RefineDraftSource } from '../notion/customer-itinerary-refine'
import { refineCustomerItineraryDraft } from '../notion/customer-itinerary-refine'

export interface CaseIntakeEnrichmentSources {
  questionSource: CaseIntakeQuestionSource
  draftSource: CaseIntakeDraftSource
  /** 行程草稿暖化器（primary，cheap）。缺席 ⇒ 不 refine，byte-identical 現況。 */
  refineSource?: RefineDraftSource
  /** rescue（stronger），primary 被 guard 打回才試。 */
  rescueRefineSource?: RefineDraftSource
}
```

3b. sufficient 分支：把 `renderDraftReply(summary, composed.draft)` 之前插入 refine（leak 閘 ~396-398 之後）：

```ts
  if (scanCustomerForbiddenTerms(composed.draft).length > 0) {
    return fallback(triage, 'draft_leak')
  }

  let finalDraft = composed.draft
  if (sources.refineSource) {
    const refined = await refineCustomerItineraryDraft({
      deterministicDraft: composed.draft,
      constraints: plan.constraints,
      source: sources.refineSource,
      rescueSource: sources.rescueRefineSource,
    })
    finalDraft = refined.draft // harness fail-closed：失敗時 === composed.draft
  }

  return {
    replyText: renderDraftReply(summary, finalDraft),
    enrichment: 'llm_draft',
  }
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/line-agent/__tests__/case-intake-enrichment-refine.test.ts`
Expected: PASS（5 tests）

**Step 5: Commit**

```bash
git add src/lib/line-agent/partner-group/case-intake-enrichment.ts src/lib/line-agent/__tests__/case-intake-enrichment-refine.test.ts
git commit -m "feat(line-agent): case_intake sufficient→draft 接 refine — fail-closed 退 deterministic"
```

---

### Task 2: refine gate 旗標 + adapter factory 組 refine sources

**Files:**
- Modify: `src/lib/line-agent/partner-group/case-intake-surfacing.ts`（加 `isCaseIntakeRefineEnabled`，置於 `isCaseIntakeLlmEnabled` 旁）
- Modify: `src/lib/line-agent/partner-group/case-intake-llm-adapter.ts`（factory 條件式組 refine sources）
- Test: `src/lib/line-agent/__tests__/case-intake-llm-adapter-refine.test.ts`（新建）

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { createAnthropicCaseIntakeSources } from '../partner-group/case-intake-llm-adapter'
import { isCaseIntakeRefineEnabled } from '../partner-group/case-intake-surfacing'
import { createDailyCostCap } from '../observability/daily-cost-cap'

function deps(env: Record<string, string | undefined>) {
  return {
    transport: (async () => new Response('{}')) as unknown as typeof fetch,
    apiKey: 'sk-test',
    costCap: createDailyCostCap({ env, kv: undefined as any }), // 參照既有 adapter 測試怎麼造 cap
    env,
  }
}

describe('refine gate + factory', () => {
  it('gate off（預設）⇒ 不組 refineSource', () => {
    expect(isCaseIntakeRefineEnabled({})).toBe(false)
    const s = createAnthropicCaseIntakeSources(deps({}))
    expect(s.refineSource).toBeUndefined()
    expect(s.rescueRefineSource).toBeUndefined()
  })

  it('gate on ⇒ 組出 refineSource + rescueRefineSource', () => {
    const env = { AI_AGENT_CASE_INTAKE_REFINE_ENABLED: 'true' }
    expect(isCaseIntakeRefineEnabled(env)).toBe(true)
    const s = createAnthropicCaseIntakeSources(deps(env))
    expect(typeof s.refineSource).toBe('function')
    expect(typeof s.rescueRefineSource).toBe('function')
  })
})
```

> 註：`createDailyCostCap` 的造法、以及「超預算 throw」的斷言，直接照 `case-intake-llm-adapter` 既有測試的 pattern 複用。

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/line-agent/__tests__/case-intake-llm-adapter-refine.test.ts`
Expected: FAIL（`isCaseIntakeRefineEnabled` 未匯出 / `refineSource` 永遠 undefined）

**Step 3: Write minimal implementation**

3a. `case-intake-surfacing.ts`，緊接 `isCaseIntakeLlmEnabled`：

```ts
/** refine 暖化子閘（疊在 LLM enrichment 之上）。exactly "true"，default off。 */
export function isCaseIntakeRefineEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return (env.AI_AGENT_CASE_INTAKE_REFINE_ENABLED ?? '').trim() === 'true'
}
```

3b. `case-intake-llm-adapter.ts`，在 factory 回傳前依 gate 組 refine sources（callModel 走同一個 `callAnthropicMessages`，costCap 內建）：

```ts
import { createAnthropicRefineSource } from '../notion/llm-refine-adapter'
import { resolveRefineModel, resolveRescueRefineModel } from '../notion/llm-refine-adapter'
import { isCaseIntakeRefineEnabled } from './case-intake-surfacing'

const REFINE_MAX_TOKENS = 2048

// …createAnthropicCaseIntakeSources 內，callModel 既有定義之後：

function refineCallModel(model: string) {
  return async ({ system, user }: { system: string; user: string; model: string }) => {
    const { text } = await callAnthropicMessages(
      { model, system, messages: [{ role: 'user', content: user }], maxTokens: REFINE_MAX_TOKENS,
        fallbackInputTokens: Math.ceil((system.length + user.length) / 4), truncation: 'ignore' },
      { transport: deps.transport, apiKey: deps.apiKey, costCap: deps.costCap, log,
        makeError: (code) => new CaseIntakeLlmError(code) },
    )
    return text
  }
}

const refineEnabled = isCaseIntakeRefineEnabled(deps.env)
const refineSource = refineEnabled
  ? createAnthropicRefineSource({ apiKey: deps.apiKey, env: deps.env,
      model: resolveRefineModel({ env: deps.env }), callModel: refineCallModel(resolveRefineModel({ env: deps.env })) })
  : undefined
const rescueRefineSource = refineEnabled
  ? createAnthropicRefineSource({ apiKey: deps.apiKey, env: deps.env,
      model: resolveRescueRefineModel({ env: deps.env }), callModel: refineCallModel(resolveRescueRefineModel({ env: deps.env })) })
  : undefined

return {
  questionSource: (req) => callModel(buildQuestionPolishPrompt(req), QUESTION_MAX_TOKENS),
  draftSource: (req) => callModel(buildItineraryDraftPrompt(req), DRAFT_MAX_TOKENS),
  ...(refineSource ? { refineSource } : {}),
  ...(rescueRefineSource ? { rescueRefineSource } : {}),
}
```

> 若 `createAnthropicRefineSource` 的 `callModel` 簽章與此略有出入，以 `llm-refine-adapter.ts` 實際型別為準（`RefineModelCall = {system,user,model}`）。

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/line-agent/__tests__/case-intake-llm-adapter-refine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/line-agent/partner-group/case-intake-surfacing.ts src/lib/line-agent/partner-group/case-intake-llm-adapter.ts src/lib/line-agent/__tests__/case-intake-llm-adapter-refine.test.ts
git commit -m "feat(line-agent): refine gate AI_AGENT_CASE_INTAKE_REFINE_ENABLED + adapter 組 Haiku/Sonnet refine sources（cost cap 內建）"
```

---

### Task 3: 觀測 — route_decision 帶 refine 結果

**Files:**
- Modify: `case-intake-enrichment.ts`（`CaseIntakeEnrichmentResult` 加 optional `refine` 欄位）
- Modify: `case-intake-surfacing.ts`（log 帶 refine/tier/masked reasons）
- Test: 擴充 Task 1 測試檔，斷言回傳含 `refine.used` / `refine.tier`

**Step 1-4:** 在 enrichment sufficient 分支回傳加 `refine: { used, tier, rejectionReasons }`（取自 `RefineResult`，rejectionReasons 為 mask-safe 結構碼）；surfacing 的成功 log 多印這三欄。測試斷言 `out.refine?.used === 'refined'` / 打回時 `=== 'deterministic'`。

**Step 5: Commit**

```bash
git commit -am "feat(line-agent): route_decision 帶 refine used/tier/masked reasons"
```

---

### Task 4: 全測 + 文件

**Step 1:** `npx vitest run src/lib/line-agent`（期望全綠，含原 1656 不退）
**Step 2:** `npx tsc --noEmit`（型別過）
**Step 3:** 更新 memory `project_line_oa_agent_m1.md`：refine 已接 production（gate default off）、待真群開閘驗收。
**Step 4:** docs commit：

```bash
git commit -am "docs(line-agent): refine production wiring 落地 — gate default off，待真群開閘驗收"
```

---

## 驗收標準

- gate off（default）：`npx vitest run src/lib/line-agent` 全綠，sufficient→draft 輸出與本刀前 byte-identical。
- gate on + 正常 refine：replyText 為暖化版，所有事實逐字 == composer draft。
- refine 任何失敗（guard 打回 / source throw / cost cap）：退 deterministic，永不輸出貼了會壞的行程。
- 不洩漏：已由 `buildRefinePrompt` 只吃 draft string + 輸入/輸出 leak guard 保證（本刀不新增）。
