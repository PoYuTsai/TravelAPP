# 刀A — 輸入理解＋收錄條件刀 實作計畫

> **狀態：已完成（2026-06-12）— 全部 10 個 Task 實作完畢。**
>
> Commits（刀A 系列）：`8e78da6`（plan）、`c74e45e`（T1 收錄三門）、`b048c07`（T2 引用 context）、
> `1c3d012`（T3 確認狀態 store）、`47b19af`（T3 補強）、`6836680`（T4 零信任解析）、`76d5185`（T4 補強）、
> `19921e2`（T5 adapter）、`0883f7b`（T5 補強）、`baae739`（T6 orchestrator）、`10bee9f`（T6 補強）、
> `594320d`（T7 router seam）、`7e45cf0`（T8 webhook 接線）、`06d1c26`（T9 CLI）、`fac107b`（T9 補強）、
> `9955711`（T10 docs）、`96a7a41`（final review 補強）。
>
> Review 補強（計畫外、review 驅動）：confirmation store overwrite/TTL 契約測試、`newAnswer` 500 字上限、
> prompt confidence-mandate＋「編號」術語統一、`store_read_failed` log event、確認寫入失敗回 status error、
> CLI flag 解析防呆＋fixture 欄位驗證。
>
> Final review 補強（`96a7a41`）：複述確認綁 batch identity — `DistillApprovalConfirmation.batchCreatedAt`
> 比對 `batch.createdAt`（stale → 作廢＋兜底文案，不套錯候選）；re-distill 寫新 batch 時源頭作廢舊確認。
>
> 實作偏差（與計畫原文不同處，皆已在各 Task 文件化）：
> - confirmation store 沿用 memory-store 無 TTL 慣例（TTL 由 KV 層處理）
> - `stripCodeFence` 用 regex-match 風格（非計畫示意的 slice）
> - `getApprovalIntentSource` 不收 log 參數（呼叫端自行記錄）
> - low-confidence 複述確認 note 含 `approve_all` 情境
> - KV 只在真呼叫路徑 required（gate off / regex 命中路徑不要求 KV）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 沉澱批准從「三條全句 regex」升級為三層接話（regex → Haiku intent parser → deterministic 驗證），收錄條件放寬為三門，引用 context 進 responder prompt，並附 CLI 黑箱內測入口。

**Architecture:** 層1 沿用 `parseDistillApproval`（零成本）；層2 新增 fetch-shaped Anthropic adapter（mirror `distill-llm-adapter.ts`：cost cap 必接、fixed-code error、截斷偵測）＋零信任 JSON 解析純函式；層3 直接走既有 `applyDistillApproval`（超界整批拒絕紀律現成）。信心 low 走複述確認（KV TTL 10 分鐘，確認語必須引用複述句）。所有新路徑被「botDirected＋pending batch 存在」雙閘鎖住，日常聊天零 LLM 呼叫。

**Tech Stack:** TypeScript（strict）、vitest、Upstash KV（`KvClient`）、Anthropic Messages API（raw fetch，不用 SDK）。

**設計依據:** `docs/plans/2026-06-12-distill-knife-a-input-understanding-design.md`（定稿）。

**不做（YAGNI，照設計 §6）:**
- 不動 `applyDistillApproval` 的套用狀態機（移動/flush 邏輯原樣）
- 不做多輪對話式批准（一句話＋至多一次複述確認）
- 不搬群、不開新群測；OA 1:1 不開
- 不抽共用 `callAnthropicMessages`（那是後面獨立的刀，本刀照 mirror 慣例複製）

**每個 Task 完成即 commit＋push（全域憲法：commit 後立即 push）。Branch: `codex/line-oa-agent-mvp`，不 merge、不開 PR。**

---

### Task 1: 收錄三門 — `DISTILL_SYSTEM_INSTRUCTION` 改寫

**Files:**
- Modify: `src/lib/line-agent/distill/distill-llm-adapter.ts:51-64`
- Test: `src/lib/line-agent/__tests__/distill-llm-adapter.test.ts:265-272`

純 prompt 改動：硬規則「只收 ≥2 次或已標記」改為三個入選門（滿足任一即收），第三門＝「老闆明確回答且答案可重複使用」。排除規則原樣保留。

**Step 1: 寫失敗測試**

在 `distill-llm-adapter.test.ts` 的 `describe('DISTILL_SYSTEM_INSTRUCTION')` 區塊（既有斷言保留，它們改完仍須通過）加：

```typescript
it('locks the third admission gate: reusable boss answers (knife A)', () => {
  expect(DISTILL_SYSTEM_INSTRUCTION).toContain('滿足任一')
  expect(DISTILL_SYSTEM_INSTRUCTION).toContain('可重複使用')
  expect(DISTILL_SYSTEM_INSTRUCTION).toContain('還成立嗎')
  expect(DISTILL_SYSTEM_INSTRUCTION).toContain('只對單一客人成立的不收')
})
```

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-llm-adapter.test.ts`
Expected: 新測試 FAIL（`toContain('滿足任一')` 不命中），其餘 PASS。

**Step 3: 改寫 instruction**

把 `distill-llm-adapter.ts:51-64` 的常量整段換成：

```typescript
export const DISTILL_SYSTEM_INSTRUCTION = [
  '你是清邁包車旅行社的知識整理助手。輸入是夥伴群最近 30 天的對話紀錄（已匿名化、含截圖轉錄）。',
  '紀錄格式：每則訊息以「#行號 [發話者]」開頭，內文可跨行；「（截圖）」表示該則是截圖的文字轉錄；',
  '「（回覆 #n）」表示回覆第 n 則；「（已標記）」表示老闆標過「記一下」，可單獨入選不受重複次數限制。',
  '任務：找出值得進知識庫的常規問答，整理成知識庫候選。',
  '入選門（滿足任一即收）：',
  '- 同類問題出現 ≥2 次',
  '- 「（已標記）」的問答',
  '- 老闆或夥伴明確回答、且答案可重複使用 — 判斷標準：「下次別的客人或夥伴問同樣的事，這個答案還成立嗎？」成立就收（例：燭光晚餐要先訂、景點車程）；只對單一客人成立的不收',
  '排除規則：',
  '- 一次性的個案談判（特殊喬價、單次特例安排）一律排除',
  '- 答案只能來自對話中夥伴實際說過的內容；不得腦補、不得加入你自己的旅遊知識',
  '- 最多 5 條；不足 5 條就回實際數量；完全沒有 → 回 []',
  '- question / answer 用繁體中文、各 500 字以內；answer 保留價格數字、時間等原始寫法',
  '只回 JSON 陣列，格式：',
  '[{"question":"…","answer":"…","sourceLines":[行號數字],"occurrences":N}]',
  'sourceLines 是該問答出處的 # 行號。不要任何前綴、後綴、說明或 code fence。',
].join('\n')
```

注意：既有斷言鎖的字串（`≥2 次`、`（已標記）`、`最多 5 條`、`sourceLines`、`不得腦補`、`code fence`）都還在，一個都不能掉。

**Step 4: 跑測試確認全綠**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-llm-adapter.test.ts`
Expected: 全 PASS。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/distill/distill-llm-adapter.ts src/lib/line-agent/__tests__/distill-llm-adapter.test.ts
git commit -m "feat(line-agent): 刀A 收錄三門 — 沉澱 instruction 改滿足任一即收（含可重用老闆答案）"
git push
```

---

### Task 2: 引用 context 進 partner-group system prompt

**Files:**
- Modify: `src/lib/line-agent/partner-group/system-prompt.ts:56-58`
- Test: `src/lib/line-agent/__tests__/system-prompt.test.ts`

`quotedBotContent` 已在 `PartnerGroupRespondInput`（`responder.ts:50`，webhook→router→responder 已線通），只差 system prompt 沒用它。

**Step 1: 寫失敗測試**

`system-prompt.test.ts` 加（先看檔頭既有的 input fixture 怎麼組，沿用同一個 helper/物件展開）：

```typescript
describe('quotedBotContent context (knife A)', () => {
  it('returns the frozen prompt verbatim when no quote', () => {
    expect(buildPartnerGroupSystemPrompt(baseInput)).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
  })

  it('appends the quoted-context section when quotedBotContent is present', () => {
    const prompt = buildPartnerGroupSystemPrompt({
      ...baseInput,
      quotedBotContent: '大車後排放球袋比較穩',
    })
    expect(prompt).toContain(PARTNER_GROUP_SYSTEM_PROMPT) // guardrails 一字不少
    expect(prompt).toContain('【引用脈絡】')
    expect(prompt).toContain('大車後排放球袋比較穩')
  })

  it('ignores a whitespace-only quotedBotContent', () => {
    expect(
      buildPartnerGroupSystemPrompt({ ...baseInput, quotedBotContent: '  ' })
    ).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
  })
})
```

（`baseInput`：用該測試檔既有的 respond input 建構方式；若沒有現成 helper，最小合法 `PartnerGroupRespondInput` 自組一個。）

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/system-prompt.test.ts`
Expected: 新測試 FAIL（目前永遠回 frozen prompt）。

**Step 3: 實作**

```typescript
/**
 * Lightweight assembly hook (design §5 step 2).  Frozen persona + guardrails
 * verbatim；刀A：當事件引用了 bot 訊息（M3.6c quote-to-bot），把引用內容附在
 * prompt 尾端 — 口語詞（「保險一點」「再大一點」）靠引用脈絡消歧。
 */
export function buildPartnerGroupSystemPrompt(input: PartnerGroupRespondInput): string {
  const quoted = input.quotedBotContent?.trim()
  if (!quoted) return PARTNER_GROUP_SYSTEM_PROMPT
  return [
    PARTNER_GROUP_SYSTEM_PROMPT,
    '',
    '【引用脈絡】使用者引用了你之前說的這句話，他的訊息是針對這句的回應；解讀口語、代稱與省略時，以這段引用為脈絡：',
    `「${quoted}」`,
  ].join('\n')
}
```

（參數名 `_input` 改 `input`。）

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/system-prompt.test.ts src/lib/line-agent/__tests__/anthropic-responder.test.ts`
Expected: 全 PASS（anthropic-responder 在 `:108` 呼叫此函式，一併回歸）。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/partner-group/system-prompt.ts src/lib/line-agent/__tests__/system-prompt.test.ts
git commit -m "feat(line-agent): 刀A 引用 context — quotedBotContent 進 partner-group system prompt"
git push
```

---

### Task 3: 確認狀態 store（KV TTL 10 分鐘）

**Files:**
- Modify: `src/lib/line-agent/distill/pending.ts`（新增型別＋搬 `DistillApproval`）
- Modify: `src/lib/line-agent/distill/approval.ts:31-34`（改為 re-export）
- Modify: `src/lib/line-agent/storage/store.ts:159-172`（介面加 3 個方法）
- Modify: `src/lib/line-agent/storage/kv-store.ts`（實作，mirror `putDistillPending` at `:426`）
- Modify: `src/lib/line-agent/storage/memory-store.ts`（實作）
- Test: `src/lib/line-agent/__tests__/case-store-contract.ts`（shared contract）

**為什麼搬型別**：確認狀態要進 `CaseStore` 介面，但 `DistillApproval` 住在 `approval.ts`，而 `approval.ts` import `store.ts` → 直接引用會循環。把 union 搬到 `pending.ts`（純型別模組，`store.ts` 本來就 import 它），`approval.ts` re-export 保住既有 import 點（tests、webhook）。

**Step 1: 搬型別**

`pending.ts` 加：

```typescript
/**
 * 批准動作 union（刀2）。住在這裡（純型別模組）而非 approval.ts —
 * store.ts 介面要引用它，放 approval.ts 會跟 CaseStore 循環依賴。
 */
export type DistillApproval =
  | { type: 'approve'; indices: number[] }
  | { type: 'approve_all' }
  | { type: 'modify'; index: number; newAnswer: string }

/**
 * 刀A 複述確認狀態（design §1）— 信心 low 時 bot 貼複述句並掛此狀態；
 * 確認語必須「引用那句複述」＋對/要/好。KV TTL 10 分鐘，過期自動作廢。
 */
export interface DistillApprovalConfirmation {
  groupId: string
  /** 確認成立後原樣走 applyDistillApproval 的動作。 */
  approval: DistillApproval
  /** bot 貼出的複述句全文 — 與 quotedBotContent 比對（cache 可能截斷，用 startsWith）。 */
  restatementText: string
  /** ms since epoch（injected，determinism）。 */
  createdAt: number
}
```

`approval.ts:31-34` 的 union 定義刪除，改成：

```typescript
import type { DistillApproval } from './pending'
export type { DistillApproval }
```

**Step 2: 跑既有測試確認沒破**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-approval.test.ts src/lib/line-agent/__tests__/distill-router.test.ts`
Expected: 全 PASS（純搬家，行為零變）。

**Step 3: 寫失敗的 contract 測試**

`case-store-contract.ts` 是兩個 store 共用的 contract（先讀檔頭看它怎麼被 kv-store.test.ts / memory store 測試引用，照同模式加一組）：

```typescript
describe('distill confirmation (knife A)', () => {
  it('put → get roundtrip per groupId', async () => {
    const store = makeStore()
    const conf = {
      groupId: 'G1',
      approval: { type: 'approve' as const, indices: [1, 3] },
      restatementText: '你是要收 1、3 對嗎？引用這句回「對」就收',
      createdAt: 1000,
    }
    await store.putDistillConfirmation(conf)
    expect(await store.getDistillConfirmation('G1')).toEqual(conf)
    expect(await store.getDistillConfirmation('G2')).toBeNull()
  })

  it('delete removes the confirmation; empty groupId is a no-op', async () => {
    const store = makeStore()
    await store.putDistillConfirmation({
      groupId: 'G1',
      approval: { type: 'approve_all' as const },
      restatementText: 'x',
      createdAt: 1000,
    })
    await store.deleteDistillConfirmation('G1')
    expect(await store.getDistillConfirmation('G1')).toBeNull()
    await expect(store.getDistillConfirmation('')).resolves.toBeNull()
    await expect(store.deleteDistillConfirmation('')).resolves.toBeUndefined()
  })
})
```

**Step 4: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/kv-store.test.ts`
Expected: FAIL（方法不存在 → type error / runtime error）。

**Step 5: 介面＋兩個實作**

`store.ts`（沉澱區塊尾端，`:171` 後）：

```typescript
  // ── 刀A：複述確認狀態（KV TTL 10 分鐘）──────────────────────────────────

  /** 寫入該群的複述確認狀態（singleton per groupId，覆寫語意；TTL 10 分鐘）。 */
  putDistillConfirmation(conf: DistillApprovalConfirmation): Promise<void>

  /** 讀該群確認狀態；不存在/已過期回 null。empty groupId 回 null、零 I/O。 */
  getDistillConfirmation(groupId: string): Promise<DistillApprovalConfirmation | null>

  /** 刪除該群確認狀態（講了別的＝作廢）。empty groupId 是 no-op；冪等。 */
  deleteDistillConfirmation(groupId: string): Promise<void>
```

（import 處補 `DistillApprovalConfirmation`，與既有 `DistillPendingBatch` 同行來源 `../distill/pending`。）

`kv-store.ts`（緊跟 `getDistillPending` 後，mirror 同模式）：

```typescript
const DISTILL_CONFIRM_PREFIX = 'line-agent:distill-confirm:'
const DISTILL_CONFIRM_TTL_SECONDS = 600 // 10 分鐘（design §1 複述確認）
```

```typescript
  async putDistillConfirmation(conf: DistillApprovalConfirmation): Promise<void> {
    if (conf.groupId === '') return
    const kv = this.ensureClient()
    await kv.setWithTtl(`${DISTILL_CONFIRM_PREFIX}${conf.groupId}`, conf, DISTILL_CONFIRM_TTL_SECONDS)
  }

  async getDistillConfirmation(groupId: string): Promise<DistillApprovalConfirmation | null> {
    if (groupId === '') return null
    const kv = this.ensureClient()
    return kv.get<DistillApprovalConfirmation>(`${DISTILL_CONFIRM_PREFIX}${groupId}`)
  }

  async deleteDistillConfirmation(groupId: string): Promise<void> {
    if (groupId === '') return
    const kv = this.ensureClient()
    await kv.del(`${DISTILL_CONFIRM_PREFIX}${groupId}`)
  }
```

`memory-store.ts`：照該檔既有 TTL 模式（先看 image-marker 怎麼存 expiresAt）；最簡實作 `Map<string, { conf, expiresAt }>`，get 時過期回 null。

**Step 6: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/kv-store.test.ts src/lib/line-agent/__tests__/case-persistence.test.ts`
Expected: 全 PASS。再跑 `npx tsc --noEmit`（介面新增方法，所有 implements CaseStore 的 fake 可能要補 — 編譯器會點名；測試裡的 partial fake 若用 `as unknown as CaseStore` 則不受影響）。

**Step 7: Commit + push**

```bash
git add src/lib/line-agent/distill/pending.ts src/lib/line-agent/distill/approval.ts src/lib/line-agent/storage/ src/lib/line-agent/__tests__/case-store-contract.ts
git commit -m "feat(line-agent): 刀A 確認狀態 store — DistillApprovalConfirmation KV TTL 10m（型別搬 pending 防循環）"
git push
```

---

### Task 4: LLM 回傳零信任解析（純函式）

**Files:**
- Create: `src/lib/line-agent/distill/approval-intent.ts`
- Test: `src/lib/line-agent/__tests__/distill-approval-intent.test.ts`

模式照 `candidates.ts`：模型輸出一律不可信，解析失敗回 `null`，絕不 throw。

**Step 1: 寫失敗測試**

```typescript
import { describe, it, expect } from 'vitest'
import { parseApprovalIntentJson } from '../distill/approval-intent'

describe('parseApprovalIntentJson — 零信任', () => {
  it('approve：行號＋信心', () => {
    expect(
      parseApprovalIntentJson('{"action":"approve","indices":[1,3],"confidence":"high"}')
    ).toEqual({ action: 'approve', indices: [1, 3], confidence: 'high' })
  })

  it('approve_all / modify / not_approval', () => {
    expect(parseApprovalIntentJson('{"action":"approve_all","confidence":"low"}')).toEqual({
      action: 'approve_all',
      confidence: 'low',
    })
    expect(
      parseApprovalIntentJson(
        '{"action":"modify","index":2,"newAnswer":"含保險","confidence":"high"}'
      )
    ).toEqual({ action: 'modify', index: 2, newAnswer: '含保險', confidence: 'high' })
    expect(parseApprovalIntentJson('{"action":"not_approval"}')).toEqual({
      action: 'not_approval',
    })
  })

  it('剝 code fence（模型不聽話的常態）', () => {
    expect(
      parseApprovalIntentJson('```json\n{"action":"approve_all","confidence":"high"}\n```')
    ).toEqual({ action: 'approve_all', confidence: 'high' })
  })

  it('垃圾輸入一律 null：非 JSON、enum 外、缺欄位、空 indices、非正整數、modify 空答案', () => {
    expect(parseApprovalIntentJson('我覺得可以收')).toBeNull()
    expect(parseApprovalIntentJson('{"action":"yolo"}')).toBeNull()
    expect(parseApprovalIntentJson('{"action":"approve","confidence":"high"}')).toBeNull()
    expect(
      parseApprovalIntentJson('{"action":"approve","indices":[],"confidence":"high"}')
    ).toBeNull()
    expect(
      parseApprovalIntentJson('{"action":"approve","indices":[0,1.5],"confidence":"high"}')
    ).toBeNull()
    expect(
      parseApprovalIntentJson('{"action":"modify","index":2,"newAnswer":"  ","confidence":"high"}')
    ).toBeNull()
    expect(
      parseApprovalIntentJson('{"action":"approve","indices":[1],"confidence":"maybe"}')
    ).toBeNull()
  })

  it('indices 去重、保序', () => {
    expect(
      parseApprovalIntentJson('{"action":"approve","indices":[3,1,3],"confidence":"high"}')
    ).toEqual({ action: 'approve', indices: [3, 1], confidence: 'high' })
  })
})
```

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-approval-intent.test.ts`
Expected: FAIL（模組不存在）。

**Step 3: 實作**

```typescript
/**
 * approval-intent.ts — 刀A 層2 LLM 回傳的零信任解析（mirror candidates.ts 紀律）。
 * 模型輸出一律不可信：失敗回 null（caller 走防呆兜底文案），絕不 throw。
 */

export type ApprovalIntentConfidence = 'high' | 'low'

export type ApprovalIntent =
  | { action: 'approve'; indices: number[]; confidence: ApprovalIntentConfidence }
  | { action: 'approve_all'; confidence: ApprovalIntentConfidence }
  | { action: 'modify'; index: number; newAnswer: string; confidence: ApprovalIntentConfidence }
  | { action: 'not_approval' }

function stripCodeFence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1
}

function parseConfidence(v: unknown): ApprovalIntentConfidence | null {
  return v === 'high' || v === 'low' ? v : null
}

export function parseApprovalIntentJson(raw: string): ApprovalIntent | null {
  let data: unknown
  try {
    data = JSON.parse(stripCodeFence(raw))
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const obj = data as Record<string, unknown>

  if (obj.action === 'not_approval') return { action: 'not_approval' }

  const confidence = parseConfidence(obj.confidence)
  if (confidence === null) return null

  if (obj.action === 'approve_all') return { action: 'approve_all', confidence }

  if (obj.action === 'approve') {
    if (!Array.isArray(obj.indices)) return null
    if (!obj.indices.every(isPositiveInt)) return null
    const indices = [...new Set(obj.indices as number[])]
    if (indices.length === 0) return null
    return { action: 'approve', indices, confidence }
  }

  if (obj.action === 'modify') {
    if (!isPositiveInt(obj.index)) return null
    if (typeof obj.newAnswer !== 'string') return null
    const newAnswer = obj.newAnswer.trim()
    if (newAnswer === '') return null
    return { action: 'modify', index: obj.index, newAnswer, confidence }
  }

  return null
}
```

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-approval-intent.test.ts`
Expected: 全 PASS。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/distill/approval-intent.ts src/lib/line-agent/__tests__/distill-approval-intent.test.ts
git commit -m "feat(line-agent): 刀A 層2 零信任解析 — parseApprovalIntentJson（mirror candidates.ts 紀律）"
git push
```

---

### Task 5: approval intent LLM adapter（Haiku＋cost cap）

**Files:**
- Create: `src/lib/line-agent/distill/approval-llm-adapter.ts`
- Test: `src/lib/line-agent/__tests__/distill-approval-llm-adapter.test.ts`

整檔 mirror `distill-llm-adapter.ts:92-224`（同一條紀律鏈：BUDGET GATE → fetch → 解析 → SPEND RECORDING 保守估 → 截斷偵測）。差異只有：model 預設 Haiku、max_tokens 256、prompt 是三樣 context（原話＋候選清單全文＋引用內容）。

**Step 1: 寫失敗測試**

照 `distill-llm-adapter.test.ts` 的 fake transport / fake costCap 模式（先讀該檔 1-130 行抄 helper），斷言：

```typescript
import { describe, it, expect, vi } from 'vitest'
import {
  APPROVAL_INTENT_MODEL_DEFAULT,
  APPROVAL_INTENT_MAX_TOKENS,
  APPROVAL_INTENT_SYSTEM_INSTRUCTION,
  buildApprovalIntentPrompt,
  createAnthropicApprovalIntentSource,
  ApprovalLlmError,
} from '../distill/approval-llm-adapter'

// helper：okTransport(text) / fakeCostCap(outcome) — 照 distill-llm-adapter.test.ts 抄

describe('buildApprovalIntentPrompt', () => {
  it('帶齊三樣 context：原話、候選清單、引用內容', () => {
    const prompt = buildApprovalIntentPrompt({
      text: '大車保險一點',
      candidates: [{ id: 1, question: '球具怎麼裝車？', answer: '建議 10 人座 Van' }],
      quotedBotContent: '高爾夫球具建議用大車載',
    })
    expect(prompt).toContain('大車保險一點')
    expect(prompt).toContain('1. Q：球具怎麼裝車？')
    expect(prompt).toContain('高爾夫球具建議用大車載')
  })

  it('無引用時不出現引用段', () => {
    const prompt = buildApprovalIntentPrompt({
      text: '都收吧',
      candidates: [{ id: 1, question: 'q', answer: 'a' }],
    })
    expect(prompt).not.toContain('引用')
  })
})

describe('createAnthropicApprovalIntentSource', () => {
  it('預設 Haiku、max_tokens 256、帶 system instruction', async () => {
    // okTransport 捕捉 request body → 斷言 body.model === APPROVAL_INTENT_MODEL_DEFAULT、
    // body.max_tokens === APPROVAL_INTENT_MAX_TOKENS、body.system === APPROVAL_INTENT_SYSTEM_INSTRUCTION
  })

  it('cost cap 非 ok：不打 transport、throw cost_cap_*', async () => {
    // fakeCostCap('over_cap') → expect rejects.toThrow(ApprovalLlmError)、transport 零呼叫
  })

  it('打完必 recordSpend（usage 缺時保守估，絕不記 0）', async () => {})
  it('non-200 → anthropic_non_200；stop_reason=max_tokens → max_tokens_truncated（先記帳再 throw）', async () => {})
  it('成功回 raw text 原樣（不在 adapter 解析 JSON）', async () => {})
})
```

（測試本體照 `distill-llm-adapter.test.ts` 同名測試逐一改寫——那檔就是規格。）

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-approval-llm-adapter.test.ts`
Expected: FAIL（模組不存在）。

**Step 3: 實作**

```typescript
/**
 * approval-llm-adapter.ts — 刀A 層2 的 Anthropic intent parser adapter
 * （design 2026-06-12 §1）。
 *
 * 整檔 mirror distill-llm-adapter.ts：transport 注入、COST CAP 先行、
 * fixed-code error、截斷偵測、spend 保守估。JSON 解析在 approval-intent.ts
 * （純函式、零信任）— 本模組只負責「context 三樣 → raw model text」。
 */

import { estimateCostUsd, type DailyCostCap } from '../observability/daily-cost-cap'
import { createAgentLogger, type AgentLogger } from '../observability/structured-log'

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/** 單一 JSON 物件，256 綽綽有餘；再大就是失控，截斷偵測會擋。 */
export const APPROVAL_INTENT_MAX_TOKENS = 256

/** 批准語句是短句分類，Haiku 足夠（設計 §1 指定）。 */
export const APPROVAL_INTENT_MODEL_DEFAULT = 'claude-haiku-4-5'

export function resolveApprovalIntentModel(opts?: {
  model?: string
  env?: Record<string, string | undefined>
}): string {
  const explicit = opts?.model?.trim()
  if (explicit) return explicit
  const fromEnv = opts?.env?.AI_AGENT_APPROVE_LLM_MODEL?.trim()
  if (fromEnv) return fromEnv
  return APPROVAL_INTENT_MODEL_DEFAULT
}

export const APPROVAL_INTENT_SYSTEM_INSTRUCTION = [
  '你是清邁包車旅行社內部 AI 的「批准語句解析器」。群組剛貼出一批知識庫候選（帶編號），',
  '使用者特意對 AI 說了一句話，你要判斷這句話是不是在批准收錄候選。',
  '你會看到：使用者原話、目前掛著的候選清單（編號＋問答）、使用者引用的 AI 訊息內容（如有）。',
  '判斷規則：',
  '- 明確指出要收哪幾條（含口語、錯字、簡寫）→ action=approve，行號放 indices',
  '- 表示全部都收 → action=approve_all',
  '- 要求修改某條答案再收 → action=modify，給 index 與 newAnswer；newAnswer 只能改寫使用者明說的內容，不得腦補',
  '- 在問問題、聊天、或與批准無關 → action=not_approval',
  '- 行號只能用候選清單裡存在的編號',
  '- 對使用者意圖有把握 → confidence=high；模稜兩可 → confidence=low',
  '只回一個 JSON 物件，不要任何前綴、後綴、說明或 code fence：',
  '{"action":"approve|approve_all|modify|not_approval","indices":[數字],"index":數字,"newAnswer":"…","confidence":"high|low"}',
  '用不到的欄位省略；not_approval 不需要 confidence。',
].join('\n')

export interface ApprovalIntentRequest {
  /** 使用者原話（未剝 mention — 模型看得懂 @bot）。 */
  text: string
  /** 掛著的候選清單全文（id 是貼群時的穩定編號）。 */
  candidates: Array<{ id: number; question: string; answer: string }>
  /** 使用者引用的 bot 訊息內容（如有）— 口語消歧的關鍵 context。 */
  quotedBotContent?: string
}

/** context 三樣 → raw model text（approval-intent.ts 零信任解析）。 */
export type ApprovalIntentSource = (req: ApprovalIntentRequest) => Promise<string>

/** Exported for tests — prompt 結構是行為的一部分。 */
export function buildApprovalIntentPrompt(req: ApprovalIntentRequest): string {
  const lines = ['【使用者原話】', req.text, '', '【掛著的候選清單】']
  for (const c of req.candidates) {
    lines.push(`${c.id}. Q：${c.question}`)
    lines.push(`   A：${c.answer}`)
  }
  const quoted = req.quotedBotContent?.trim()
  if (quoted) {
    lines.push('', '【使用者引用的 AI 訊息】', quoted)
  }
  return lines.join('\n')
}

export class ApprovalLlmError extends Error {
  constructor(code: string) {
    super(`approval intent llm call failed: ${code}`)
    this.name = 'ApprovalLlmError'
  }
}

export interface AnthropicApprovalIntentSourceDeps {
  transport: typeof fetch
  apiKey: string
  /** REQUIRED — 忘了接 cap 永遠不能等於無上限燒錢。 */
  costCap: DailyCostCap
  model?: string
  env?: Record<string, string | undefined>
  log?: AgentLogger
}

export function createAnthropicApprovalIntentSource(
  deps: AnthropicApprovalIntentSourceDeps
): ApprovalIntentSource {
  const model = resolveApprovalIntentModel({ model: deps.model, env: deps.env })
  const log = deps.log ?? createAgentLogger({ requestId: '-' })

  return async function approvalIntentSource(req) {
    // 以下逐段 mirror distill-llm-adapter.ts:96-223：
    // ① checkBudget 非 ok → log + throw ApprovalLlmError(`cost_cap_${outcome}`)
    // ② transport POST（model、APPROVAL_INTENT_MAX_TOKENS、
    //    system=APPROVAL_INTENT_SYSTEM_INSTRUCTION、
    //    messages=[{role:'user',content:buildApprovalIntentPrompt(req)}]）
    //    throw → 'anthropic_api_error'；!ok → 'anthropic_non_200'
    // ③ json 解析失敗 → 'anthropic_parse_error'
    // ④ SPEND RECORDING：usage 缺時保守估
    //    （(system.length + prompt.length)/4、output=APPROVAL_INTENT_MAX_TOKENS）
    // ⑤ text 非字串/空 → 'anthropic_parse_error'
    // ⑥ stop_reason==='max_tokens' → 'max_tokens_truncated'（先記帳再 throw）
    // ⑦ log llm_call ok → return text
  }
}
```

（函式本體逐段照 `distill-llm-adapter.ts:96-223` 抄，只換常量名與 error class——該檔每段都有理由註解，一併保留語意。）

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-approval-llm-adapter.test.ts`
Expected: 全 PASS。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/distill/approval-llm-adapter.ts src/lib/line-agent/__tests__/distill-approval-llm-adapter.test.ts
git commit -m "feat(line-agent): 刀A 層2 adapter — Haiku intent parser（cost cap 先行、mirror distill adapter 紀律）"
git push
```

---

### Task 6: 三層接話 orchestrator — `resolveDistillApproval`

**Files:**
- Modify: `src/lib/line-agent/distill/approval.ts`（新增 orchestrator＋複述文案＋兜底文案）
- Test: `src/lib/line-agent/__tests__/distill-approval-resolve.test.ts`（新檔）

核心流程（design §1 流程圖逐格對應）：

```
層1 regex 命中 → 作廢舊確認（best-effort）→ applyDistillApproval（行為與刀2 逐字同）
層1 miss → 讀 pending：無/空 → null（一次 KV 讀落回 responder — parse-first 契約演化）
  有 pending → 讀確認狀態：
    引用複述＋對/要/好 → 刪確認 → applyDistillApproval(存的 approval)
    有確認但講了別的 → 刪確認（作廢，不卡路徑）→ 繼續
  層2：intentSource 未注入 → null（同刀2 行為）
    LLM throw（掛掉/cost cap）→ 兜底文案（絕不吞批准意圖）
    解析 null → 兜底文案
    not_approval → null（日常問答不受劫持）
    confidence low → 寫確認狀態＋回複述句
    confidence high → 層3 = applyDistillApproval（超界整批拒絕現成）
```

**Step 1: 寫失敗測試**

`distill-approval-resolve.test.ts` — store 用 `MemoryStore`（Task 3 後已有確認方法），intentSource 用 fake。至少蓋：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { MemoryStore } from '../storage/memory-store'
import {
  resolveDistillApproval,
  composeConfirmationText,
  DISTILL_APPROVAL_FALLBACK_TEXT,
} from '../distill/approval'

function seedPending(store: MemoryStore) {
  return store.putDistillPending({
    groupId: 'G1',
    createdAt: 1000,
    candidates: [
      { id: 1, question: 'q1', answer: 'a1', sourceMessageIds: [], occurrences: 2, status: 'pending', missedCount: 0 },
      { id: 3, question: 'q3', answer: 'a3', sourceMessageIds: [], occurrences: 1, status: 'pending', missedCount: 0 },
    ],
    resolved: [],
  })
}

const base = { groupId: 'G1', now: 2000 }

describe('resolveDistillApproval — 三層接話', () => {
  it('層1：regex 命中走既有路徑、零 LLM 呼叫', async () => {
    const store = new MemoryStore(); await seedPending(store)
    const intentSource = vi.fn()
    const result = await resolveDistillApproval({ ...base, store, text: '1 3 要', intentSource })
    expect(result?.outboundText).toContain('✅ 已收：1、3')
    expect(intentSource).not.toHaveBeenCalled()
  })

  it('regex miss＋無 pending → null（落回 responder），零 LLM', async () => {
    const store = new MemoryStore()
    const intentSource = vi.fn()
    expect(await resolveDistillApproval({ ...base, store, text: '都收了吧', intentSource })).toBeNull()
    expect(intentSource).not.toHaveBeenCalled()
  })

  it('層2 not_approval → null（日常問答不受劫持）', async () => {
    const store = new MemoryStore(); await seedPending(store)
    const intentSource = vi.fn().mockResolvedValue('{"action":"not_approval"}')
    expect(await resolveDistillApproval({ ...base, store, text: '清萊一日來得及嗎', intentSource })).toBeNull()
  })

  it('層2 high → 層3 套用（含 LLM context 帶到候選與引用）', async () => {
    const store = new MemoryStore(); await seedPending(store)
    const intentSource = vi.fn().mockResolvedValue('{"action":"approve","indices":[1],"confidence":"high"}')
    const result = await resolveDistillApproval({
      ...base, store, text: '第一條收吧', quotedBotContent: '候選清單那則', intentSource,
    })
    expect(result?.outboundText).toContain('✅ 已收：1')
    expect(intentSource).toHaveBeenCalledWith({
      text: '第一條收吧',
      candidates: [
        { id: 1, question: 'q1', answer: 'a1' },
        { id: 3, question: 'q3', answer: 'a3' },
      ],
      quotedBotContent: '候選清單那則',
    })
  })

  it('層2 high 但行號超界 → 既有「整批未生效」拒絕（層3 deterministic）', async () => {
    const store = new MemoryStore(); await seedPending(store)
    const intentSource = vi.fn().mockResolvedValue('{"action":"approve","indices":[2],"confidence":"high"}')
    const result = await resolveDistillApproval({ ...base, store, text: '第二條收', intentSource })
    expect(result?.outboundText).toContain('沒有第 2 條')
  })

  it('層2 low → 寫確認狀態＋回複述句；引用複述＋「對」→ 套用', async () => {
    const store = new MemoryStore(); await seedPending(store)
    const intentSource = vi.fn().mockResolvedValue('{"action":"approve","indices":[1,3],"confidence":"low"}')
    const first = await resolveDistillApproval({ ...base, store, text: '那兩條都ok', intentSource })
    expect(first?.outboundText).toBe('你是要收 1、3 對嗎？引用這句回「對」就收')
    expect(await store.getDistillConfirmation('G1')).not.toBeNull()

    const second = await resolveDistillApproval({
      ...base, store, text: '對', quotedBotContent: first!.outboundText!, intentSource,
    })
    expect(second?.outboundText).toContain('✅ 已收：1、3')
    expect(await store.getDistillConfirmation('G1')).toBeNull()
  })

  it('確認掛著但講了別的 → 確認作廢、不卡路徑（落層2）', async () => {
    const store = new MemoryStore(); await seedPending(store)
    await store.putDistillConfirmation({
      groupId: 'G1',
      approval: { type: 'approve', indices: [1] },
      restatementText: '你是要收 1 對嗎？引用這句回「對」就收',
      createdAt: 1000,
    })
    const intentSource = vi.fn().mockResolvedValue('{"action":"not_approval"}')
    expect(await resolveDistillApproval({ ...base, store, text: '清萊車程多久', intentSource })).toBeNull()
    expect(await store.getDistillConfirmation('G1')).toBeNull()
  })

  it('防呆兜底：LLM throw / 解析 null → 固定文案，絕不靜默', async () => {
    const store = new MemoryStore(); await seedPending(store)
    const boom = vi.fn().mockRejectedValue(new Error('cost_cap_over_cap'))
    const r1 = await resolveDistillApproval({ ...base, store, text: '嗯收吧', intentSource: boom })
    expect(r1?.outboundText).toBe(DISTILL_APPROVAL_FALLBACK_TEXT)

    const garbage = vi.fn().mockResolvedValue('我覺得都可以收')
    const r2 = await resolveDistillApproval({ ...base, store, text: '嗯收吧', intentSource: garbage })
    expect(r2?.outboundText).toBe(DISTILL_APPROVAL_FALLBACK_TEXT)
  })

  it('intentSource 未注入 → 行為同刀2（regex-only，miss 即 null）', async () => {
    const store = new MemoryStore(); await seedPending(store)
    expect(await resolveDistillApproval({ ...base, store, text: '都收了吧' })).toBeNull()
  })
})

describe('composeConfirmationText', () => {
  it('approve / approve_all / modify 三款複述', () => {
    const candidates = [{ id: 1 }, { id: 3 }] as never
    expect(composeConfirmationText({ type: 'approve', indices: [1, 3] }, candidates))
      .toBe('你是要收 1、3 對嗎？引用這句回「對」就收')
    expect(composeConfirmationText({ type: 'approve_all' }, candidates))
      .toBe('你是要全部收（1、3）對嗎？引用這句回「對」就收')
    expect(composeConfirmationText({ type: 'modify', index: 2, newAnswer: '含保險' }, candidates))
      .toBe('你是要把第 2 條改成「含保險」再收對嗎？引用這句回「對」就收')
  })
})
```

（`MemoryStore` 建構子簽名先看 `memory-store.ts:20`；fixture 欄位以 `pending.ts` 的 `DistillCandidate` 為準。）

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-approval-resolve.test.ts`
Expected: FAIL（export 不存在）。

**Step 3: 實作**

`approval.ts` 尾端新增（既有 `parseDistillApproval` / `applyDistillApproval` 一行不動）：

```typescript
import { parseApprovalIntentJson } from './approval-intent'
import type { ApprovalIntentSource } from './approval-llm-adapter'
// （檔頭 import 區補上；DistillApproval 已在 Task 3 改從 pending re-export）

// ---------------------------------------------------------------------------
// 刀A — 三層接話 orchestrator（design 2026-06-12 §1）
// ---------------------------------------------------------------------------

/** 防呆兜底 — LLM 掛掉/不合法 JSON/cost cap 到頂：不靜默，絕不吞批准意圖。 */
export const DISTILL_APPROVAL_FALLBACK_TEXT = '看不懂這句，要收哪幾條？例：1 3 要'

/** 確認語：剝 mention 後全句 match（同 regex 批准的防誤觸紀律）。 */
const CONFIRM_YES_RE = /^(對|要|好)$/

/** Exported for tests — 複述句排版以測試鎖定（同 composeAck 慣例）。 */
export function composeConfirmationText(
  approval: DistillApproval,
  candidates: DistillCandidate[]
): string {
  if (approval.type === 'approve_all') {
    return `你是要全部收（${joinIds(candidates)}）對嗎？引用這句回「對」就收`
  }
  if (approval.type === 'approve') {
    return `你是要收 ${approval.indices.join('、')} 對嗎？引用這句回「對」就收`
  }
  return `你是要把第 ${approval.index} 條改成「${approval.newAnswer}」再收對嗎？引用這句回「對」就收`
}

/**
 * 引用比對：quotedBotContent 是 store cache 的內容，可能被長度上限截斷 —
 * startsWith 同時涵蓋全等與截斷前綴。Exported for tests。
 */
export function confirmationQuoteMatches(
  restatementText: string,
  quotedBotContent: string | undefined
): boolean {
  if (!quotedBotContent || quotedBotContent.trim() === '') return false
  return restatementText.startsWith(quotedBotContent.trim())
}

export interface ResolveDistillApprovalInput {
  store: CaseStore
  groupId: string
  /** 使用者原話（未剝 mention）。 */
  text: string
  /** 引用的 bot 訊息內容（webhook resolve；確認比對＋LLM context 雙用途）。 */
  quotedBotContent?: string
  now: number
  log?: AgentLogger
  /**
   * 刀3 writer thunk — lazy：非批准路徑零 writer 初始化（保住 parse-first
   * 的輕量契約）。未注入/resolve undefined ⇒ dry-run 文案。
   */
  getKnowledgeWriter?: () => Promise<DistilledQaWriter | undefined>
  /** 層2 seam — 未注入 ⇒ regex-only（行為同刀2；CLI/測試注入 fake）。 */
  intentSource?: ApprovalIntentSource
}

function fallbackResult(reason: string): HandlerResult {
  return {
    handler: 'resolveDistillApproval',
    status: 'stub_ok',
    outboundText: DISTILL_APPROVAL_FALLBACK_TEXT,
    meta: { reason },
  }
}

/** 不是批准、也無 pending → null（router 落回 responder）。 */
export async function resolveDistillApproval(
  input: ResolveDistillApprovalInput
): Promise<HandlerResult | null> {
  const { store, groupId, text, quotedBotContent, now, log } = input

  const apply = async (approval: DistillApproval) =>
    applyDistillApproval({
      store, groupId, approval, now, log,
      knowledgeWriter: await input.getKnowledgeWriter?.(),
    })

  // 層1 — 老格式 regex（零成本零延遲；命中行為與刀2 逐字相同）
  const regexApproval = parseDistillApproval(text)
  if (regexApproval !== null) {
    // 換了批准方式 → 舊複述確認作廢（best-effort：刪失敗 TTL 兜底）
    try { await store.deleteDistillConfirmation(groupId) } catch { /* TTL 兜底 */ }
    return apply(regexApproval)
  }

  // regex miss → 先看 pending（無 pending ＝ 一次 KV 讀後落回 responder）。
  // KV 讀失敗回 null — 故障絕不劫持日常問答（parse-first 契約演化，design §1）。
  let batch: DistillPendingBatch | null
  try {
    batch = await store.getDistillPending(groupId)
  } catch {
    log?.('store_write_failed', { reason: 'distill_pending_read_failed' })
    return null
  }
  if (!batch || batch.candidates.length === 0) return null

  // 複述確認 — 確認語必須「引用那句複述」＋對/要/好（design §1）
  let confirmation: DistillApprovalConfirmation | null = null
  try {
    confirmation = await store.getDistillConfirmation(groupId)
  } catch { /* 讀失敗當不存在 — TTL 兜底 */ }
  if (confirmation) {
    const stripped = text.replace(/@\S+/g, '').trim()
    if (confirmationQuoteMatches(confirmation.restatementText, quotedBotContent) &&
        CONFIRM_YES_RE.test(stripped)) {
      try { await store.deleteDistillConfirmation(groupId) } catch { /* TTL 兜底 */ }
      return apply(confirmation.approval)
    }
    // 講了別的 → 自動作廢，不卡任何路徑（繼續層2）
    try { await store.deleteDistillConfirmation(groupId) } catch { /* TTL 兜底 */ }
  }

  // 層2 — LLM intent parser（未注入 ⇒ 行為同刀2）
  if (!input.intentSource) return null
  let intent: ReturnType<typeof parseApprovalIntentJson>
  try {
    const raw = await input.intentSource({
      text,
      candidates: batch.candidates.map(({ id, question, answer }) => ({ id, question, answer })),
      ...(quotedBotContent !== undefined ? { quotedBotContent } : {}),
    })
    intent = parseApprovalIntentJson(raw)
  } catch {
    log?.('route_decision', { reason: 'approval_intent_llm_failed' })
    return fallbackResult('approval_intent_llm_failed')
  }
  if (intent === null) return fallbackResult('approval_intent_unparseable')
  if (intent.action === 'not_approval') return null

  const approval: DistillApproval =
    intent.action === 'approve'
      ? { type: 'approve', indices: intent.indices }
      : intent.action === 'approve_all'
        ? { type: 'approve_all' }
        : { type: 'modify', index: intent.index, newAnswer: intent.newAnswer }

  if (intent.confidence === 'low') {
    const restatementText = composeConfirmationText(approval, batch.candidates)
    try {
      await store.putDistillConfirmation({ groupId, approval, restatementText, createdAt: now })
    } catch {
      log?.('store_write_failed', { reason: 'distill_confirmation_write_failed' })
      return fallbackResult('distill_confirmation_write_failed')
    }
    return {
      handler: 'resolveDistillApproval',
      status: 'stub_ok',
      outboundText: restatementText,
      meta: { reason: 'distill_approval_confirmation', confidence: 'low' },
    }
  }

  // 層3 — deterministic 驗證＝既有 applyDistillApproval（超界整批拒絕在裡面）
  return apply(approval)
}
```

（檔頭 import 補：`DistillPendingBatch`、`DistillApprovalConfirmation` from `./pending`。）

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-approval-resolve.test.ts src/lib/line-agent/__tests__/distill-approval.test.ts`
Expected: 全 PASS（既有刀2 測試不准動、不准破）。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/distill/approval.ts src/lib/line-agent/__tests__/distill-approval-resolve.test.ts
git commit -m "feat(line-agent): 刀A 三層接話 — resolveDistillApproval（regex→LLM→deterministic＋複述確認＋防呆兜底）"
git push
```

---

### Task 7: router seam 簽名擴充 — `quotedBotContent` 線進 approve

**Files:**
- Modify: `src/lib/line-agent/commands/router.ts:158-161`（型別）、`:349`（呼叫點）
- Test: `src/lib/line-agent/__tests__/distill-router.test.ts`

router 的 distill 區塊在 `tagPerm.allowed` 內（`router.ts:343`），botDirected 已由位置保證——seam 只需補 `quotedBotContent`。

**Step 1: 寫失敗測試**

`distill-router.test.ts` 加（fake seam 模式照該檔既有測試）：

```typescript
it('threads quotedBotContent into the approve seam (knife A ctx)', async () => {
  const approve = vi.fn().mockResolvedValue(null)
  const decision = await routeCommand({
    event: partnerGroupEvent({ text: '@bot 大車保險一點', mentionsBot: true }),
    quotedBotContent: '高爾夫球具建議用大車載',
    distill: { run: vi.fn(), approve },
  })
  expect(approve).toHaveBeenCalledWith('G1', '@bot 大車保險一點', {
    quotedBotContent: '高爾夫球具建議用大車載',
  })
  expect(decision.action).toBe('respond') // approve 回 null → 落回 responder
})
```

（`partnerGroupEvent` helper、groupId 值照該檔既有 fixture。）

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-router.test.ts`
Expected: 新測試 FAIL（approve 收到兩個參數）。

**Step 3: 實作**

`router.ts:158-161` 型別：

```typescript
  distill?: {
    run(groupId: string): Promise<HandlerResult>
    approve(
      groupId: string,
      text: string,
      /** 刀A：引用的 bot 訊息內容 — 複述確認比對＋LLM 消歧 context。 */
      ctx?: { quotedBotContent?: string }
    ): Promise<HandlerResult | null>
  }
```

`router.ts:349` 呼叫點：

```typescript
            const approval = await input.distill.approve(event.groupId, event.text ?? '', {
              quotedBotContent: input.quotedBotContent,
            })
```

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-router.test.ts src/lib/line-agent/__tests__/command-router.test.ts`
Expected: 全 PASS。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/commands/router.ts src/lib/line-agent/__tests__/distill-router.test.ts
git commit -m "feat(line-agent): 刀A router seam — approve ctx 帶 quotedBotContent"
git push
```

---

### Task 8: webhook 接線 — `getDistillSeams` 換 orchestrator

**Files:**
- Modify: `src/lib/line-agent/line/webhook-runtime.ts:761-794`（getDistillSeams）＋新增 `getApprovalIntentSource`
- Test: `src/lib/line-agent/__tests__/distill-webhook.test.ts`

**Step 0: 先確認兩件事（read-only，影響實作細節）**

1. `webhook-runtime.ts` 裡 `getDistillSource()` 怎麼組 costCap / transport / apiKey（在 getDistillSeams 附近）——`getApprovalIntentSource` 逐行 mirror 它。
2. `webhook-runtime.ts:349` 附近：distill action 的 outbound 回覆是否走 `putBotAuthoredPartnerMsg(messageId, content)` **帶 content**。複述確認靠「引用複述句」成立，content 沒被 cache 的話 `quotedBotContent` 永遠 resolve 不到 → 確認流程死路。若目前 distill action 只記 id 不記 content，在本 task 一併補上（這是接線正確性的一部分）。

**Step 1: 寫失敗測試**

`distill-webhook.test.ts` 加（fake transport/seam 模式照該檔既有測試）：

```typescript
it('approve seam: regex miss + pending + botDirected → 走 LLM intent 路徑（ctx 帶 quotedBotContent）', async () => {
  // 安排：閘開、API key 有、store 裡塞 pending batch＋bot-authored quoted 訊息
  // fake transport 回 {"action":"approve","indices":[1],"confidence":"high"}
  // 斷言：回覆含「✅ 已收：1」、transport 被打到 messages API、model 含 haiku
})

it('approve seam: regex 命中 → 零 LLM（transport 不被呼叫）', async () => {})

it('approve seam: 無 pending → null 落回 responder、transport 不被呼叫', async () => {})
```

**Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-webhook.test.ts`
Expected: 新測試 FAIL。

**Step 3: 實作**

mirror `getDistillSource` 加（同檔、同區塊）：

```typescript
/** 刀A 層2 source — 組法逐行同 getDistillSource（costCap 必接）。 */
function getApprovalIntentSource(log: AgentLogger): ApprovalIntentSource {
  // mirror getDistillSource：同一個 createDailyCostCap / transport / apiKey 組法，
  // 換 createAnthropicApprovalIntentSource
}
```

`getDistillSeams` 的 approve 改為：

```typescript
    approve: async (groupId, text, ctx) =>
      // 三層接話 orchestrator：層1 regex 仍在最前（resolveDistillApproval 內），
      // parse-first 契約演化（design §1）：regex miss＋無 pending ＝ 一次 KV 讀
      // 即落回 responder；writer 是 lazy thunk — 非批准路徑零初始化。
      resolveDistillApproval({
        store,
        groupId,
        text,
        quotedBotContent: ctx?.quotedBotContent,
        now: Date.now(),
        log,
        getKnowledgeWriter: () => getDistilledQaWriter(log),
        intentSource: getApprovalIntentSource(log),
      }),
```

（import 改：`parseDistillApproval`/`applyDistillApproval` 不再直接用就移除，換 `resolveDistillApproval`。檔頭 `getDistillSeams` 的 doc 註解同步改寫 parse-first 描述。）

**Step 4: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/distill-webhook.test.ts src/lib/line-agent/__tests__/line-webhook-route.test.ts`
Expected: 全 PASS。

**Step 5: Commit + push**

```bash
git add src/lib/line-agent/line/webhook-runtime.ts src/lib/line-agent/__tests__/distill-webhook.test.ts
git commit -m "feat(line-agent): 刀A webhook 接線 — getDistillSeams 換三層 orchestrator＋Haiku intent source"
git push
```

---

### Task 9: CLI 黑箱內測入口 — `agent:approve-parse`

**Files:**
- Modify: `scripts/agent-command.mjs`（parseAgentCommandArgs＋loadApproveParseKit＋runApproveParseCommand＋main dispatch）
- Create: `scripts/fixtures/distill-approve-candidates.json`
- Modify: `package.json`（scripts）
- Test: `src/lib/line-agent/__tests__/agent-command-approve-parse.test.ts`（新檔，模式照 `agent-command-overdue.test.ts`）

**鐵律（design §4）**：不碰真 store（不讀不寫 pending/confirmation）、不貼群；候選清單來自 fixture。KV 只接 cost cap（cost 紀律不因離線而豁免——memory 教訓：CLI 載 `.env.local`，閘＋key 齊就是真打 API、真花錢）。

**Step 1: 建 fixture**

`scripts/fixtures/distill-approve-candidates.json`：

```json
[
  { "id": 1, "question": "燭光晚餐需要預約嗎？", "answer": "要先訂，至少提前 3 天跟餐廳確認位子。" },
  { "id": 2, "question": "清邁到清萊車程多久？", "answer": "單程約 3 到 3.5 小時，一日來回要早出發。" },
  { "id": 3, "question": "高爾夫球具可以上車嗎？", "answer": "可以，建議 10 人座 Van，後排放球袋比較穩。" }
]
```

**Step 2: 寫失敗測試**

`agent-command-approve-parse.test.ts`（import 自 `scripts/agent-command.mjs`，照 `agent-command-overdue.test.ts` 的 kit-injection 模式）：

```typescript
describe('parseAgentCommandArgs approve-parse', () => {
  it('一句話＋--quoted＋--fixture 解析', () => {
    expect(
      parseAgentCommandArgs(['approve-parse', '大車', '保險一點', '--quoted', '球具建議大車', '--fixture', 'x.json'])
    ).toEqual({ commandText: 'approve-parse', query: '大車 保險一點', quoted: '球具建議大車', fixture: 'x.json' })
  })
  it('缺一句話 → throw（不知道要解析什麼）', () => {
    expect(() => parseAgentCommandArgs(['approve-parse'])).toThrow()
  })
})

describe('runApproveParseCommand', () => {
  it('層1 regex 命中：零 LLM、印層級＋解析結果＋驗證', async () => {
    // kit 注入 fake；text='1 3 要' → 輸出含「層1 regex 命中」「approve [1,3]」「驗證通過」
    // intent source 零呼叫
  })
  it('層2：LLM 回 high approve → 印 intent＋deterministic 驗證（行號存在 fixture）', async () => {})
  it('層2：行號超界 → 印「驗證失敗：沒有第 N 條」', async () => {})
  it('層2：not_approval → 印「會落回 responder」', async () => {})
  it('缺 AI_AGENT_DISTILL_ENABLED / ANTHROPIC_API_KEY → throw 明確訊息', async () => {})
})
```

**Step 3: 跑測試確認失敗**

Run: `npx vitest run src/lib/line-agent/__tests__/agent-command-approve-parse.test.ts`
Expected: FAIL。

**Step 4: 實作**

`parseAgentCommandArgs` 加（放在 distill-flush 條目後）：

```javascript
  if (command === 'approve-parse' || command === '/approve-parse') {
    // 刀A CLI 黑箱內測（design 2026-06-12 §4）：一句話＋fixture 候選清單，
    // 不碰真 store、不貼群。--quoted 模擬「引用 bot 訊息」、--fixture 換候選檔。
    const rest = args.slice(1)
    const takeFlag = (flag) => {
      const i = rest.indexOf(flag)
      if (i === -1) return undefined
      const value = String(rest[i + 1] ?? '').trim()
      rest.splice(i, 2)
      return value
    }
    const quoted = takeFlag('--quoted')
    const fixture = takeFlag('--fixture')
    const query = rest.join(' ').trim()
    if (query === '') {
      throw new Error('approve-parse · 用法：npm run agent:approve-parse -- "一句話" [--quoted "引用內容"] [--fixture path.json]')
    }
    return { commandText: 'approve-parse', query, quoted, fixture }
  }
```

（同步把 `approve-parse` 加進檔尾「目前支援：…」的錯誤訊息。）

`loadApproveParseKit`（mirror `loadDistillKit` 的 GUARD-loaded dynamic import）：

```javascript
/** GUARD-loaded dynamic import（同 loadDistillKit 慣例）。 */
export async function loadApproveParseKit(ctx = {}) {
  // dynamic import：
  //   parseDistillApproval（distill/approval）
  //   parseApprovalIntentJson（distill/approval-intent）
  //   createAnthropicApprovalIntentSource, resolveApprovalIntentModel（distill/approval-llm-adapter）
  //   isDistillEnabled（distill/run-distillation — 同 distill-dry-run 的來源）
  //   createDailyCostCap, createKvClientFromEnv（同 loadDistillKit）
  // import 失敗回 null（同慣例）
}
```

`runApproveParseCommand`（mirror `runDistillDryRunCommand` 骨架）：

```javascript
/**
 * 刀A 黑箱內測：一句話 → 層1 regex → （miss 時）層2 真 LLM → deterministic
 * 驗證 vs fixture。**不碰真 store、不貼群** — KV 只接 cost cap。
 */
export async function runApproveParseCommand(options = {}) {
  const env = options.env ?? process.env
  const kit = options.kit ?? (await loadApproveParseKit())
  if (!kit) throw new Error('approve-parse · 失敗（模組未載入，請用 tsx 執行）')

  // ① 前置閘（同 distill-dry-run：缺哪個就明說，絕不默默 fallback）
  if (!kit.isDistillEnabled(env)) throw new Error('approve-parse · 失敗：AI_AGENT_DISTILL_ENABLED 未開')
  if (!String(env.ANTHROPIC_API_KEY ?? '').trim()) throw new Error('approve-parse · 失敗：缺 ANTHROPIC_API_KEY')

  // ② fixture 候選（預設 scripts/fixtures/distill-approve-candidates.json）
  const fixturePath = options.fixture ?? 'scripts/fixtures/distill-approve-candidates.json'
  const candidates = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

  const lines = [
    'approve-parse（黑箱內測 — 不碰真 store、不貼群）',
    `輸入：「${options.query}」${options.quoted ? `（引用：「${options.quoted}」）` : ''}`,
    `候選 fixture：${candidates.map((c) => c.id).join('、')}（${fixturePath}）`,
  ]

  // ③ 層1 regex
  const regexHit = kit.parseDistillApproval(options.query)
  if (regexHit !== null) {
    lines.push(`層1 regex 命中：${JSON.stringify(regexHit)}`)
    lines.push(validateAgainstFixture(regexHit, candidates)) // 共用驗證 helper
    return lines.join('\n')
  }
  lines.push('層1 regex miss → 層2 LLM intent parser')

  // ④ 層2 真 LLM（costCap 必接 — KV 缺就 throw，cost 紀律不豁免）
  const kvClient = options.kvClient ?? kit.createKvClientFromEnv(env)
  if (!kvClient) throw new Error('approve-parse · 失敗：缺 AGENT_KV_URL / AGENT_KV_TOKEN（cost cap 要 KV）')
  const costCap = kit.createDailyCostCap({ env, kv: kvClient })
  const source = options.intentSource ?? kit.createAnthropicApprovalIntentSource({
    transport: options.transport ?? fetch,
    apiKey: String(env.ANTHROPIC_API_KEY).trim(),
    costCap,
    env,
  })
  lines.push(`model=${kit.resolveApprovalIntentModel({ env })} · 估 <$0.01/次`)
  const raw = await source({
    text: options.query,
    candidates,
    ...(options.quoted ? { quotedBotContent: options.quoted } : {}),
  })
  const intent = kit.parseApprovalIntentJson(raw)

  // ⑤ 印結果＋deterministic 驗證
  if (intent === null) {
    lines.push(`LLM 回傳解析失敗（raw：${raw}）→ 真機會回防呆兜底：「看不懂這句，要收哪幾條？例：1 3 要」`)
  } else if (intent.action === 'not_approval') {
    lines.push('LLM 判定 not_approval → 真機會落回 responder（日常問答不受劫持）')
  } else {
    lines.push(`LLM intent：${JSON.stringify(intent)}`)
    lines.push(validateAgainstFixture(intent, candidates))
    if (intent.action !== 'approve_all' && intent.confidence === 'low') {
      lines.push('信心 low → 真機會走複述確認（引用複述句回「對」才收）')
    }
  }
  return lines.join('\n')
}
```

`validateAgainstFixture(parsed, candidates)`：算 wantedIds（同 `applyDistillApproval` ① 的邏輯），超界印 `驗證失敗：沒有第 N 條（整批拒絕）`，否則 `驗證通過：會收 1、3`。

main dispatch（檔尾 switch/if 區照 distill-dry-run 條目加 approve-parse → `runApproveParseCommand({ query, quoted, fixture })`，印 return 值）。

`package.json` scripts 加：

```json
    "agent:approve-parse": "tsx --env-file=.env.local scripts/agent-command.mjs approve-parse",
```

**Step 5: 跑測試確認通過**

Run: `npx vitest run src/lib/line-agent/__tests__/agent-command-approve-parse.test.ts src/lib/line-agent/__tests__/agent-command-script.test.ts`
Expected: 全 PASS。

**Step 6: Commit + push**

```bash
git add scripts/agent-command.mjs scripts/fixtures/distill-approve-candidates.json package.json src/lib/line-agent/__tests__/agent-command-approve-parse.test.ts
git commit -m "feat(line-agent): 刀A CLI 黑箱內測 — agent:approve-parse（fixture 候選＋層級回報，零 store 寫入）"
git push
```

---

### Task 10: 全量回歸＋docs 收尾

**Step 1: 全量測試＋型別檢查**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: 全 PASS / 零 error。失敗就修完再走下一步（verification-before-completion）。

**Step 2: docs commit（工作規則：feature 後跟 docs commit）**

- `docs/plans/2026-06-12-distill-knife-a-input-understanding-design.md`：檔頭狀態加「→ 已實作（本 plan）」
- 本計畫檔：勾掉完成項或標註偏差
- `README.md`：build trigger 行更新（repo 慣例）
- `.env.example`：若 Task 5/8 引入 `AI_AGENT_APPROVE_LLM_MODEL`，補一行註解（default `claude-haiku-4-5`，可不設）

```bash
git add docs/plans/ README.md .env.example
git commit -m "docs(line-agent): 刀A 收尾 — 設計文件標記已實作＋README build trigger"
git push
```

**Step 3: 人工黑箱內測（Eric 拍板的閘：順了才回群展示）**

CC 在 tmux 跑（需 `.env.local` 三閘＋key 齊——**這會真打 API**）：

```bash
npm run agent:approve-parse -- "1 3 要"                       # 層1 命中、零 LLM
npm run agent:approve-parse -- "都收了吧"                      # 層2 → approve_all
npm run agent:approve-parse -- "大車保險一點" --quoted "高爾夫球具可以上車嗎？可以，建議 10 人座 Van"  # 煙測誤讀案例重演
npm run agent:approve-parse -- "清萊一日來得及嗎"               # not_approval → responder
npm run agent:approve-parse -- "第5條收"                       # 超界 → 整批拒絕
```

驗收標準：誤讀案例（「保險一點」）不再被解成車險相關、not_approval 不劫持、超界整批拒絕。跑完把結果摘要回報 Eric，由 Eric 決定是否回群展示。

**✅ 已跑（2026-06-12，CC 代跑）**：5/5 完成，真打 Haiku 共 ≈$0.0035（~$0.0007/次、延遲 1.1–2.2s）。

- 測 1–4 全過：層1 regex 命中（零 LLM）、`approve_all` 收 1、2、3、誤讀案例「大車保險一點」＋引用 → `not_approval` 落 responder（核心驗收過）、「清萊一日來得及嗎」不劫持。
- 測 5 偏差（Eric 拍板接受）：預期「LLM 解出 index 5 → deterministic 整批拒絕」，實際 Haiku 直接判 `not_approval`（重跑一次仍同）。零誤收、`validateAgainstFixture` 兜底仍在；真機 UX 差異＝responder 自由回答而非「沒有第5條」。不調 intent prompt——超界罕見，且調動可能影響測 3/4 的保守判定。
- 閘門備註：CLI 另需 `AI_AGENT_DISTILL_ENABLED=true` 與 `AI_AGENT_DAILY_COST_CAP_USD`（cap 未設＝拒跑，cost 紀律）。本次用 inline env 帶入，`.env.local` 未動；正式啟用前要補。
