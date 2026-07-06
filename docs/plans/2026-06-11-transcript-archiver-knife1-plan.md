# 沉澱管線刀1 — 旁聽存檔層 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 夥伴群每則文字/截圖訊息被動存進 KV（TTL 30 天），截圖進群當下 OCR 成文字一起存——純記錄、零對外行為。

**Architecture:** 沿用現有三層模式：(1) `CaseStore` 介面加 transcript 三方法（contract test 雙實作驗證）；(2) 新 `transcript/archiver.ts` 純函式承載存檔邏輯（OCR 是注入 seam）；(3) `webhook-runtime.ts` 的 `defaultEventHandler` 在 1a 步之後 best-effort 呼叫，失敗絕不堵 webhook。整層被 `AI_AGENT_TRANSCRIPT_ENABLED`（default off）閘住；OCR 額外受現有 daily cost cap 守。

**Tech Stack:** TypeScript / Next.js 14、Upstash Redis（KvClient 介面）、Anthropic vision（重用 `createAnthropicVisionIntakeSource`）、Vitest。

**規格來源:** `docs/plans/2026-06-11-line-oa-knowledge-distillation-design.md` §1–§2 ①層 + 錯誤處理節。

---

## 設計決定（先讀）

| 決定 | 內容 | 理由 |
|---|---|---|
| 環境閘 | `AI_AGENT_TRANSCRIPT_ENABLED`，default off，整層 no-op | 旁聽寫入夥伴對話有隱私重量；M3-0 `ocr` tool-gate 要求 botDirected 不適用被動路徑 |
| Key namespace | `line-agent:transcript:{messageId}`，TTL 2,592,000s（30 天） | 同 messageId 覆寫＝LINE at-least-once 重送冪等（設計文件錯誤處理節） |
| 冪等防雙重 OCR | 寫入前 `getTranscriptEntry`，已存在即 return | 重送的 image event 不能再花一次 vision 錢 |
| OCR prompt | 獨立「全文轉錄」instruction（不用 vision-intake 的「抽客人需求」prompt） | 沉澱需要問＋答兩面，夥伴的回答才是知識 |
| OCR 失敗 | 仍存該筆但 `text: ''` | 設計文件：「沉澱時如實報告有一張圖讀不到」 |
| 存哪些 kind | `group_text` / `group_quoted` → text；`image` → image；`file` / `unknown_group` / OA 全跳過 | 設計文件只涵蓋文字+截圖；OA 客人面絕不入旁聽檔 |
| text 上限 | 5000 chars（LINE 文字訊息上限），防衛性 slice | 同 `BOT_AUTHORED_CONTENT_MAX_CHARS` 的防膨脹思路 |

---

### Task 1: TranscriptEntry 型別 + CaseStore 介面 + contract test（紅→綠雙實作）

**Files:**
- Create: `src/lib/line-agent/transcript/transcript-entry.ts`
- Modify: `src/lib/line-agent/storage/store.ts`（介面尾端加三方法）
- Modify: `src/lib/line-agent/__tests__/case-store-contract.ts`（合約加一個 describe 區塊）
- Modify: `src/lib/line-agent/storage/memory-store.ts`
- Modify: `src/lib/line-agent/storage/kv-store.ts`

**Step 1: 建型別檔**

```typescript
// src/lib/line-agent/transcript/transcript-entry.ts
/**
 * transcript-entry.ts — 沉澱管線刀1（旁聽存檔層）的單筆存檔型別.
 *
 * 夥伴群每則文字/截圖訊息一筆，KV TTL 30 天自動過期（design 2026-06-11 §2 ①）。
 * 截圖「進群當下」OCR 成文字存進 text — 不存圖片本體（省錢＋隱私重量）。
 * priority / distilled 是刀2/刀4 的欄位，刀1 只定義不寫。
 */

export interface TranscriptEntry {
  /** LINE message ID — primary key；同 id 覆寫（LINE at-least-once 冪等）。 */
  messageId: string
  /** 來源夥伴群 groupId（永遠是 partner group；OA 客人面絕不入檔）。 */
  groupId: string
  /** 發話者 LINE userId（顯示名對映留給刀2 編織時做）。 */
  lineUserId: string
  /** LINE event timestamp（ms since epoch）。 */
  timestamp: number
  /** 文字訊息或截圖。 */
  kind: 'text' | 'image'
  /** 原文；截圖＝進群當下的 OCR 文字（OCR 失敗時為 ''，如實留缺）。 */
  text: string
  /** 引用線索 — group_quoted 事件帶的 quotedMessageId（刀2 織對話串用）。 */
  quotedMessageId?: string
  /** 刀4 隨手標：Eric「記一下」標過。刀1 不寫。 */
  priority?: boolean
  /** 刀2 批次沉澱：已被沉澱掃過（避免重複掃）。刀1 不寫。 */
  distilled?: boolean
}

/**
 * 防衛性 text 上限（LINE 文字訊息本身上限 5000 chars；OCR 輸出遠小於此）。
 * 超長一律 slice — 存檔絕不能因一則長訊息膨脹。
 */
export const TRANSCRIPT_TEXT_MAX_CHARS = 5000
```

**Step 2: CaseStore 介面加三方法**（`store.ts` 尾端、`isPartnerGroupImageMsg` 之後）

```typescript
// store.ts 頂部 import 區加：
import type { TranscriptEntry } from '../transcript/transcript-entry'

// interface CaseStore 尾端加：
  // ── 旁聽存檔層（沉澱管線刀1）───────────────────────────────────────────────

  /**
   * Persist one partner-group transcript entry（旁聽存檔，design 2026-06-11 §2 ①）.
   * Idempotent per messageId — LINE at-least-once 重送覆寫同 key，絕不重複記。
   * KV 實作帶 TTL 30 天（滾動窗）；empty messageId 是 no-op。
   * 獨立 key namespace — 永不出現在 listAll()/案件面，OA 客人面永不寫入。
   */
  putTranscriptEntry(entry: TranscriptEntry): Promise<void>

  /**
   * Read one transcript entry by messageId；不存在（或已過期）回 null。
   * Empty messageId 回 null、零 I/O。冪等防雙重 OCR 的前置檢查用。
   */
  getTranscriptEntry(messageId: string): Promise<TranscriptEntry | null>

  /**
   * List all live transcript entries（刀2 批次沉澱掃描＋CLI dry-run 驗證用）。
   * KV 實作走 keys-scan — 不在 webhook 熱路徑上呼叫。
   */
  listTranscriptEntries(): Promise<TranscriptEntry[]>
```

**Step 3: contract test 加區塊**（`case-store-contract.ts` 尾端、最後一個 describe 區塊內部的結尾——與 partner-group image tracking 區塊同層）

```typescript
// 檔案頂部 import 加：
import type { TranscriptEntry } from '../transcript/transcript-entry'

// helper（makeBob 之後）：
function makeTranscriptEntry(
  overrides: Partial<TranscriptEntry> = {}
): TranscriptEntry {
  return {
    messageId: 'MT001',
    groupId: 'G_partner',
    lineUserId: 'U_tsai',
    timestamp: 1_700_000_000_000,
    kind: 'text',
    text: '高山行程2月可以走嗎',
    ...overrides,
  }
}

// describe 區塊內尾端加：
    // ── 旁聽存檔（沉澱管線刀1）─────────────────────────────────────────────

    it('putTranscriptEntry then getTranscriptEntry round-trips the entry', async () => {
      const entry = makeTranscriptEntry({ quotedMessageId: 'MQ9' })
      await store.putTranscriptEntry(entry)
      const got = await store.getTranscriptEntry('MT001')
      expect(got).toEqual(entry)
    })

    it('getTranscriptEntry returns null for unknown and empty messageId', async () => {
      expect(await store.getTranscriptEntry('M_NOPE')).toBeNull()
      expect(await store.getTranscriptEntry('')).toBeNull()
    })

    it('putTranscriptEntry with empty messageId is a no-op', async () => {
      await store.putTranscriptEntry(makeTranscriptEntry({ messageId: '' }))
      expect(await store.listTranscriptEntries()).toEqual([])
    })

    it('a second put with the same messageId overwrites (no duplicate)', async () => {
      await store.putTranscriptEntry(makeTranscriptEntry())
      await store.putTranscriptEntry(makeTranscriptEntry({ text: '改寫後' }))
      const all = await store.listTranscriptEntries()
      expect(all).toHaveLength(1)
      expect(all[0]!.text).toBe('改寫後')
    })

    it('listTranscriptEntries returns every stored entry', async () => {
      await store.putTranscriptEntry(makeTranscriptEntry())
      await store.putTranscriptEntry(
        makeTranscriptEntry({ messageId: 'MT002', kind: 'image', text: '' })
      )
      const all = await store.listTranscriptEntries()
      expect(all.map((e) => e.messageId).sort()).toEqual(['MT001', 'MT002'])
    })

    it('transcript entries never leak into the case plane (listAll)', async () => {
      await store.putTranscriptEntry(makeTranscriptEntry())
      expect(await store.listAll()).toEqual([])
    })
```

**Step 4: 跑測試確認紅**

Run: `npx vitest run src/lib/line-agent/__tests__/memory-store.test.ts src/lib/line-agent/__tests__/kv-store.test.ts`
Expected: FAIL — TS 編譯錯（兩個 store 缺三方法）。

**Step 5: MemoryStore 實作**（`memory-store.ts`）

```typescript
// import 加：
import type { TranscriptEntry } from '../transcript/transcript-entry'

// 欄位（partnerGroupImageMsgs 之後）：
  /**
   * 旁聽存檔（沉澱管線刀1，NOT case state）— messageId → TranscriptEntry。
   * In-memory 不模擬 TTL（同其他 marker 的慣例）；30 天滾動窗只在 KV 層成立。
   */
  private readonly transcriptEntries = new Map<string, TranscriptEntry>()

// 方法（檔案尾端）：
  // ── 旁聽存檔（沉澱管線刀1）─────────────────────────────────────────────────

  async putTranscriptEntry(entry: TranscriptEntry): Promise<void> {
    if (entry.messageId === '') return
    // Shallow copy 防呼叫端透過引用改已存紀錄（同 put 的慣例）。
    this.transcriptEntries.set(entry.messageId, { ...entry })
  }

  async getTranscriptEntry(messageId: string): Promise<TranscriptEntry | null> {
    if (messageId === '') return null
    const entry = this.transcriptEntries.get(messageId)
    return entry ? { ...entry } : null
  }

  async listTranscriptEntries(): Promise<TranscriptEntry[]> {
    return Array.from(this.transcriptEntries.values()).map((e) => ({ ...e }))
  }
```

**Step 6: KvStore 實作**（`kv-store.ts`）

```typescript
// import 加：
import type { TranscriptEntry } from '../transcript/transcript-entry'

// Key helpers 區（PARTNER_GROUP_IMG 常數之後）：
// 旁聽存檔（沉澱管線刀1）— 獨立 namespace，永不 match case:* 。TTL 30 天
// 滾動窗（design 2026-06-11：不永久留存夥伴對話—隱私重量）；同 messageId
// 覆寫＝LINE at-least-once 冪等。
const TRANSCRIPT_PREFIX = 'line-agent:transcript:'
const TRANSCRIPT_TTL_SECONDS = 2_592_000 // 30 days

function transcriptKey(messageId: string): string {
  return `${TRANSCRIPT_PREFIX}${messageId}`
}

// class 尾端方法：
  // ── 旁聽存檔（沉澱管線刀1）─────────────────────────────────────────────────

  async putTranscriptEntry(entry: TranscriptEntry): Promise<void> {
    if (entry.messageId === '') return
    const kv = this.ensureClient()
    await kv.setWithTtl(transcriptKey(entry.messageId), entry, TRANSCRIPT_TTL_SECONDS)
  }

  async getTranscriptEntry(messageId: string): Promise<TranscriptEntry | null> {
    if (messageId === '') return null
    const kv = this.ensureClient()
    return kv.get<TranscriptEntry>(transcriptKey(messageId))
  }

  async listTranscriptEntries(): Promise<TranscriptEntry[]> {
    const kv = this.ensureClient()
    const keys = await kv.keys(`${TRANSCRIPT_PREFIX}*`)
    if (keys.length === 0) return []
    const entries = await Promise.all(keys.map((k) => kv.get<TranscriptEntry>(k)))
    return entries.filter((e): e is TranscriptEntry => e !== null)
  }
```

**Step 7: 跑測試確認綠**

Run: `npx vitest run src/lib/line-agent/__tests__/memory-store.test.ts src/lib/line-agent/__tests__/kv-store.test.ts`
Expected: PASS（含新 6 條 ×2 實作）。

**Step 8: 全套迴歸 + commit**

Run: `npx vitest run src/lib/line-agent && npx tsc --noEmit`
Expected: PASS（其他用 CaseStore 的測試若有自製 fake store 實作整個介面，需補三方法 stub——跑了才知道，逐一補 `async putTranscriptEntry() {}` 式 stub）。

```bash
git add src/lib/line-agent/transcript/transcript-entry.ts src/lib/line-agent/storage/ src/lib/line-agent/__tests__/
git commit -m "feat(line-agent): 沉澱刀1 store 層 — TranscriptEntry + 旁聽存檔三方法（KV TTL 30天）"
git push
```

---

### Task 2: archiver 模組（純邏輯 + OCR seam）

**Files:**
- Create: `src/lib/line-agent/transcript/archiver.ts`
- Test: `src/lib/line-agent/__tests__/transcript-archiver.test.ts`

**Step 1: 寫測試（紅）**

```typescript
// src/lib/line-agent/__tests__/transcript-archiver.test.ts
/**
 * 沉澱管線刀1 — archiver 單元測試.
 *
 * 驗的是純邏輯：閘、kind 對映、OCR seam、冪等防雙重 OCR、fail-safe。
 * store 用 MemoryStore，OCR 用 fake — 零網路、零 key。
 */

import { describe, it, expect, vi } from 'vitest'
import {
  archivePartnerGroupMessage,
  isTranscriptCaptureEnabled,
} from '../transcript/archiver'
import { MemoryStore } from '../storage/memory-store'
import type { NormalizedLineEvent } from '../line/event-normalizer'

const GATE_ON = { AI_AGENT_TRANSCRIPT_ENABLED: 'true' }

function groupTextEvent(
  overrides: Partial<NormalizedLineEvent> = {}
): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M100',
    text: '高山行程2月可以走嗎',
    mentionsBot: false,
    timestamp: 1_700_000_000_000,
    ...overrides,
  }
}

describe('isTranscriptCaptureEnabled', () => {
  it('default off；只有字面 true 開', () => {
    expect(isTranscriptCaptureEnabled({})).toBe(false)
    expect(isTranscriptCaptureEnabled({ AI_AGENT_TRANSCRIPT_ENABLED: 'false' })).toBe(false)
    expect(isTranscriptCaptureEnabled({ AI_AGENT_TRANSCRIPT_ENABLED: '1' })).toBe(false)
    expect(isTranscriptCaptureEnabled({ AI_AGENT_TRANSCRIPT_ENABLED: 'true' })).toBe(true)
    expect(isTranscriptCaptureEnabled({ AI_AGENT_TRANSCRIPT_ENABLED: ' TRUE ' })).toBe(true)
  })
})

describe('archivePartnerGroupMessage', () => {
  it('閘關（default）→ 不寫任何東西', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(groupTextEvent(), store, { env: {} })
    expect(await store.listTranscriptEntries()).toEqual([])
  })

  it('group_text → 存 kind text、原文、發話者、群、時間', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(groupTextEvent(), store, { env: GATE_ON })
    const got = await store.getTranscriptEntry('M100')
    expect(got).toEqual({
      messageId: 'M100',
      groupId: 'G_partner',
      lineUserId: 'U_tsai',
      timestamp: 1_700_000_000_000,
      kind: 'text',
      text: '高山行程2月可以走嗎',
    })
  })

  it('group_quoted → 存 quotedMessageId（刀2 織串的引用線索）', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(
      groupTextEvent({
        kind: 'group_quoted',
        messageId: 'M101',
        text: '這個可以',
        quotedRef: { quotedMessageId: 'M100' },
      }),
      store,
      { env: GATE_ON }
    )
    const got = await store.getTranscriptEntry('M101')
    expect(got?.kind).toBe('text')
    expect(got?.quotedMessageId).toBe('M100')
  })

  it('image → 當下 OCR 入檔（kind image、text=OCR 結果）', async () => {
    const store = new MemoryStore()
    const ocr = vi.fn().mockResolvedValue('客人：2/1 兩大一小，想去茵他儂')
    await archivePartnerGroupMessage(
      groupTextEvent({ kind: 'image', messageId: 'M102', text: undefined }),
      store,
      { env: GATE_ON, ocr }
    )
    expect(ocr).toHaveBeenCalledWith('M102')
    const got = await store.getTranscriptEntry('M102')
    expect(got?.kind).toBe('image')
    expect(got?.text).toBe('客人：2/1 兩大一小，想去茵他儂')
  })

  it('OCR 失敗 → 仍存該筆但 text 空（如實留缺，design 錯誤處理節）', async () => {
    const store = new MemoryStore()
    const ocr = vi.fn().mockRejectedValue(new Error('vision down'))
    await archivePartnerGroupMessage(
      groupTextEvent({ kind: 'image', messageId: 'M103', text: undefined }),
      store,
      { env: GATE_ON, ocr }
    )
    const got = await store.getTranscriptEntry('M103')
    expect(got?.kind).toBe('image')
    expect(got?.text).toBe('')
  })

  it('無 OCR seam（無 key/未接）→ image 仍存、text 空', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(
      groupTextEvent({ kind: 'image', messageId: 'M104', text: undefined }),
      store,
      { env: GATE_ON }
    )
    expect((await store.getTranscriptEntry('M104'))?.text).toBe('')
  })

  it('LINE 重送同 messageId → 跳過（絕不二次 OCR）', async () => {
    const store = new MemoryStore()
    const ocr = vi.fn().mockResolvedValue('OCR文字')
    const event = groupTextEvent({ kind: 'image', messageId: 'M105', text: undefined })
    await archivePartnerGroupMessage(event, store, { env: GATE_ON, ocr })
    await archivePartnerGroupMessage(event, store, { env: GATE_ON, ocr })
    expect(ocr).toHaveBeenCalledTimes(1)
    expect(await store.listTranscriptEntries()).toHaveLength(1)
  })

  it('OA 客人事件 → 永不入檔（隱私邊界）', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(
      groupTextEvent({
        kind: 'oa_text',
        sourceChannel: 'line_oa',
        groupId: undefined,
        messageId: 'M106',
      }),
      store,
      { env: GATE_ON }
    )
    expect(await store.listTranscriptEntries()).toEqual([])
  })

  it('file / unknown_group kind → 跳過（設計只涵蓋文字+截圖）', async () => {
    const store = new MemoryStore()
    for (const kind of ['file', 'unknown_group'] as const) {
      await archivePartnerGroupMessage(
        groupTextEvent({ kind, messageId: `M_${kind}`, text: undefined }),
        store,
        { env: GATE_ON }
      )
    }
    expect(await store.listTranscriptEntries()).toEqual([])
  })

  it('空 messageId → 跳過', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(groupTextEvent({ messageId: '' }), store, {
      env: GATE_ON,
    })
    expect(await store.listTranscriptEntries()).toEqual([])
  })

  it('store 寫入失敗 → 吞掉不 throw（絕不堵 webhook 主流程）', async () => {
    const store = new MemoryStore()
    vi.spyOn(store, 'putTranscriptEntry').mockRejectedValue(new Error('kv down'))
    await expect(
      archivePartnerGroupMessage(groupTextEvent(), store, { env: GATE_ON })
    ).resolves.toBeUndefined()
  })

  it('超長文字 slice 到 5000 chars', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(
      groupTextEvent({ text: 'x'.repeat(6000) }),
      store,
      { env: GATE_ON }
    )
    expect((await store.getTranscriptEntry('M100'))?.text).toHaveLength(5000)
  })
})
```

**Step 2: 跑測試確認紅**

Run: `npx vitest run src/lib/line-agent/__tests__/transcript-archiver.test.ts`
Expected: FAIL — `archiver.ts` 不存在。

**Step 3: 實作 archiver**

```typescript
// src/lib/line-agent/transcript/archiver.ts
/**
 * archiver.ts — 沉澱管線刀1：旁聽存檔層（design 2026-06-11 §1 ①）.
 *
 * 夥伴群每則文字/截圖被動存進 store（KV TTL 30 天）：
 *   - 文字：直接存，零 LLM 零成本
 *   - 截圖：進群「當下」OCR 成文字一起存（LINE 圖片內容會過期，沉澱時才讀
 *     有缺角風險）；OCR 失敗仍存該筆但 text=''（如實留缺）
 *
 * 紀律：
 *   - 整層被 AI_AGENT_TRANSCRIPT_ENABLED 閘住（default off）。被動旁聽沒有
 *     botDirected，所以不能走 M3-0 'ocr' tool-gate；OCR 花費由 vision adapter
 *     內的 daily cost cap 守第二道（雙閘精神不變）。
 *   - FAIL-SAFE：任何失敗（store 壞、OCR 壞）一律吞掉 — 回覆優先於記錄，
 *     絕不堵 webhook 主流程、絕不觸發 LINE 重送。
 *   - 冪等：寫入前查同 messageId，已存在即跳過 — LINE at-least-once 重送
 *     絕不二次 OCR（錢）也不重複記。
 *   - OA 客人面永不入檔（隱私邊界 — 旁聽的是夥伴群，不是客人）。
 */

import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { CaseStore } from '../storage/store'
import type { AgentLogger } from '../observability/structured-log'
import {
  type TranscriptEntry,
  TRANSCRIPT_TEXT_MAX_CHARS,
} from './transcript-entry'

// ---------------------------------------------------------------------------
// 環境閘（default off — 寫入夥伴對話有隱私重量，必須顯式打開）
// ---------------------------------------------------------------------------

export function isTranscriptCaptureEnabled(
  env: Record<string, string | undefined>
): boolean {
  return (env.AI_AGENT_TRANSCRIPT_ENABLED ?? '').trim().toLowerCase() === 'true'
}

// ---------------------------------------------------------------------------
// OCR seam — webhook 端注入（adapter 蓋 transport + daily cost cap）
// ---------------------------------------------------------------------------

/** 把一張 LINE 圖片 messageId 變成轉錄文字。失敗 throw；archiver 內吞。 */
export type TranscriptOcr = (messageId: string) => Promise<string>

export interface ArchiveDeps {
  /** 注入的 OCR；null/省略 ⇒ 截圖仍入檔但 text=''（無 key 環境的退化）。 */
  ocr?: TranscriptOcr | null
  /** 環境（閘）。 */
  env: Record<string, string | undefined>
  /** Per-request structured logger（可選）。 */
  log?: AgentLogger
}

// ---------------------------------------------------------------------------
// 主函式 — best-effort、永不 throw
// ---------------------------------------------------------------------------

export async function archivePartnerGroupMessage(
  event: NormalizedLineEvent,
  store: CaseStore,
  deps: ArchiveDeps
): Promise<void> {
  try {
    if (!isTranscriptCaptureEnabled(deps.env)) return
    // 只旁聽夥伴群 — OA 客人面（隱私邊界）與未知來源一律不入檔。
    if (event.sourceChannel !== 'line_partner_group') return
    if (event.messageId === '' || !event.groupId) return

    // kind 對映：設計只涵蓋文字+截圖；file / sticker / video 等跳過。
    let kind: TranscriptEntry['kind']
    if (event.kind === 'group_text' || event.kind === 'group_quoted') {
      kind = 'text'
    } else if (event.kind === 'image') {
      kind = 'image'
    } else {
      return
    }

    // 冪等：LINE at-least-once 重送 → 同 messageId 已存在即跳過。
    // 這同時是雙重 OCR 的防線（重送的 image 不再花一次 vision 錢）。
    if ((await store.getTranscriptEntry(event.messageId)) !== null) return

    // 截圖：進群當下 OCR。失敗（或無 seam）→ text=''，如實留缺 —
    // 刀2 沉澱時據此報告「有一張圖讀不到」。
    let text: string
    if (kind === 'image') {
      try {
        text = deps.ocr ? await deps.ocr(event.messageId) : ''
      } catch {
        deps.log?.('store_write_failed', { reason: 'transcript_ocr_failed' })
        text = ''
      }
    } else {
      text = event.text ?? ''
    }

    const entry: TranscriptEntry = {
      messageId: event.messageId,
      groupId: event.groupId,
      lineUserId: event.lineUserId,
      timestamp: event.timestamp,
      kind,
      text: text.slice(0, TRANSCRIPT_TEXT_MAX_CHARS),
      ...(event.quotedRef?.quotedMessageId
        ? { quotedMessageId: event.quotedRef.quotedMessageId }
        : {}),
    }
    await store.putTranscriptEntry(entry)
  } catch {
    // FAIL-SAFE：存檔失敗 → 丟該則，絕不堵 webhook（design 錯誤處理節）。
    // Code-only log：raw store error 可能 echo KV url。
    deps.log?.('store_write_failed', { reason: 'transcript_archive_failed' })
  }
}
```

**Step 4: 跑測試確認綠**

Run: `npx vitest run src/lib/line-agent/__tests__/transcript-archiver.test.ts`
Expected: PASS（13 條）。
注意：`log` 的 `reason` 欄位若 structured-log 的型別是 closed union 字串聯集而非自由字串，先看 `observability/structured-log.ts` 的 `store_write_failed` 欄位型別——若是 union，把兩個新 reason code（`transcript_ocr_failed`、`transcript_archive_failed`）加進該 union（一行）。

**Step 5: Commit**

```bash
git add src/lib/line-agent/transcript/archiver.ts src/lib/line-agent/__tests__/transcript-archiver.test.ts src/lib/line-agent/observability/structured-log.ts
git commit -m "feat(line-agent): 沉澱刀1 archiver — 夥伴群被動存檔、截圖當下OCR、fail-safe 冪等"
git push
```

---

### Task 3: OCR 轉錄 prompt — vision adapter 加可選 instruction override

現有 `VISION_EXTRACTION_SYSTEM_INSTRUCTION` 只抽「客人方需求」；沉澱需要問＋答兩面（夥伴的回答才是知識），所以旁聽 OCR 用「全文轉錄」prompt。adapter 加兩個可選 deps，預設值＝現有常數 ⇒ 圖片刀B 行為零改變。

**Files:**
- Modify: `src/lib/line-agent/partner-group/vision-intake-adapter.ts`
- Modify: `src/lib/line-agent/transcript/archiver.ts`（加 prompt 常數）
- Test: `src/lib/line-agent/__tests__/vision-intake-adapter.test.ts`（加 2 條）

**Step 1: 寫測試（紅）** — 在 `vision-intake-adapter.test.ts` 加（先讀該檔現有 fake transport 模式，照抄其 helper）：

```typescript
  it('systemInstruction/userText override 進到 request body', async () => {
    // 照本檔現有 fake transport helper 的模式建 capture transport + 假 200 回應
    // （讀檔後沿用同一個 helper；這裡示意關鍵斷言）
    const source = createAnthropicVisionIntakeSource({
      transport: captureTransport,
      apiKey: 'k',
      costCap: okCostCap,
      systemInstruction: '請完整轉錄',
      userText: '轉錄這張圖',
    })
    await source(fakeImage)
    const body = JSON.parse(capturedInit!.body as string)
    expect(body.system).toBe('請完整轉錄')
    expect(body.messages[0].content[1].text).toBe('轉錄這張圖')
  })

  it('未傳 override 時維持既有抽取 prompt（圖片刀B 零改變）', async () => {
    const source = createAnthropicVisionIntakeSource({
      transport: captureTransport,
      apiKey: 'k',
      costCap: okCostCap,
    })
    await source(fakeImage)
    const body = JSON.parse(capturedInit!.body as string)
    expect(body.system).toBe(VISION_EXTRACTION_SYSTEM_INSTRUCTION)
  })
```

Run: `npx vitest run src/lib/line-agent/__tests__/vision-intake-adapter.test.ts` → FAIL（deps 沒這兩個欄位）。

**Step 2: adapter 實作**

```typescript
// AnthropicVisionIntakeSourceDeps 加：
  /**
   * 可選 system instruction override（沉澱刀1 的全文轉錄 prompt 用）。
   * 省略 ⇒ 既有 VISION_EXTRACTION_SYSTEM_INSTRUCTION（圖片刀B 行為不變）。
   */
  systemInstruction?: string
  /** 可選 user text override — 同上。 */
  userText?: string

// createAnthropicVisionIntakeSource 開頭加：
  const systemInstruction =
    deps.systemInstruction ?? VISION_EXTRACTION_SYSTEM_INSTRUCTION
  const userText = deps.userText ?? EXTRACTION_USER_TEXT

// body 內把 system: VISION_EXTRACTION_SYSTEM_INSTRUCTION 改 system: systemInstruction，
// { type: 'text', text: EXTRACTION_USER_TEXT } 改 text: userText
```

**Step 3: archiver.ts 加轉錄 prompt 常數**（檔案頂部常數區）

```typescript
/**
 * 旁聽 OCR 的轉錄 prompt — 與圖片刀B 的「抽客人需求」不同：沉澱需要問答
 * 兩面（夥伴的回答才是知識），所以這裡是「全文轉錄」。誠實邊界同刀B：
 * 只轉錄實際出現的文字、不腦補、看不清楚標註。
 */
export const TRANSCRIPT_OCR_SYSTEM_INSTRUCTION = [
  '你是清邁包車旅行社的內部紀錄助手。輸入是一張 LINE 對話截圖。',
  '任務：把截圖中「所有出現的對話文字」依序完整轉錄成繁體中文純文字，供旅遊知識沉澱使用。',
  '硬規則：',
  '- 只轉錄截圖中實際出現的文字；不得腦補、不得推測沒寫出來的資訊',
  '- 每則訊息一行；可辨識發話方時加前綴（客人：／夥伴：），不可辨識就不加',
  '- 看不清楚或被截斷的部分，標註（無法辨識），不要猜',
  '- 保留價格、人數、日期、地點等關鍵資訊的原始寫法',
  '- 不得加入你自己的評論或摘要',
  '- 若截圖不是對話（風景照、地圖等），只回一句：這張圖不是對話截圖',
  '只輸出轉錄文字，不要任何前綴、後綴或說明。',
].join('\n')

export const TRANSCRIPT_OCR_USER_TEXT = '請完整轉錄這張截圖中的對話文字。'
```

**Step 4: 跑測試 + commit**

Run: `npx vitest run src/lib/line-agent/__tests__/vision-intake-adapter.test.ts src/lib/line-agent/__tests__/transcript-archiver.test.ts`
Expected: PASS

```bash
git add src/lib/line-agent/partner-group/vision-intake-adapter.ts src/lib/line-agent/transcript/archiver.ts src/lib/line-agent/__tests__/vision-intake-adapter.test.ts
git commit -m "feat(line-agent): 沉澱刀1 OCR prompt — vision adapter 可選 override＋全文轉錄 instruction"
git push
```

---

### Task 4: webhook 接線 — OCR seam + defaultEventHandler 呼叫

**Files:**
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`
- Test: `src/lib/line-agent/__tests__/webhook-runtime.test.ts`（加 3 條）

**Step 1: 寫測試（紅）** — `webhook-runtime.test.ts` 加（沿用該檔 fixture；用 `vi.stubEnv` 開閘，`afterEach` 已有 `vi.restoreAllMocks`，補 `vi.unstubAllEnvs()` 與 `setTranscriptOcr(null)` 還原）：

```typescript
// import 區加 setTranscriptOcr；afterEach 加：
//   setTranscriptOcr(undefined as never) ← 不行，提供 reset：見 Step 2 的 resetTranscriptOcrForTest
// 簡化：setTranscriptOcr 接受 TranscriptOcr | null，測試後 setTranscriptOcr(null)
// （null ⇒ 截圖存檔退化為 text=''，與「無 key」環境相同，對其他測試零影響——
//   其他測試閘都沒開，archiver 直接 return。）

  it('閘開時 group_text 被旁聽存檔（不影響回覆行為）', async () => {
    vi.stubEnv('AI_AGENT_TRANSCRIPT_ENABLED', 'true')
    const store = new MemoryStore()
    await getEventHandler()(
      taggedPartnerGroupEvent({ mentionsBot: false, text: '高山2月可以嗎', replyToken: undefined }),
      store
    )
    const got = await store.getTranscriptEntry('M001')
    expect(got?.kind).toBe('text')
    expect(got?.text).toBe('高山2月可以嗎')
    vi.unstubAllEnvs()
  })

  it('閘開時 image 經注入 OCR 入檔，且既有 image-marker 行為不變', async () => {
    vi.stubEnv('AI_AGENT_TRANSCRIPT_ENABLED', 'true')
    setTranscriptOcr(async () => '客人：兩大一小')
    const store = new MemoryStore()
    await getEventHandler()(
      taggedPartnerGroupEvent({ kind: 'image', mentionsBot: false, text: undefined, replyToken: undefined }),
      store
    )
    expect((await store.getTranscriptEntry('M001'))?.text).toBe('客人：兩大一小')
    expect(await store.isPartnerGroupImageMsg('M001')).toBe(true) // 1a 不受影響
    vi.unstubAllEnvs()
  })

  it('閘關（default）→ 完全不入檔（現行行為零改變）', async () => {
    const store = new MemoryStore()
    await getEventHandler()(
      taggedPartnerGroupEvent({ mentionsBot: false, replyToken: undefined }),
      store
    )
    expect(await store.listTranscriptEntries()).toEqual([])
  })
```

Run: `npx vitest run src/lib/line-agent/__tests__/webhook-runtime.test.ts` → FAIL（`setTranscriptOcr` 不存在）。

**Step 2: webhook-runtime.ts 實作**

(a) import 區加：

```typescript
import {
  archivePartnerGroupMessage,
  isTranscriptCaptureEnabled,
  TRANSCRIPT_OCR_SYSTEM_INSTRUCTION,
  TRANSCRIPT_OCR_USER_TEXT,
  type TranscriptOcr,
} from '@/lib/line-agent/transcript/archiver'
```

(b) 新 seam（reply client seam 之後，照同樣的 lazy 模式）：

```typescript
// ---------------------------------------------------------------------------
// Transcript OCR seam — 沉澱管線刀1（旁聽存檔的截圖轉錄）
// ---------------------------------------------------------------------------

/**
 * 旁聽存檔的截圖 OCR（messageId → 轉錄文字）。LAZY：首讀才建；無 Anthropic
 * key ⇒ null（截圖仍入檔但 text=''）。與圖片刀B 共用 content-client 與
 * daily cost cap 工廠（同一個每日預算池 — KV 計量是跨 instance 的），但
 * prompt 是沉澱專用的全文轉錄版。閘（AI_AGENT_TRANSCRIPT_ENABLED）由
 * archiver/handler 把守，這裡只負責「能不能轉錄」。
 */
let _transcriptOcr: TranscriptOcr | null | undefined = undefined

/** Override（測試注入 fake；null ⇒ 無 OCR 退化）。 */
export function setTranscriptOcr(ocr: TranscriptOcr | null): void {
  _transcriptOcr = ocr
}

/** Read the current transcript OCR（handler 在閘開時呼叫）。 */
export function getTranscriptOcr(): TranscriptOcr | null {
  if (_transcriptOcr === undefined) {
    const models = getPartnerResponderConfig()
    if (!models.anthropicApiKey) {
      _transcriptOcr = null
    } else {
      const vision = createAnthropicVisionIntakeSource({
        transport: fetch,
        apiKey: models.anthropicApiKey,
        costCap: createDailyCostCap({ env: process.env, kv: createKvClientFromEnv() }),
        systemInstruction: TRANSCRIPT_OCR_SYSTEM_INSTRUCTION,
        userText: TRANSCRIPT_OCR_USER_TEXT,
      })
      _transcriptOcr = async (messageId) => {
        // Channel token 在 CALL time 讀（mirror reply client）。
        const image = await fetchLineImageContent(
          messageId,
          process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ''
        )
        return vision(image)
      }
    }
  }
  return _transcriptOcr
}
```

(c) `defaultEventHandler` 內、步驟 1a 之後加：

```typescript
  // 1a-2. 沉澱管線刀1 — 旁聽存檔：夥伴群文字/截圖被動入 KV（TTL 30 天），
  //       截圖進群當下 OCR。閘 default off ⇒ 此行為不存在。archiver 內部
  //       fail-safe（吞錯）— 回覆優先於記錄，絕不堵 webhook。閘先查再取
  //       OCR seam，閘關時連 adapter 都不建。
  if (isTranscriptCaptureEnabled(process.env)) {
    await archivePartnerGroupMessage(event, store, {
      ocr: getTranscriptOcr(),
      env: process.env,
      log,
    })
  }
```

**Step 3: 跑測試確認綠 + 全套迴歸**

Run: `npx vitest run src/lib/line-agent/__tests__/webhook-runtime.test.ts && npx vitest run src/lib/line-agent && npx tsc --noEmit`
Expected: PASS 全綠。

**Step 4: Commit**

```bash
git add src/lib/line-agent/line/webhook-runtime.ts src/lib/line-agent/__tests__/webhook-runtime.test.ts
git commit -m "feat(line-agent): 沉澱刀1 接線 — webhook 旁聽存檔＋transcript OCR seam（閘 default off）"
git push
```

---

### Task 5: env 範例 + 文件收尾

**Files:**
- Modify: `.env.example`（`AI_AGENT_OCR_ENABLED` 附近加一行）
- Modify: `docs/plans/2026-06-11-line-oa-knowledge-distillation-design.md`（實作順序節標記刀1 done + commit hash）
- Modify: `README.md`（build trigger，照 house rule）

**Step 1: `.env.example`** 在 `AI_AGENT_OCR_ENABLED=false` 之後加：

```bash
# 沉澱管線刀1 — 夥伴群旁聽存檔（KV TTL 30天、截圖當下OCR）。default off。
AI_AGENT_TRANSCRIPT_ENABLED=false
```

**Step 2: 設計文件**實作順序節，刀1 行尾加 `✅ done（YYYY-MM-DD，<hash>）`。

**Step 3: 驗證後 docs commit**

```bash
npx vitest run src/lib/line-agent && npx tsc --noEmit && npm run lint
git add .env.example docs/plans/2026-06-11-line-oa-knowledge-distillation-design.md README.md
git commit -m "docs(line-agent): 沉澱刀1 完成標記＋.env.example 加 AI_AGENT_TRANSCRIPT_ENABLED"
git push
```

---

## 驗收（上線前，照設計文件「測試」節）

1. 全套 vitest 綠 + `tsc --noEmit` 綠 + lint 綠。
2. 部署後 Vercel 環境**不設** `AI_AGENT_TRANSCRIPT_ENABLED` ⇒ 行為零改變（先 ship 閘關版）。
3. 真資料 dry-run（與 Eric 同步後）：本地 `.env.local` 開閘＋真 KV，私測群丟一則文字+一張截圖，用一個 10 行 CLI script 撈 `listTranscriptEntries()` 驗證兩筆都在、截圖有 OCR 文字。此步驟屬驗收，不在本計畫 commit 範圍。
