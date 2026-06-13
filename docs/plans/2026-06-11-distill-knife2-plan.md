# 沉澱刀2 — 批次沉澱 + 過目 dry-run 實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eric 在夥伴群 `@bot 沉澱` → 掃 30 天旁聽存檔 → 一次 Sonnet 呼叫產出最多 5 條候選問答 → 貼回群；Eric 回「1 3 要」「都要」「2 改成XXX再收」→ 記錄批准狀態（**dry-run：不寫 Notion**，那是刀3）。

**Architecture:** 新模組 `src/lib/line-agent/distill/`（純函式為主），LLM adapter mirror `case-intake-llm-adapter.ts`（transport 注入＋costCap REQUIRED＋fixed-code error＋截斷偵測），router B1 照 `done` 指令前例攔截（explicit-token parser，不動 intent.ts），pending 狀態存 KV 新 namespace。閘 `AI_AGENT_DISTILL_ENABLED` default off ⇒ ship 零行為改變。

**Tech Stack:** TypeScript、Vitest、Upstash KV（注入式 client）、Anthropic Messages API（fetch transport）。

**設計來源:** `docs/plans/2026-06-11-line-oa-knowledge-distillation-design.md` §2 ③＋§3 ④。

---

## 定案的設計決定

| 決策點 | 定案 | 理由 |
|---|---|---|
| 觸發指令 | `@bot 沉澱`（tagged 或 quote-to-bot），explicit-token regex 攔截 | 照 `parseCaseDoneCommand` 前例（`cases/handled-command.ts:24`）；不加 IntentAction ⇒ permissions.ts 零改動。設計 §2 ②「intent.ts 加意圖」屬刀4 remember |
| 環境閘 | `AI_AGENT_DISTILL_ENABLED`，字面 `'true'` 才開，default off | 同 `isTranscriptCaptureEnabled` 慣例；閘關 ⇒ webhook 不建 seam，router 行為零改變 |
| LLM 模型 | explicit > `AI_AGENT_DISTILL_LLM_MODEL` > default `claude-sonnet-4-6` | 設計 §2 指定 Sonnet；resolve 模式同 `resolveCaseIntakeLlmModel` |
| 標 distilled | 新 store 方法 `markTranscriptDistilled`，**保留剩餘 TTL** | 直接 `putTranscriptEntry` 會重設 30 天 TTL → 隱私窗變 60 天，違反設計「滾動 30 天」 |
| Pending 存放 | KV 新 namespace `line-agent:distill-pending:{groupId}`，singleton per group，TTL 30 天 | 「沒回就掛著，下次合併再提」需要跨請求狀態；同 transcript namespace 紀律（永不 match `case:*`） |
| 略過兩次不再提 | batch 內每條 `missedCount`，新一輪沉澱時 pending 條 +1，≥2 即丟 | 行動即投票（設計 §3） |
| 批准者 | 群內任何夥伴（同 done 指令） | B1 tagged path 本來就是群級權限；Eric 主導但不額外鎖人 |
| dry-run 邊界 | 批准只把候選移進 batch 的 `resolved` 清單＋回 ack；**絕不碰 Notion** | 刀3 才開 `KNOWLEDGE_WRITE_ENABLED`；resolved 清單就是刀3 的輸入 |
| 掃描為空 | 不打 LLM，直接回固定文案 | 成本守門：零新訊息＝零花費 |
| 失敗順序 | LLM 失敗或 pending 寫入失敗 → **不標 distilled**，回固定錯誤文案；重跑冪等 | 設計 §3 錯誤處理：「沉澱 LLM 失敗 → distilled 不標，重跑冪等安全」 |
| 發話者匿名化 | weaver 把 lineUserId 依出現順序映成 夥伴A/B/C… 再進 prompt | 不把 raw userId 送出去 |
| ack 延遲 | Sonnet inline await（與刀1 OCR 同款已知風險）；LINE 重送由 `claimPartnerReply` 擋 | 手動觸發、月跑數次；dry-run 驗收時量延遲，超時再改 post-ack |

---

## Task 1: Store 擴充（markTranscriptDistilled ＋ distill-pending put/get）

**Files:**
- Modify: `src/lib/line-agent/storage/store.ts`（介面，~line 157 前加方法）
- Modify: `src/lib/line-agent/storage/kv-store.ts`（KvClient 加 `ttl()`、KvStore 實作）
- Modify: `src/lib/line-agent/storage/memory-store.ts`
- Create: `src/lib/line-agent/distill/pending.ts`（型別）
- Modify: `src/lib/line-agent/__tests__/case-store-contract.ts`（contract tests）
- 注意：搜尋 repo 內其他 `KvClient` mock（`grep -rn "KvClient" src/`），mock 補 `ttl()`

**Step 1: 先寫型別（pending.ts）**

```typescript
/**
 * pending.ts — 沉澱刀2：過目 pending batch 型別（design 2026-06-11 §3 ④）.
 */

export type DistillCandidateStatus = 'pending' | 'approved' | 'modified'

export interface DistillCandidate {
  /** 呈現編號（1-based，每次貼出重編）— Eric 回「1 3 要」對應這個。 */
  id: number
  question: string
  answer: string
  /** 出處 transcript messageIds（刀3 寫 Notion 出處欄用）。 */
  sourceMessageIds: string[]
  /** LLM 判定的出現次數（≥2 或 priority 才入選）。 */
  occurrences: number
  status: DistillCandidateStatus
  /** 「2 改成XXX再收」時存 Eric 改寫的答案；status='modified' 才有。 */
  modifiedAnswer?: string
  /** 被貼出但 Eric 沒回應的次數；≥2 不再提（行動即投票）。 */
  missedCount: number
}

export interface DistillPendingBatch {
  groupId: string
  /** ms since epoch — 由呼叫端注入（determinism）。 */
  createdAt: number
  /** 本輪呈現中的候選（status 一律 'pending'）。 */
  candidates: DistillCandidate[]
  /** 已批准/已修改、等刀3 寫 Notion 的累積清單。 */
  resolved: DistillCandidate[]
}
```

**Step 2: store.ts 介面加三方法**（`listTranscriptEntries` 之後）

```typescript
  /**
   * 把一筆 transcript entry 標為已沉澱（distilled=true），**保留剩餘 TTL** —
   * 絕不重設 30 天（隱私滾動窗不得因掃描而延長）。entry 不存在/已過期＝no-op。
   */
  markTranscriptDistilled(messageId: string): Promise<void>

  /** 寫入該群的沉澱過目 pending batch（singleton per groupId，覆寫語意）。 */
  putDistillPending(batch: DistillPendingBatch): Promise<void>

  /** 讀該群 pending batch；不存在回 null。 */
  getDistillPending(groupId: string): Promise<DistillPendingBatch | null>
```

import `DistillPendingBatch` from `../distill/pending`。

**Step 3: contract test 先寫（紅）**

在 `case-store-contract.ts` 既有 transcript suite 旁加：

- `markTranscriptDistilled`: put 一筆 → mark → get 回 `distilled: true` 其餘欄位不變
- `markTranscriptDistilled` 不存在的 messageId → no-op 不 throw
- `putDistillPending`/`getDistillPending` round-trip（含 candidates/resolved 巢狀欄位）
- `getDistillPending` 未知 groupId → null
- `putDistillPending` 同 groupId 二次 → 覆寫（讀到第二份）

Run: `npx vitest run src/lib/line-agent/__tests__/ -t "distill"` → 預期 FAIL（方法不存在）。

**Step 4: memory-store.ts 實作**

```typescript
  private readonly distillPending = new Map<string, DistillPendingBatch>()

  async markTranscriptDistilled(messageId: string): Promise<void> {
    const existing = this.transcripts.get(messageId)   // ← 對齊現有欄位名
    if (!existing) return
    this.transcripts.set(messageId, { ...existing, distilled: true })
  }

  async putDistillPending(batch: DistillPendingBatch): Promise<void> {
    if (batch.groupId === '') return
    this.distillPending.set(batch.groupId, structuredClone(batch))
  }

  async getDistillPending(groupId: string): Promise<DistillPendingBatch | null> {
    if (groupId === '') return null
    return structuredClone(this.distillPending.get(groupId) ?? null)
  }
```

**Step 5: kv-store.ts 實作**

KvClient 介面加（`keys()` 旁）：

```typescript
  /** TTL key — 剩餘秒數；無 TTL 回 -1、key 不存在回 -2（Redis 語意）。 */
  ttl(key: string): Promise<number>
```

Upstash adapter 加：`ttl(key) { return redis.ttl(key) }`。

Namespace（`TRANSCRIPT_TTL_SECONDS` 之後）：

```typescript
// 沉澱過目 pending batch（刀2）— singleton per groupId。TTL 30 天：candidates
// 的源頭 transcript 最多也只活 30 天，掛更久沒有意義。
const DISTILL_PENDING_PREFIX = 'line-agent:distill-pending:'
const DISTILL_PENDING_TTL_SECONDS = 2_592_000 // 30 days
```

方法：

```typescript
  async markTranscriptDistilled(messageId: string): Promise<void> {
    if (messageId === '') return
    const kv = this.ensureClient()
    const key = transcriptKey(messageId)
    const entry = await kv.get<TranscriptEntry>(key)
    if (entry === null) return
    // 保留剩餘 TTL：先讀 TTL 再以同值覆寫。讀寫間若恰好過期（ttl ≤ 0），
    // 跳過 — 寧可漏標（重掃一次）也絕不把 30 天窗變永久。
    const remaining = await kv.ttl(key)
    if (remaining <= 0) return
    await kv.setWithTtl(key, { ...entry, distilled: true }, remaining)
  }

  async putDistillPending(batch: DistillPendingBatch): Promise<void> {
    if (batch.groupId === '') return
    const kv = this.ensureClient()
    await kv.setWithTtl(
      `${DISTILL_PENDING_PREFIX}${batch.groupId}`, batch, DISTILL_PENDING_TTL_SECONDS)
  }

  async getDistillPending(groupId: string): Promise<DistillPendingBatch | null> {
    if (groupId === '') return null
    const kv = this.ensureClient()
    return kv.get<DistillPendingBatch>(`${DISTILL_PENDING_PREFIX}${groupId}`)
  }
```

**Step 6: 跑測試（綠）＋全套**

```bash
npx vitest run src/lib/line-agent/__tests__/  # 全綠，含既有 KvClient mock 補 ttl()
```

**Step 7: Commit** `feat(line-agent): 沉澱刀2 store 層 — markTranscriptDistilled 保 TTL＋distill-pending batch`

---

## Task 2: 對話串編織（thread-weaver，純函式）

**Files:**
- Create: `src/lib/line-agent/distill/thread-weaver.ts`
- Create: `src/lib/line-agent/__tests__/distill-thread-weaver.test.ts`

**Step 1: 測試先寫**（紅）— 案例：

1. 按 timestamp 升冪排序（輸入亂序）
2. lineUserId 依首次出現順序映成 `夥伴A`/`夥伴B`…；raw userId **絕不**出現在輸出
3. `quotedMessageId` 命中存檔內訊息 → 該行加 `（回覆 #<被引序號>）`；引用不存在的 id → 不註記
4. `kind: 'image'` 且 text 非空 → 行首 `（截圖）`；text 空 → 不入文，計入 `unreadableImageCount`
5. 回傳 `scannedMessageIds` ＝ 所有輸入 entry 的 messageId（含讀不到的圖 — 它們也要標 distilled，否則每輪重複報告）
6. 空輸入 → `promptText: ''`、counts 0

**Step 2: 實作**

```typescript
/**
 * thread-weaver.ts — 沉澱刀2：把 30 天 transcript 織成 LLM 可讀對話串
 * （design 2026-06-11 §2 ③「按引用關係+時間織成對話串」）.
 *
 * 純函式零 I/O。發話者匿名化（夥伴A/B/C…）— raw lineUserId 永不進 prompt。
 */

import type { TranscriptEntry } from '../transcript/transcript-entry'

export interface WovenTranscript {
  /** 給 LLM 的對話串全文；空存檔時為 ''。 */
  promptText: string
  /** OCR 失敗的截圖數（text === ''）— 過目回覆裡如實報告。 */
  unreadableImageCount: number
  /** 本次掃過的所有 messageId（成功沉澱後標 distilled 用）。 */
  scannedMessageIds: string[]
}

export function weaveTranscript(entries: TranscriptEntry[]): WovenTranscript {
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp)
  const alias = new Map<string, string>()
  const seq = new Map<string, number>() // messageId → 行序號（引用註記用）
  const lines: string[] = []
  let unreadableImageCount = 0

  for (const e of sorted) {
    if (e.kind === 'image' && e.text === '') {
      unreadableImageCount += 1
      continue
    }
    if (!alias.has(e.lineUserId)) {
      // 夥伴A..Z，超過 26 人回繞補數字（防衛性；實際群遠小於此）
      const n = alias.size
      alias.set(e.lineUserId, `夥伴${String.fromCharCode(65 + (n % 26))}${n >= 26 ? n : ''}`)
    }
    const lineNo = lines.length + 1
    seq.set(e.messageId, lineNo)
    const quoted = e.quotedMessageId !== undefined ? seq.get(e.quotedMessageId) : undefined
    const parts = [
      `#${lineNo}`,
      `[${alias.get(e.lineUserId)}]`,
      ...(quoted !== undefined ? [`（回覆 #${quoted}）`] : []),
      ...(e.kind === 'image' ? ['（截圖）'] : []),
      e.text,
    ]
    lines.push(parts.join(' '))
  }

  return {
    promptText: lines.join('\n'),
    unreadableImageCount,
    scannedMessageIds: sorted.map((e) => e.messageId),
  }
}
```

（細節以測試為準；`#行序號` 同時是 LLM 引用出處的座標——prompt 會要求 LLM 回 `sourceLines`，orchestrator 再映回 messageIds。見 Task 4 prompt。修正：為了讓 LLM 出處可映射，`WovenTranscript` 再加 `lineToMessageId: Record<number, string>`，weaver 一併回傳。）

**Step 3: 跑測試（綠）→ Commit** `feat(line-agent): 沉澱刀2 thread-weaver — 時間+引用織串、匿名化、讀不到的圖如實計數`

---

## Task 3: 候選零信任解析（candidates.ts）

**Files:**
- Create: `src/lib/line-agent/distill/candidates.ts`
- Create: `src/lib/line-agent/__tests__/distill-candidates.test.ts`

**Step 1: 測試先寫** — 案例：

1. 合法 JSON 陣列 → 解析出 `{question, answer, sourceLines, occurrences}[]`
2. 帶 code fence（```json … ```）→ 剝掉後照常解析（LLM 慣性防衛）
3. 非 JSON / 非陣列 / 元素缺欄位或型別錯 → throw `DistillParseError`（fixed code，不帶原文）
4. 超過 5 條 → slice 前 5
5. question/answer 超長（>500 chars）→ slice（防衛性）
6. `occurrences` 非正整數 → 視為 1；`sourceLines` 非陣列 → `[]`

**Step 2: 實作** — `parseDistillCandidates(raw: string): ParsedCandidate[]`，zero-trust 風格同 `case-intake-enrichment.ts`（解析與 guards 全在這層，adapter 只回 raw text）。

**Step 3: 綠 → Commit** `feat(line-agent): 沉澱刀2 候選 zero-trust 解析 — cap 5、欄位防衛、fixed-code error`

---

## Task 4: Distill LLM adapter（mirror case-intake adapter）

**Files:**
- Create: `src/lib/line-agent/distill/distill-llm-adapter.ts`
- Create: `src/lib/line-agent/__tests__/distill-llm-adapter.test.ts`

**Step 1: 測試先寫**（fake transport，照 `case-intake-llm-adapter` 測試模式）：

1. `resolveDistillModel`: explicit > env(`AI_AGENT_DISTILL_LLM_MODEL`) > `'claude-sonnet-4-6'`
2. costCap `checkBudget` 非 `ok` → 不打 transport、throw `DistillLlmError('cost_cap_*')`
3. 200 回應 → 回 raw text、`recordSpend` 被叫到（用量缺 → 保守估，絕不記 0）
4. `stop_reason === 'max_tokens'` → throw `DistillLlmError('max_tokens_truncated')`（截斷的 JSON 不可信 — 同刀1 vision adapter `vision-intake-adapter.ts:234` 紀律）
5. transport throw / 非 200 / parse 失敗 → fixed-code throw，錯誤訊息不含 key/prompt/回文

**Step 2: 實作** — 結構照抄 `case-intake-llm-adapter.ts:113-252`（deps：`transport`/`apiKey`/`costCap` REQUIRED/`model?`/`env?`/`log?`），差異：

- `DISTILL_MAX_TOKENS = 2048`
- system prompt（export 給測試）：

```typescript
export const DISTILL_SYSTEM_INSTRUCTION = [
  '你是清邁包車旅行社的知識整理助手。輸入是夥伴群最近 30 天的對話紀錄（已匿名化、含截圖轉錄）。',
  '任務：找出「重複出現的常規問答」（價格範圍、景點、路線可行性等），整理成知識庫候選。',
  '硬規則：',
  '- 只收「同類問題出現 ≥2 次」的常規問答；一次性的個案談判（特殊喬價、特例安排）一律排除',
  '- 答案只能來自對話中夥伴實際說過的內容；不得腦補、不得加入你自己的旅遊知識',
  '- 最多 5 條；不足 5 條就回實際數量；完全沒有 → 回 []',
  '- question / answer 用繁體中文、各 500 字以內；answer 保留價格數字、時間等原始寫法',
  '只回 JSON 陣列，格式：',
  '[{"question":"…","answer":"…","sourceLines":[行號數字],"occurrences":N}]',
  'sourceLines 是該問答出處的 # 行號。不要任何前綴、後綴、說明或 code fence。',
].join('\n')
```

- user prompt ＝ weaver 的 `promptText`
- export type `DistillSource = (promptText: string) => Promise<string>`；factory `createAnthropicDistillSource(deps): DistillSource`

**Step 3: 綠 → Commit** `feat(line-agent): 沉澱刀2 LLM adapter — Sonnet 預設、costCap 必接、截斷偵測`

---

## Task 5: 沉澱 orchestrator（run-distillation.ts）

**Files:**
- Create: `src/lib/line-agent/distill/run-distillation.ts`
- Create: `src/lib/line-agent/__tests__/distill-run.test.ts`（MemoryStore＋fake DistillSource fixture）

**Step 1: 測試先寫** — 案例（每條一個 test）：

1. 閘：`isDistillEnabled({AI_AGENT_DISTILL_ENABLED:'true'})` true；未設/false/`'TRUE '` trim+lowercase 規則同 `isTranscriptCaptureEnabled`
2. 指令解析：`isDistillCommand('@bot 沉澱')`/`('沉澱')` true；`('幫我看看沉澱物')` false（規則：剝 mention 後 trim ＝＝ '沉澱' 才算，杜絕誤觸）
3. 零新訊息＋零 carryover → 不叫 source、回固定文案「30 天內沒有新的可沉澱訊息」
4. 有新訊息 → source 收到織好的 promptText；回覆含編號候選清單＋回覆方式說明
5. 成功後：掃過的 entries（含 text='' 的圖）都被 `markTranscriptDistilled`；pending batch 寫入、candidates ids ＝ 1..N
6. source throw → **沒有任何** entry 被標 distilled、pending 不動、回固定錯誤文案（重跑冪等）
7. carryover：先建一個 pending batch（candidates 2 條 status pending）→ 再跑 → 舊候選 missedCount+1 後與新候選合併重編號；missedCount 已達 1 的那條這次沒被回 → 下次跑就被丟掉（≥2 不再提）
8. 讀不到的圖 → 回覆末尾「⚠️ 有 N 張截圖讀不到，已略過」
9. 只掃觸發事件的 groupId；`distilled: true` 的不重掃
10. resolved 清單在新一輪沉澱後保留不動（刀3 的輸入不能被洗掉）

**Step 2: 實作**

```typescript
export function isDistillEnabled(env: Record<string, string | undefined>): boolean
export function isDistillCommand(text: string): boolean
// mention 剝法參考 responder 對 event.text 的處理；核心： strip /@\S+/ 後 trim === '沉澱'

export interface RunDistillationInput {
  groupId: string
  store: CaseStore
  source: DistillSource
  /** ms since epoch — injected for determinism. */
  now: number
  log?: AgentLogger
}

/** 回 HandlerResult-shaped 物件（router 直接掛進 decision）。 */
export async function runDistillation(input: RunDistillationInput): Promise<HandlerResult>
```

流程（依測試）：

1. `listTranscriptEntries()` → filter `groupId` match 且 `distilled !== true`
2. `getDistillPending(groupId)` → carryover ＝ status `'pending'` 且 `missedCount + 1 < 2` 的候選（missedCount +1）；`resolved` 原樣保留
3. 新訊息空 ＋ carryover 空 → 固定文案 return（**不叫 source**）
4. 新訊息非空 → `weaveTranscript` → `source(promptText)` → `parseDistillCandidates` → `sourceLines` 經 `lineToMessageId` 映回 `sourceMessageIds`
5. batch ＝ carryover ＋ 新候選（新候選 missedCount 0、status pending），重編 id 1..N → `putDistillPending`
6. pending 寫入成功後才逐筆 `markTranscriptDistilled(scannedMessageIds)`（單筆失敗吞掉繼續 — 漏標只是下次重掃，比中斷好）
7. 回覆文案：

```
📚 沉澱候選（N 條）：
1️⃣ Q：…
    A：…（出現 2 次）
…
回覆方式：「1 3 要」｜「都要」｜「2 改成〇〇再收」；不回的下次沉澱再提。
⚠️ 有 1 張截圖讀不到，已略過
```

**Step 3: 綠 → Commit** `feat(line-agent): 沉澱刀2 orchestrator — 掃檔織串一次 LLM、carryover 合併、略過兩次即棄、失敗不標 distilled`

---

## Task 6: 過目批准（approval.ts）

**Files:**
- Create: `src/lib/line-agent/distill/approval.ts`
- Create: `src/lib/line-agent/__tests__/distill-approval.test.ts`

**Step 1: 測試先寫** —

`parseDistillApproval(text)`（純函式；先剝 mention 再 match）：

| 輸入 | 期望 |
|---|---|
| `1 3 要` / `1、3要` / `1,3 要` | `{type:'approve', indices:[1,3]}` |
| `都要` / `全部要` / `全要` | `{type:'approve_all'}` |
| `2 改成包含保險再收` | `{type:'modify', index:2, newAnswer:'包含保險'}` |
| `好啊`、`要不要去吃飯`、`1` | `null` |
| `0 要` / `1 2 2 要` | indices 去重、過濾 <1（`[1,2]`；全空 → null） |

`applyDistillApproval({store, groupId, parsed, now})`：

1. 無 pending batch → 回 `null`（router 落回 responder）
2. `approve [1,3]` → 1、3 移入 resolved（status approved）、其餘留 pending、ack 列出已收/仍掛
3. `approve` 帶超界 index（如 9）→ 不動任何狀態、回「沒有第 9 條」提示文案
4. `approve_all` → 全部移 resolved
5. `modify 2` → status modified、`modifiedAnswer` 存 Eric 版本、移入 resolved
6. ack 文案明示 dry-run：「（dry-run：刀3 開閘後才寫入 Notion）」

**Step 2: 實作**（regex 核心）：

```typescript
const APPROVE_ALL_RE = /^(都要|全部要|全要)$/
const APPROVE_RE = /^([\d\s,、]+)要$/
const MODIFY_RE = /^(\d+)\s*改成([\s\S]+?)再收$/
```

**Step 3: 綠 → Commit** `feat(line-agent): 沉澱刀2 過目批准 — 「1 3 要／都要／N 改成…再收」解析＋dry-run 狀態記錄`

---

## Task 7: Router ＋ send gate 接線

**Files:**
- Modify: `src/lib/line-agent/commands/router.ts`
- Modify: `src/lib/line-agent/line/partner-reply-gate.ts:40`
- Modify/Create: router 測試（既有 router 測試檔旁加 `distill-router.test.ts`）

**Step 1: 測試先寫** —

1. B1 ＋ `@bot 沉澱` ＋ `input.distill` 注入 → `action:'distill'`、handlerResult 來自 seam 的 `run`
2. B1 ＋ `@bot 1 3 要` ＋ pending 存在 → `action:'distill'`、來自 `approve`
3. `approve` 回 null（無 pending）→ 落回 responder（`action:'respond'`）
4. `input.distill` 未注入（閘關）→ `沉澱` 一路走 responder，行為與現狀完全相同（零行為改變守門測試）
5. 非 botDirected 的「沉澱」→ silent（B2 不變）
6. gate：`shouldReplyToPartnerGroup` 對 `action:'distill'`＋outboundText → true

**Step 2: 實作** —

`RouterAction` 加 `| 'distill'`（`router.ts:148-159`）；`RouterInput` 加：

```typescript
  /**
   * 沉澱刀2 seam — webhook 在 AI_AGENT_DISTILL_ENABLED 開時注入；未注入 ⇒
   * 整條路徑不存在（ship 零行為改變）。run/approve 都回 HandlerResult；
   * approve 回 null ＝ 不是批准語句或無 pending → 落回 responder。
   */
  distill?: {
    run(groupId: string): Promise<HandlerResult>
    approve(groupId: string, text: string): Promise<HandlerResult | null>
  }
```

B1 區塊、`parseCaseDoneCommand` 檢查之後（`router.ts:316` 附近）插入：

```typescript
        // 沉澱刀2 — explicit-token 指令（同 done 前例：parser 攔截、不走
        // intent）。seam 未注入（閘關）⇒ 此 if 不存在，行為與 ship 前相同。
        if (input.distill && event.groupId) {
          if (isDistillCommand(event.text ?? '')) {
            const handlerResult = await input.distill.run(event.groupId)
            return { action: 'distill', source, handlerResult, intent: earlyIntent }
          }
          const approval = await input.distill.approve(event.groupId, event.text ?? '')
          if (approval !== null) {
            return { action: 'distill', source, handlerResult: approval, intent: earlyIntent }
          }
        }
```

（確認 `NormalizedLineEvent` 的 groupId 欄位名——刀1 archiver 用 `event.groupId`，照用。）

`partner-reply-gate.ts:40` 改為：

```typescript
    (decision.action === 'respond' || decision.action === 'mark_handled' || decision.action === 'distill') &&
```

並更新檔頭註解第 4 條。

**Step 3: 綠（router 全套＋gate 測試）→ Commit** `feat(line-agent): 沉澱刀2 router 接線 — distill seam B1 攔截＋send gate 放行`

---

## Task 8: Webhook 接線（lazy seam、閘 default off）

**Files:**
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`（import、`getDistillSeams()` lazy singleton 照 `getTranscriptOcr()` 模式 ~line 792、`routeCommand` 呼叫處 line 303-312）
- Modify: webhook 測試（既有 webhook-runtime 測試檔）

**Step 1: 測試先寫** —

1. 閘未設 → `routeCommand` 收到的 `distill` 為 undefined（零行為改變）
2. 閘開＋`@bot 沉澱`（注入 MemoryStore＋fake transport）→ reply client 收到候選清單文字
3. 沉澱回覆送出後照常 `putBotAuthoredPartnerMsg`（讓 Eric 之後 quote 候選清單回「1 3 要」免重 tag — 現成 step 6 邏輯自動涵蓋，測試固定它）

**Step 2: 實作** — `defaultEventHandler` 的 `routeCommand` 呼叫加：

```typescript
    distill: isDistillEnabled(process.env)
      ? buildDistillSeams(store, log)
      : undefined,
```

`buildDistillSeams`（模組尾、`getTranscriptOcr` 旁）：lazy 建 `createDailyCostCap`＋`createAnthropicDistillSource`（transport ＝ fetch、apiKey ＝ `process.env.ANTHROPIC_API_KEY`、env ＝ process.env），包成 `{run, approve}`：`run` → `runDistillation({groupId, store, source, now: Date.now(), log})`；`approve` → `parseDistillApproval` ＋ `applyDistillApproval`。key 缺 → seam 不建（回 undefined，閘形同關，log 一行 fixed code）。

**Step 3: 綠＋全套＋lint**

```bash
npx vitest run src/lib/line-agent/ && npx next lint --dir src/lib/line-agent
```

**Step 4: Commit** `feat(line-agent): 沉澱刀2 webhook 接線 — AI_AGENT_DISTILL_ENABLED 閘住 lazy seam（default off）`

---

## Task 9: CLI dry-run ＋ 收尾（docs commit）

**Files:**
- Modify: `scripts/agent-command.mjs`（加 `distill-dry-run` 子命令，照 `case-done`/`overdue-dry-run` 模式 ~line 116/1124）
- Modify: `package.json:28` 後加 `"agent:distill-dry-run": "tsx --env-file=.env.local scripts/agent-command.mjs distill-dry-run"`
- Modify: `.env.example`（`AI_AGENT_TRANSCRIPT_ENABLED` 旁加 `AI_AGENT_DISTILL_ENABLED=false` ＋ `# AI_AGENT_DISTILL_LLM_MODEL=` 註解）
- Modify: `docs/plans/2026-06-11-line-oa-knowledge-distillation-design.md:152`（刀2 標 ✅ done ＋ commits）
- Modify: `README.md`（build trigger 行）

**Step 1: CLI 子命令** — **唯讀 dry-run**：真 KV `listTranscriptEntries` → filter → weave → 真 LLM → 印候選到 stdout。**不標 distilled、不寫 pending、不貼群** —— 上線前驗證 LLM 品質用，跑幾次都不留痕。groupId 取 `LINE_PARTNER_GROUP_ID`。記得先檢查 `.env.local` 三閘＋key（memory：CLI 會載 .env.local，齊了就會實打真 API、真花錢）。

**Step 2: feature commit** `feat(line-agent): 沉澱刀2 CLI dry-run — 唯讀掃檔+LLM 候選預覽（不標記不落地）`

**Step 3: docs commit** `docs(line-agent): 沉澱刀2 收尾 — 設計文件標記＋.env.example 閘＋README build trigger`（含本計畫文件入庫）。Push。

---

## 驗收清單

- [ ] `npx vitest run src/lib/line-agent/` 全綠（既有 1334+ 新增全部）
- [ ] `npx next lint --dir src/lib/line-agent` 零警告
- [ ] 閘未設時：webhook/router 路徑與 9f7ad3b 行為完全相同（Task 7/8 的零行為改變測試固定）
- [ ] `npm run agent:distill-dry-run` 對真 KV 跑一次，肉眼驗 LLM 候選品質（**會花 ~$0.05–0.15**，跑前向 Eric 確認）
- [ ] 私測群實測（開閘後）：`@bot 沉澱` → 候選清單；回「1 要」→ ack；再「沉澱」→ 略過的條目 missedCount 生效

## 已知風險（記錄，不擋刀2）

- **ack 延遲**：沉澱是 inline await（KV scan ＋ Sonnet 呼叫，估 5–15s）。手動觸發、月跑數次，先接受；與刀1 OCR 同列「開閘前量延遲」項目，超時就改 post-ack。LINE 重送由 `claimPartnerReply` 擋（claim 在 responder/distill 之前）。
- **KV `keys()` scan**：`listTranscriptEntries` 走 keys-scan，30 天訊息量級（百則）沒問題；已在 store 註解標明不進熱路徑。
- **OCR 覆寫 race**：剛進群的截圖若 OCR 在飛時被沉澱掃到，`markTranscriptDistilled` 與 OCR 覆寫可能互洗（後寫贏）。機率極低（手動觸發），最壞情況＝該則下次重掃或 distilled 標丟失一次，自癒。
- **Mention 剝法對含空白顯示名失效**（final review Important）：`isDistillCommand`/`parseDistillApproval` 用 `/@\S+/g` 剝 mention——若 bot 顯示名含空白（如「@清微 Bot」），剝完殘留尾段 → 指令靜默落回 responder。**私測群實測時優先驗證**；命中再改 mention offset 結構化剝除。quote-to-bot 路徑免 mention 可繞過。
- **兩個近距離「沉澱」指令不互斥**：`claimPartnerReply` 只擋同 messageId 重送；連打兩次（不同訊息）會雙重計費＋pending 互洗。手動觸發月跑數次，與 OCR race 同級，接受。

## 排程決策：維持手動，不建 cron（2026-06-13 定案）

刀2 全程設計就是**手動觸發**（`@bot 沉澱` / CLI `agent:distill-flush`），月跑數次。曾有「§3 刀2 cron」待辦，盤點後**結案為刻意手動，不建 Vercel cron**，理由：

- 「手動沉澱」是知識沉澱四刀的刻意一環（被動旁聽→**手動沉澱**→LINE 過目→Notion RAG），自動 cron 會跳過「過目」那刀的人為把關。
- 本計畫 §30 / 已知風險已多處把「手動觸發、月跑數次」當作 ack 延遲、OCR race、雙觸發互洗等風險的**接受前提**；改自動排程等於同時放大這三項風險。
- cron 另需 CRON_SECRET 驗證、頻率/時段決策、API 額度常態消耗，收益不抵成本。

未來流量上升（如開 OA 1:1 客服）若要重評，再另開設計，呼叫點不動（`run-distillation` orchestrator 已與觸發方式解耦）。
