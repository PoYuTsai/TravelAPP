# 廣告刀1：LINE OA 被動記錄 → 每日轉換表自動填 Sheet — 施工計畫

> **For Claude:** REQUIRED SUB-SKILL: 用 superpowers:executing-plans 逐刀實作本計畫。
> 設計來源定稿：`docs/plans/2026-07-06-ads-daily-conversion-sheet-design.md`（先讀）。

**Goal:** LINE OA 1:1 被動記錄「加好友→詢問」，每日 09:00（曼谷）cron 用 Haiku 摘要後自動 append 進代操 Google Sheet，Eric 只手動勾「成交✓」。

**Architecture:** 兩條互不阻塞的線。(1) webhook 熱路徑：normalizer 擴收 `follow` → 新增 `oa-contact-recorder`（獨立檔、獨立 KV record、零 LLM、fail-safe，絕不碰 OA 建案/回覆主流程）。(2) 冷路徑 cron：掃 KV（有 `firstMessageAt` 且未 `sheetWritten`）→ Haiku 摘要（閘＋日 cap，敗→原文節錄）→ 手刻 JWT(RS256) 換 access token → Sheets REST `values:append` → KV 標 `sheetWritten` 冪等。

**Tech Stack:** TypeScript / Next.js 14 App Router / Vitest / `@anthropic-ai/sdk`（走既有 fetch-transport 封裝）/ `@upstash/redis`（既有 KvStore）/ Web Crypto `crypto.subtle`（RS256，**不引入 googleapis**）。

**鐵律（全程不得違反）：**
- OA 客人訊息**絕不自動回**：normalizer 對 `line_oa` 的 `mentionsBot` 恆 false，本刀只加被動記錄。
- recorder 任何失敗**吞掉**，絕不 throw、絕不堵 webhook、絕不觸發 LINE 重送、絕不影響 OA 建案主流程（`route.ts:118-126` 只有 `CasePersistenceError` 會 500）。
- 所有新閘 **default off**（`.trim().toLowerCase() === 'true'`），gate-off 時行為 byte-identical。
- 全程 TDD：先寫失敗測試 → 跑到紅 → 最小實作 → 跑到綠 → commit。DRY / YAGNI / 頻繁 commit。
- 測試零網路零 key：fake transport / fake LLM / MemoryStore；真連線只在最後 smoke（Task 8 尾）。

**測試指令慣例：** `npx vitest run <path> -t "<name>"`（單測）；`npx vitest run src/lib/line-agent` 收斂。

---

## 刀序總覽

| 刀 | 產出 | 依賴 |
|----|------|------|
| 1 | normalizer 擴收 `follow` → kind `oa_follow` | 無 |
| 2 | `OaContactRecord` 型別 + store 介面/契約 + MemoryStore 實作 | 1 |
| 3 | KvStore 實作 `OaContactRecord`（TTL 60 天） | 2 |
| 4 | `oa-contact-recorder.ts` 被動記錄邏輯（閘＋fail-safe） | 2 |
| 5 | 接線進 webhook-runtime seam（gate-off byte-identical） | 4 |
| 6 | Sheets client（JWT RS256 → `values:append`，注入 seam） | 無（可與 1–5 平行） |
| 7 | Haiku 摘要 adapter（閘＋日 cap，敗→原文節錄） | 無（可與 1–5 平行） |
| 8 | cron route `/api/cron/ads-daily-sheet` + `vercel.json` + 冪等 runner | 2,3,6,7 |

---

## Task 1：normalizer 擴收 `follow` → 新 kind `oa_follow`

**Files:**
- Modify: `src/lib/line-agent/line/event-normalizer.ts:49-55`（union）、`:193-195`（follow 分支）
- Test: `src/lib/line-agent/line/__tests__/event-normalizer.test.ts`（若無此檔則新建，仿既有 normalizer 測試放置）

**背景：** 目前 `normalizeLineEvent` 在 `event-normalizer.ts:195` 對所有 `raw.type !== 'message'` 直接回 `null`。follow 事件形狀：`{ type:'follow', timestamp, source:{ type:'user', userId }, replyToken }`（無 `message`）。

**Step 1：寫失敗測試**

```ts
// event-normalizer.test.ts
import { normalizeLineEvent } from '../event-normalizer'

describe('follow event', () => {
  it('normalizes a user follow into oa_follow', () => {
    const ev = normalizeLineEvent(
      { type: 'follow', timestamp: 1720000000000, source: { type: 'user', userId: 'U123' } },
      'Gpartner',
    )
    expect(ev).toEqual({
      kind: 'oa_follow',
      sourceChannel: 'line_oa',
      lineUserId: 'U123',
      messageId: '',
      mentionsBot: false,
      timestamp: 1720000000000,
      replyToken: undefined,
    })
  })

  it('ignores a follow from a non-user source (group/room)', () => {
    expect(
      normalizeLineEvent({ type: 'follow', timestamp: 1, source: { type: 'group', groupId: 'Gx' } }, 'Gpartner'),
    ).toBeNull()
  })

  it('still ignores unfollow / other non-message events', () => {
    expect(normalizeLineEvent({ type: 'unfollow', source: { type: 'user', userId: 'U1' } }, 'Gp')).toBeNull()
  })
})
```

**Step 2：跑到紅** — `npx vitest run src/lib/line-agent/line/__tests__/event-normalizer.test.ts -t "oa_follow"` → 預期 FAIL（回 null）。

**Step 3：最小實作**

union 加一行（`event-normalizer.ts:49-55` 的 `NormalizedLineEventKind`）：
```ts
  | 'oa_follow'      // OA 1:1 加好友事件（廣告刀1 被動記錄用；無 message）
```

`event-normalizer.ts:195` 的 `if (raw.type !== 'message') return null` **之前**插入：
```ts
  // 廣告刀1：follow 事件僅對 OA 1:1（source.type==='user'）有意義，升格成 oa_follow。
  // 其他非 message 事件維持 fail-closed 照丟。
  if (raw.type === 'follow') {
    const followSource = raw.source ?? {}
    if (followSource.type !== 'user') return null
    return {
      kind: 'oa_follow',
      sourceChannel: 'line_oa',
      lineUserId: followSource.userId ?? '',
      messageId: '',
      mentionsBot: false,
      timestamp: raw.timestamp ?? Date.now(),
      replyToken: typeof raw.replyToken === 'string' ? raw.replyToken : undefined,
    }
  }
```

**Step 4：跑到綠** — 同 Step 2 指令 → PASS；再跑 `npx vitest run src/lib/line-agent/line` 確認未回歸。

**Step 5：commit**
```bash
git add src/lib/line-agent/line/event-normalizer.ts src/lib/line-agent/line/__tests__/event-normalizer.test.ts
git commit -m "feat(ads): 刀1 normalizer 擴收 follow→oa_follow（TDD）"
```

---

## Task 2：`OaContactRecord` 型別 + store 介面/契約 + MemoryStore 實作

**範本（照抄 transcript 三方法）：** interface `storage/store.ts:148-160`、MemoryStore `storage/memory-store.ts:61,203-216`、契約 `__tests__/case-store-contract.ts:62,297-341`。

**Files:**
- Create: `src/lib/line-agent/ads/oa-contact-record.ts`（型別）
- Modify: `src/lib/line-agent/storage/store.ts`（interface 加 3 方法）
- Modify: `src/lib/line-agent/storage/memory-store.ts`（Map 假實作）
- Modify: `src/lib/line-agent/__tests__/case-store-contract.ts`（契約區塊 + fixture）
- （若 `storage/select-store.ts` 也 `implements CaseStore` 的 delegating wrapper → 同步加轉呼）

**Step 1：型別檔**
```ts
// src/lib/line-agent/ads/oa-contact-record.ts
/** 單則 OA 客人訊息（僅文字）。 */
export interface OaContactMessage {
  ts: number
  text: string
}

/** 廣告刀1 被動記錄：一個 OA 客人的加好友＋詢問足跡。KV key = userId。 */
export interface OaContactRecord {
  userId: string
  followedAt?: number
  firstMessageAt?: number
  messages?: OaContactMessage[]   // 上限 OA_MESSAGES_MAX，保留最新
  sheetWritten?: boolean          // cron 寫入 Sheet 後標記，冪等用
}

export const OA_MESSAGES_MAX = 20
export const OA_TEXT_MAX_CHARS = 2000
```

**Step 2：介面加方法**（`store.ts:160` 後，仿 transcript 三方法）：
```ts
  /** 廣告刀1：以 userId 存/取/列 OA 被動記錄。 */
  putOaContactRecord(record: OaContactRecord): Promise<void>
  getOaContactRecord(userId: string): Promise<OaContactRecord | null>
  listOaContactRecords(): Promise<OaContactRecord[]>
```
（同檔頂部 import `type { OaContactRecord } from '../ads/oa-contact-record'`。）

**Step 3：契約 fixture + 區塊**（`case-store-contract.ts`，仿 `makeTranscriptEntry:43-55` 與 transcript 區塊 `:297-341`）：
```ts
function makeOaContactRecord(over: Partial<OaContactRecord> = {}): OaContactRecord {
  return { userId: 'U1', followedAt: 1720000000000, ...over }
}

describe(`${label} — OaContactRecord`, () => {
  it('round-trips put/get by userId', async () => {
    const store = makeStore()
    await store.putOaContactRecord(makeOaContactRecord({ userId: 'Uabc', firstMessageAt: 5, messages: [{ ts: 5, text: 'hi' }] }))
    expect(await store.getOaContactRecord('Uabc')).toEqual(
      makeOaContactRecord({ userId: 'Uabc', firstMessageAt: 5, messages: [{ ts: 5, text: 'hi' }] }),
    )
  })
  it('returns null for unknown or empty userId', async () => {
    const store = makeStore()
    expect(await store.getOaContactRecord('nope')).toBeNull()
    expect(await store.getOaContactRecord('')).toBeNull()
  })
  it('overwrite is idempotent (last write wins)', async () => {
    const store = makeStore()
    await store.putOaContactRecord(makeOaContactRecord({ userId: 'Ux' }))
    await store.putOaContactRecord(makeOaContactRecord({ userId: 'Ux', sheetWritten: true }))
    expect((await store.getOaContactRecord('Ux'))?.sheetWritten).toBe(true)
  })
  it('lists all records', async () => {
    const store = makeStore()
    await store.putOaContactRecord(makeOaContactRecord({ userId: 'Ua' }))
    await store.putOaContactRecord(makeOaContactRecord({ userId: 'Ub' }))
    expect((await store.listOaContactRecords()).map((r) => r.userId).sort()).toEqual(['Ua', 'Ub'])
  })
})
```
（檔頂 import `OaContactRecord`。）

**Step 4：跑到紅** — `npx vitest run src/lib/line-agent/storage/__tests__/memory-store.test.ts` → 編譯錯（MemoryStore 缺方法）。

**Step 5：MemoryStore 實作**（`memory-store.ts`，仿 `:61` 與 `:203-216`）：
```ts
private readonly oaContactRecords = new Map<string, OaContactRecord>()

async putOaContactRecord(record: OaContactRecord): Promise<void> {
  if (record.userId === '') return
  this.oaContactRecords.set(record.userId, { ...record })
}
async getOaContactRecord(userId: string): Promise<OaContactRecord | null> {
  if (userId === '') return null
  const r = this.oaContactRecords.get(userId)
  return r ? { ...r } : null
}
async listOaContactRecords(): Promise<OaContactRecord[]> {
  return [...this.oaContactRecords.values()].map((r) => ({ ...r }))
}
```

**Step 6：跑到綠** — 同 Step 4 指令 → MemoryStore 契約區塊 PASS（KvStore 契約會在 Task 3 才綠；此刻 `kv-store.test.ts` 可能仍紅，正常）。

**Step 7：commit**
```bash
git add src/lib/line-agent/ads/oa-contact-record.ts src/lib/line-agent/storage/store.ts src/lib/line-agent/storage/memory-store.ts src/lib/line-agent/__tests__/case-store-contract.ts
git commit -m "feat(ads): 刀2 OaContactRecord 型別＋store 契約＋MemoryStore（TDD）"
```

---

## Task 3：KvStore 實作 `OaContactRecord`（TTL 60 天）

**範本：** KvStore transcript 方法 `storage/kv-store.ts:398-415`、TTL 常數 `:188`、namespace key `:218`。

**Files:**
- Modify: `src/lib/line-agent/storage/kv-store.ts`

**Step 1：跑到紅** — `npx vitest run src/lib/line-agent/storage/__tests__/kv-store.test.ts` → 編譯錯（KvStore 缺方法）。

**Step 2：實作**（仿既有 transcript 方法；namespace 前綴自訂 `oa:contact:`，TTL 60 天）：
```ts
const OA_CONTACT_TTL_SECONDS = 60 * 24 * 60 * 60  // 60 天（寫入 Sheet 後 Sheet 即 source of truth）
const OA_CONTACT_KEY_PREFIX = 'oa:contact:'

async putOaContactRecord(record: OaContactRecord): Promise<void> {
  if (record.userId === '') return
  await this.client.set(`${OA_CONTACT_KEY_PREFIX}${record.userId}`, JSON.stringify(record), {
    ex: OA_CONTACT_TTL_SECONDS,
  })
  // list 索引：仿既有 transcript list 的 index set 寫法（見 kv-store.ts 既有 list 實作）
}
async getOaContactRecord(userId: string): Promise<OaContactRecord | null> {
  if (userId === '') return null
  const raw = await this.client.get(`${OA_CONTACT_KEY_PREFIX}${userId}`)
  return raw ? (typeof raw === 'string' ? JSON.parse(raw) : (raw as OaContactRecord)) : null
}
async listOaContactRecords(): Promise<OaContactRecord[]> {
  // 照抄 listTranscriptEntries 的 index-set 掃法（同 kv-store.ts 既有實作）
}
```
> ⚠️ 執行者：先讀 `kv-store.ts:398-415` 的 `listTranscriptEntries` 看它是用 index set 還是 `scan`，`putOaContactRecord`/`list` 必須採**同一個** list 機制，別自創。`@upstash/redis` 的 `get` 依 client 設定可能已自動 JSON parse — 照既有 transcript get 的處理方式對齊。

**Step 3：跑到綠** — 同 Step 1 指令 → KvStore 契約區塊 PASS。再跑 `npx vitest run src/lib/line-agent/storage` 全綠。

**Step 4：commit**
```bash
git add src/lib/line-agent/storage/kv-store.ts
git commit -m "feat(ads): 刀3 KvStore OaContactRecord（TTL 60 天，TDD）"
```

---

## Task 4：`oa-contact-recorder.ts` 被動記錄邏輯

**範本：** archiver `transcript/archiver.ts:32-36`（閘）、`:83`（簽章）、`:88-146`（fail-safe）。

**Files:**
- Create: `src/lib/line-agent/ads/oa-contact-recorder.ts`
- Test: `src/lib/line-agent/ads/__tests__/oa-contact-recorder.test.ts`

**Step 1：寫失敗測試**（用 MemoryStore，零 LLM 零網路）
```ts
import { MemoryStore } from '../../storage/memory-store'
import { recordOaContactEvent, isOaCaptureEnabled } from '../oa-contact-recorder'
import type { NormalizedLineEvent } from '../../line/event-normalizer'

const ON = { AI_AGENT_OA_CAPTURE_ENABLED: 'true' }
const follow = (userId: string, ts = 1000): NormalizedLineEvent =>
  ({ kind: 'oa_follow', sourceChannel: 'line_oa', lineUserId: userId, messageId: '', mentionsBot: false, timestamp: ts })
const oaText = (userId: string, text: string, ts: number): NormalizedLineEvent =>
  ({ kind: 'oa_text', sourceChannel: 'line_oa', lineUserId: userId, messageId: 'm', text, mentionsBot: false, timestamp: ts })

describe('recordOaContactEvent', () => {
  it('gate off → no write, byte-identical', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(follow('U1'), s, { env: {} })
    expect(await s.getOaContactRecord('U1')).toBeNull()
  })
  it('follow → creates record with followedAt', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(follow('U1', 111), s, { env: ON })
    expect(await s.getOaContactRecord('U1')).toMatchObject({ userId: 'U1', followedAt: 111 })
  })
  it('follow is idempotent — second follow does not overwrite followedAt', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(follow('U1', 111), s, { env: ON })
    await recordOaContactEvent(follow('U1', 999), s, { env: ON })
    expect((await s.getOaContactRecord('U1'))?.followedAt).toBe(111)
  })
  it('first text → sets firstMessageAt and appends message', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(follow('U1', 100), s, { env: ON })
    await recordOaContactEvent(oaText('U1', ' 想問清邁包車 ', 200), s, { env: ON })
    const r = await s.getOaContactRecord('U1')
    expect(r).toMatchObject({ firstMessageAt: 200, messages: [{ ts: 200, text: '想問清邁包車' }] })
  })
  it('text without prior follow still records (follow may be missed)', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(oaText('U2', 'hi', 5), s, { env: ON })
    expect(await s.getOaContactRecord('U2')).toMatchObject({ userId: 'U2', firstMessageAt: 5 })
  })
  it('caps messages at OA_MESSAGES_MAX keeping the newest', async () => {
    const s = new MemoryStore()
    for (let i = 1; i <= 25; i++) await recordOaContactEvent(oaText('U1', `m${i}`, i), s, { env: ON })
    const r = await s.getOaContactRecord('U1')
    expect(r?.messages).toHaveLength(20)
    expect(r?.messages?.[0].text).toBe('m6')
    expect(r?.messages?.at(-1)?.text).toBe('m25')
  })
  it('preserves sheetWritten across later text', async () => {
    const s = new MemoryStore()
    await s.putOaContactRecord({ userId: 'U1', firstMessageAt: 1, sheetWritten: true })
    await recordOaContactEvent(oaText('U1', 'more', 9), s, { env: ON })
    expect((await s.getOaContactRecord('U1'))?.sheetWritten).toBe(true)
  })
  it('skips non-OA / non-text-follow events (image, partner group)', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent({ kind: 'image', sourceChannel: 'line_oa', lineUserId: 'U1', messageId: 'm', mentionsBot: false, timestamp: 1 }, s, { env: ON })
    await recordOaContactEvent({ kind: 'group_text', sourceChannel: 'line_partner_group', lineUserId: 'U1', messageId: 'm', text: 'x', mentionsBot: false, timestamp: 1 }, s, { env: ON })
    expect(await s.getOaContactRecord('U1')).toBeNull()
  })
  it('empty text is ignored', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(oaText('U1', '   ', 5), s, { env: ON })
    expect(await s.getOaContactRecord('U1')).toBeNull()
  })
  it('swallows store errors (fail-safe, never throws)', async () => {
    const boom = { getOaContactRecord: async () => { throw new Error('kv down') }, putOaContactRecord: async () => {} } as any
    await expect(recordOaContactEvent(follow('U1'), boom, { env: ON })).resolves.toBeUndefined()
  })
})
```

**Step 2：跑到紅** — `npx vitest run src/lib/line-agent/ads/__tests__/oa-contact-recorder.test.ts` → FAIL（模組不存在）。

**Step 3：實作**
```ts
// src/lib/line-agent/ads/oa-contact-recorder.ts
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { CaseStore } from '../storage/store'
import { OA_MESSAGES_MAX, OA_TEXT_MAX_CHARS, type OaContactRecord } from './oa-contact-record'

export function isOaCaptureEnabled(env: Record<string, string | undefined>): boolean {
  return (env.AI_AGENT_OA_CAPTURE_ENABLED ?? '').trim().toLowerCase() === 'true'
}

export interface OaContactRecorderDeps {
  env: Record<string, string | undefined>
  log?: (code: string, meta?: Record<string, unknown>) => void
}

/**
 * 廣告刀1 被動記錄。fail-safe：任何失敗吞掉，絕不 throw、絕不堵 webhook。
 * 只處理 line_oa 的 oa_follow / oa_text，其餘一律略過。
 */
export async function recordOaContactEvent(
  event: NormalizedLineEvent,
  store: CaseStore,
  deps: OaContactRecorderDeps,
): Promise<void> {
  try {
    if (!isOaCaptureEnabled(deps.env)) return
    if (event.sourceChannel !== 'line_oa') return
    const userId = event.lineUserId
    if (userId === '') return

    if (event.kind === 'oa_follow') {
      const existing = await store.getOaContactRecord(userId)
      if (existing?.followedAt) return // 冪等：已記過加好友日就不覆寫
      await store.putOaContactRecord({ ...(existing ?? {}), userId, followedAt: event.timestamp })
      return
    }

    if (event.kind === 'oa_text') {
      const text = (event.text ?? '').trim()
      if (text === '') return
      const existing: OaContactRecord = (await store.getOaContactRecord(userId)) ?? { userId }
      const messages = [
        ...(existing.messages ?? []),
        { ts: event.timestamp, text: text.slice(0, OA_TEXT_MAX_CHARS) },
      ].slice(-OA_MESSAGES_MAX)
      await store.putOaContactRecord({
        ...existing,
        userId,
        firstMessageAt: existing.firstMessageAt ?? event.timestamp,
        messages,
      })
      return
    }
    // image / sticker / file / group 事件 → 略過（熱路徑零成本）
  } catch {
    deps.log?.('oa_contact_record_failed', {})
  }
}
```

**Step 4：跑到綠** — 同 Step 2 指令 → 全 PASS。

**Step 5：commit**
```bash
git add src/lib/line-agent/ads/oa-contact-recorder.ts src/lib/line-agent/ads/__tests__/oa-contact-recorder.test.ts
git commit -m "feat(ads): 刀4 oa-contact-recorder 被動記錄（閘＋fail-safe，TDD）"
```

---

## Task 5：接線進 webhook-runtime seam

**插入點：** `src/lib/line-agent/line/webhook-runtime.ts:298-304`（archiver 旁聽段旁邊；`defaultEventHandler` @ `:256`）。

**Files:**
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`
- Test: `src/lib/line-agent/line/__tests__/webhook-runtime.test.ts`（仿既有；若既有測試檔龐大，新增獨立 `webhook-oa-capture.test.ts`）

**Step 1：寫失敗測試** — 斷言「gate on 時 OA follow/text 會落 store」「gate off 時 store 不動且 OA 建案主流程回應不變（byte-identical）」。用既有 webhook-runtime 測試的 harness（fake store + `defaultEventHandler`）；斷言 recorder 被呼叫且其拋錯不影響回傳。

```ts
it('gate on: OA text is passively recorded without affecting reply path', async () => {
  process.env.AI_AGENT_OA_CAPTURE_ENABLED = 'true'
  const store = new MemoryStore()
  await defaultEventHandler(
    { kind: 'oa_text', sourceChannel: 'line_oa', lineUserId: 'U1', messageId: 'm', text: '想包車', mentionsBot: false, timestamp: 7 },
    store,
  )
  expect(await store.getOaContactRecord('U1')).toMatchObject({ userId: 'U1', firstMessageAt: 7 })
})
it('gate off: no OA record written (byte-identical path)', async () => {
  delete process.env.AI_AGENT_OA_CAPTURE_ENABLED
  const store = new MemoryStore()
  await defaultEventHandler({ kind: 'oa_follow', sourceChannel: 'line_oa', lineUserId: 'U1', messageId: '', mentionsBot: false, timestamp: 1 }, store)
  expect(await store.getOaContactRecord('U1')).toBeNull()
})
```
> 執行者：先看 `webhook-runtime.test.ts` 既有如何呼叫 `defaultEventHandler`／`setEventHandler`，沿用其注入慣例。`oa_follow` 事件在 `defaultEventHandler` 內原本會走到哪（`botDirected:false`→非建案）要確認，recorder 呼叫必須在建案分流**之前或旁路**且被 try 包住不影響原回傳。

**Step 2：跑到紅** — `npx vitest run src/lib/line-agent/line -t "passively recorded"` → FAIL。

**Step 3：實作** — 在 `webhook-runtime.ts:298-304` archiver 段**之後**插入（仿其結構）：
```ts
    // 1a-3. 廣告刀1 — OA 被動記錄（獨立閘、fail-safe，不碰回覆/建案主流程）
    if (isOaCaptureEnabled(process.env)) {
      await recordOaContactEvent(event, store, { env: process.env, log })
    }
```
頂部 import：`import { isOaCaptureEnabled, recordOaContactEvent } from '../ads/oa-contact-recorder'`。
> 若 `oa_follow` 事件目前根本到不了 `defaultEventHandler`（webhook route 早段擋掉非建案類）→ 追到 `route.ts:113-117` 分流，確保 `oa_follow` 這個新 kind 會被送進 handler（至少送進 recorder seam）。這是本刀最可能的暗坑，務必端到端驗一次。

**Step 4：跑到綠** — 同 Step 2 指令 → PASS；再 `npx vitest run src/lib/line-agent/line` 全綠（確認未回歸既有 OA 建案／partner 回覆測試）。

**Step 5：commit**
```bash
git add src/lib/line-agent/line/webhook-runtime.ts src/lib/line-agent/line/__tests__/
git commit -m "feat(ads): 刀5 接線 OA 被動記錄進 webhook seam（gate-off byte-identical，TDD）"
```

---

## Task 6：Sheets client（JWT RS256 → `values:append`）

**設計：** 不引入 googleapis。手刻 JWT(RS256, Web Crypto) 換 access token → 打 Sheets REST。`signAssertion` 做成注入 seam，主流程測試零 crypto 零網路。

**Files:**
- Create: `src/lib/line-agent/ads/sheets-client.ts`
- Test: `src/lib/line-agent/ads/__tests__/sheets-client.test.ts`

**Step 1：寫失敗測試**（fake transport + 注入 fake signAssertion）
```ts
import { createSheetsClient } from '../sheets-client'

const SA = JSON.stringify({ client_email: 'sa@proj.iam.gserviceaccount.com', private_key: 'unused-in-this-test' })

function fakeTransport(calls: any[]) {
  return async (url: any, init: any) => {
    calls.push({ url: String(url), init })
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'ya29.fake', expires_in: 3600 }) } as any
    }
    return { ok: true, status: 200, json: async () => ({ updates: { updatedRows: 1 } }) } as any
  }
}

describe('createSheetsClient.appendRows', () => {
  it('exchanges JWT for token then appends rows via REST', async () => {
    const calls: any[] = []
    const client = createSheetsClient({
      transport: fakeTransport(calls),
      serviceAccountJson: SA,
      now: () => 1_720_000_000_000,
      signAssertion: async () => 'header.payload.sig',
    })
    await client.appendRows('SHEET_ID', '轉換!A1', [['2026-07-06', '清邁包車', '4', '18000', '2026-07-05', '', '', '自動']])

    const tokenCall = calls.find((c) => c.url.includes('oauth2'))
    expect(tokenCall.init.body).toContain('assertion=header.payload.sig')
    const appendCall = calls.find((c) => c.url.includes('/values/'))
    expect(appendCall.url).toContain('/SHEET_ID/values/')
    expect(appendCall.url).toContain(':append')
    expect(appendCall.url).toContain('valueInputOption=USER_ENTERED')
    expect(appendCall.init.headers.Authorization).toBe('Bearer ya29.fake')
    expect(JSON.parse(appendCall.init.body)).toEqual({ values: [['2026-07-06', '清邁包車', '4', '18000', '2026-07-05', '', '', '自動']] })
  })

  it('throws a non-minified error when append fails', async () => {
    const transport = async (url: any) =>
      String(url).includes('oauth2')
        ? ({ ok: true, status: 200, json: async () => ({ access_token: 't' }) } as any)
        : ({ ok: false, status: 403, text: async () => 'PERMISSION_DENIED: sheet not shared' } as any)
    const client = createSheetsClient({ transport, serviceAccountJson: SA, signAssertion: async () => 's' })
    await expect(client.appendRows('S', 'A1', [['x']])).rejects.toThrow(/403.*PERMISSION_DENIED/)
  })
})
```

**Step 2：跑到紅** — `npx vitest run src/lib/line-agent/ads/__tests__/sheets-client.test.ts` → FAIL（模組不存在）。

**Step 3：實作**
```ts
// src/lib/line-agent/ads/sheets-client.ts
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const JWT_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer'

export type SheetCell = string | number

export interface SheetsClient {
  appendRows(spreadsheetId: string, range: string, rows: SheetCell[][]): Promise<void>
}

interface ServiceAccount { client_email: string; private_key: string }

export interface SheetsClientDeps {
  transport: typeof fetch
  serviceAccountJson: string
  now?: () => number
  /** 注入 seam：預設用 Web Crypto RS256 簽 JWT；測試可換 fake 避開 crypto。 */
  signAssertion?: (sa: ServiceAccount, nowSec: number) => Promise<string>
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function utf8(s: string): Uint8Array { return new TextEncoder().encode(s) }

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}

async function defaultSignAssertion(sa: ServiceAccount, nowSec: number): Promise<string> {
  const header = base64url(utf8(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const claim = base64url(utf8(JSON.stringify({
    iss: sa.client_email, scope: SHEETS_SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600,
  })))
  const key = await importPrivateKey(sa.private_key)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, utf8(`${header}.${claim}`))
  return `${header}.${claim}.${base64url(new Uint8Array(sig))}`
}

export function createSheetsClient(deps: SheetsClientDeps): SheetsClient {
  const sign = deps.signAssertion ?? defaultSignAssertion
  const nowMs = () => deps.now?.() ?? Date.now()

  async function getAccessToken(): Promise<string> {
    const sa = JSON.parse(deps.serviceAccountJson) as ServiceAccount
    const assertion = await sign(sa, Math.floor(nowMs() / 1000))
    const res = await deps.transport(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent(JWT_GRANT)}&assertion=${assertion}`,
    })
    if (!res.ok) throw new Error(`Sheets token exchange failed: ${res.status} ${await res.text()}`)
    const json = (await res.json()) as { access_token?: string }
    if (!json.access_token) throw new Error('Sheets token exchange: missing access_token')
    return json.access_token
  }

  return {
    async appendRows(spreadsheetId, range, rows) {
      const token = await getAccessToken()
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`
      const res = await deps.transport(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows }),
      })
      if (!res.ok) throw new Error(`Sheets append failed: ${res.status} ${await res.text()}`)
    },
  }
}
```
> `btoa`/`atob`/`crypto.subtle`/`TextEncoder` 在 Vercel Node 18+ 皆為 global，無需 import。測試主流程注入 `signAssertion` 故不觸 crypto。

**Step 4（可選 smoke）：** 另加一測，用 `crypto.subtle.generateKey`（RSASSA-PKCS1-v1_5/SHA-256）產測試金鑰、export `pkcs8`→PEM，餵 `defaultSignAssertion` 斷言回傳三段式字串（驗真簽章路徑，仍零網路）。若時間不足可跳過，標 TODO。

**Step 5：跑到綠 + commit**
```bash
npx vitest run src/lib/line-agent/ads/__tests__/sheets-client.test.ts
git add src/lib/line-agent/ads/sheets-client.ts src/lib/line-agent/ads/__tests__/sheets-client.test.ts
git commit -m "feat(ads): 刀6 Sheets client（手刻 JWT RS256→values:append，TDD）"
```

---

## Task 7：Haiku 摘要 adapter（閘＋日 cap，敗→原文節錄）

**範本：** LLM 封裝 `observability/anthropic-call.ts:68`、日 cap `observability/daily-cost-cap.ts:106`、閘慣例 archiver。

**Files:**
- Create: `src/lib/line-agent/ads/summary-adapter.ts`
- Test: `src/lib/line-agent/ads/__tests__/summary-adapter.test.ts`

**Step 1：寫失敗測試**（fake LLM，零網路）
```ts
import { summarizeOaInquiry, isAdsSummaryEnabled } from '../summary-adapter'

const msgs = [{ ts: 1, text: '你好，7 月想帶爸媽 4 大 2 小去清邁玩五天，想問包車' }, { ts: 2, text: '大概預算兩萬台幣' }]

describe('summarizeOaInquiry', () => {
  it('gate off → returns 原文節錄 fallback, no LLM call', async () => {
    const llm = vi.fn()
    const out = await summarizeOaInquiry({ messages: msgs }, { env: {}, llm })
    expect(llm).not.toHaveBeenCalled()
    expect(out.inquiry).toContain('清邁')
  })
  it('gate on → uses LLM JSON output', async () => {
    const llm = vi.fn(async () => JSON.stringify({ inquiry: '清邁親子包車 5 天', headcount: '4大2小', amount: 'NT$20000' }))
    const out = await summarizeOaInquiry({ messages: msgs }, { env: { AI_AGENT_ADS_SUMMARY_ENABLED: 'true' }, llm })
    expect(out).toEqual({ inquiry: '清邁親子包車 5 天', headcount: '4大2小', amount: 'NT$20000' })
  })
  it('LLM throws → falls back to 原文節錄, never throws', async () => {
    const llm = vi.fn(async () => { throw new Error('anthropic 500') })
    const out = await summarizeOaInquiry({ messages: msgs }, { env: { AI_AGENT_ADS_SUMMARY_ENABLED: 'true' }, llm })
    expect(out.inquiry).toContain('清邁')
  })
  it('LLM returns non-JSON → fallback', async () => {
    const llm = vi.fn(async () => 'sorry I cannot')
    const out = await summarizeOaInquiry({ messages: msgs }, { env: { AI_AGENT_ADS_SUMMARY_ENABLED: 'true' }, llm })
    expect(out.inquiry).toContain('清邁')
  })
  it('cap exceeded → skips LLM, fallback', async () => {
    const llm = vi.fn()
    const costCap = { checkBudget: async () => 'exceeded' as const, recordSpend: async () => {} }
    const out = await summarizeOaInquiry({ messages: msgs }, { env: { AI_AGENT_ADS_SUMMARY_ENABLED: 'true' }, llm, costCap })
    expect(llm).not.toHaveBeenCalled()
    expect(out.inquiry).toContain('清邁')
  })
})
```

**Step 2：跑到紅** — `npx vitest run src/lib/line-agent/ads/__tests__/summary-adapter.test.ts` → FAIL。

**Step 3：實作**
```ts
// src/lib/line-agent/ads/summary-adapter.ts
import type { OaContactMessage } from './oa-contact-record'

export interface OaSummary { inquiry: string; headcount: string; amount: string }

export function isAdsSummaryEnabled(env: Record<string, string | undefined>): boolean {
  return (env.AI_AGENT_ADS_SUMMARY_ENABLED ?? '').trim().toLowerCase() === 'true'
}

export interface AdsCostCap { checkBudget(): Promise<'ok' | string>; recordSpend(usd: number): Promise<void> }
export interface SummaryDeps {
  env: Record<string, string | undefined>
  llm: (prompt: string) => Promise<string>   // 由 composition root 綁 callAnthropicMessages（Haiku）
  costCap?: AdsCostCap
  log?: (code: string, meta?: Record<string, unknown>) => void
}

const EXCERPT_MAX = 60
function excerpt(messages: OaContactMessage[]): string {
  const first = messages.find((m) => m.text.trim() !== '')?.text.trim() ?? ''
  return first.length > EXCERPT_MAX ? `${first.slice(0, EXCERPT_MAX)}…` : first
}

function buildPrompt(messages: OaContactMessage[]): string {
  const body = messages.map((m) => m.text).join('\n')
  return `以下是一位 LINE 客人的詢問訊息。抽出三欄，只回 JSON（無其他字）：\n` +
    `{"inquiry":"一句話詢問項目摘要","headcount":"人數如 4大2小，抽不到留空字串","amount":"預估金額如 NT$20000，抽不到留空字串"}\n\n` +
    `訊息：\n${body}`
}

function parseSummary(raw: string): OaSummary | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return null
    const o = JSON.parse(m[0])
    if (typeof o.inquiry !== 'string') return null
    return { inquiry: o.inquiry, headcount: String(o.headcount ?? ''), amount: String(o.amount ?? '') }
  } catch { return null }
}

export async function summarizeOaInquiry(input: { messages: OaContactMessage[] }, deps: SummaryDeps): Promise<OaSummary> {
  const fallback: OaSummary = { inquiry: excerpt(input.messages), headcount: '', amount: '' }
  try {
    if (!isAdsSummaryEnabled(deps.env)) return fallback
    if (deps.costCap && (await deps.costCap.checkBudget()) !== 'ok') return fallback
    const raw = await deps.llm(buildPrompt(input.messages))
    return parseSummary(raw) ?? fallback
  } catch {
    deps.log?.('ads_summary_failed', {})
    return fallback
  }
}
```
> composition root（Task 8）把 `deps.llm` 綁到 `callAnthropicMessages`（model = `env.AI_AGENT_ADS_SUMMARY_MODEL ?? <haiku default>`），並在成功後 `costCap.recordSpend(result.costUsd)`。日 cap 用 `createDailyCostCap`；設計要「獨立 cap」→ 若要與全域 cap 分池，需給 `createDailyCostCap` 加 `keyPrefix` 參數（小改），否則先共用全域 cap 亦可（於 Task 8 決定，log 說明）。

**Step 4：跑到綠 + commit**
```bash
npx vitest run src/lib/line-agent/ads/__tests__/summary-adapter.test.ts
git add src/lib/line-agent/ads/summary-adapter.ts src/lib/line-agent/ads/__tests__/summary-adapter.test.ts
git commit -m "feat(ads): 刀7 Haiku 摘要 adapter（閘＋cap，敗→原文節錄，TDD）"
```

---

## Task 8：cron route + 冪等 runner + vercel.json

**設計：** GET `/api/cron/ads-daily-sheet`，`CRON_SECRET` 驗 `Authorization: Bearer`。runner 掃 KV（`firstMessageAt && !sheetWritten`）→ 摘要 → Sheets append → 標 `sheetWritten`（冪等）。

**Files:**
- Create: `src/lib/line-agent/ads/run-daily-sheet.ts`（可測 runner，注入 deps）
- Create: `src/app/api/cron/ads-daily-sheet/route.ts`（薄殼：驗 secret + composition root）
- Create: `vercel.json`（crons）
- Test: `src/lib/line-agent/ads/__tests__/run-daily-sheet.test.ts`

**Step 1：寫失敗測試**（MemoryStore + fake sheets + fake summarize）
```ts
import { MemoryStore } from '../../storage/memory-store'
import { runAdsDailySheet } from '../run-daily-sheet'

function fakeSheets(rows: any[]) { return { appendRows: async (_id: string, _r: string, rs: any[]) => { rows.push(...rs) } } }
const summarize = async () => ({ inquiry: '清邁包車', headcount: '4大2小', amount: 'NT$20000' })

describe('runAdsDailySheet', () => {
  it('appends one row per unwritten contact and marks sheetWritten', async () => {
    const store = new MemoryStore()
    await store.putOaContactRecord({ userId: 'U1', followedAt: 100, firstMessageAt: 200, messages: [{ ts: 200, text: 'q' }] })
    const rows: any[] = []
    const out = await runAdsDailySheet({ store, sheets: fakeSheets(rows), summarize, spreadsheetId: 'S', range: 'A1', now: () => 1_720_000_000_000 })
    expect(out.appended).toBe(1)
    expect(rows).toHaveLength(1)
    expect((await store.getOaContactRecord('U1'))?.sheetWritten).toBe(true)
  })
  it('is idempotent — re-run does not re-append', async () => {
    const store = new MemoryStore()
    await store.putOaContactRecord({ userId: 'U1', firstMessageAt: 200, sheetWritten: true })
    const rows: any[] = []
    const out = await runAdsDailySheet({ store, sheets: fakeSheets(rows), summarize, spreadsheetId: 'S', range: 'A1', now: () => 1 })
    expect(out.appended).toBe(0)
    expect(rows).toHaveLength(0)
  })
  it('skips contacts with no firstMessageAt (follow-only, never inquired)', async () => {
    const store = new MemoryStore()
    await store.putOaContactRecord({ userId: 'U1', followedAt: 100 })
    const out = await runAdsDailySheet({ store, sheets: fakeSheets([]), summarize, spreadsheetId: 'S', range: 'A1', now: () => 1 })
    expect(out.appended).toBe(0)
  })
  it('a failed append does not mark sheetWritten and does not block others', async () => {
    const store = new MemoryStore()
    await store.putOaContactRecord({ userId: 'U1', firstMessageAt: 1, messages: [] })
    await store.putOaContactRecord({ userId: 'U2', firstMessageAt: 2, messages: [] })
    const boom = { appendRows: async (_i: string, _r: string, rs: any[]) => { if (rs[0][?]) {/*...*/} throw new Error('403') } }
    const out = await runAdsDailySheet({ store, sheets: { appendRows: async () => { throw new Error('403') } }, summarize, spreadsheetId: 'S', range: 'A1', now: () => 1 })
    expect(out.appended).toBe(0)
    expect((await store.getOaContactRecord('U1'))?.sheetWritten).toBeFalsy()
  })
})
```
> （上面 `boom` 那行是示意，執行者請刪除，只留乾淨的 fail 案例。）

**Step 2：跑到紅** — `npx vitest run src/lib/line-agent/ads/__tests__/run-daily-sheet.test.ts` → FAIL。

**Step 3：runner 實作**
```ts
// src/lib/line-agent/ads/run-daily-sheet.ts
import type { CaseStore } from '../storage/store'
import type { OaContactRecord } from './oa-contact-record'
import type { OaSummary } from './summary-adapter'
import type { SheetsClient } from './sheets-client'
import { bangkokDay } from '../observability/daily-cost-cap' // 若非 export，改 import 其所在或抽公用；務必復用不自寫時區

export interface RunAdsDailySheetDeps {
  store: CaseStore
  sheets: Pick<SheetsClient, 'appendRows'>
  summarize: (input: { messages: OaContactRecord['messages'] }) => Promise<OaSummary>
  spreadsheetId: string
  range: string
  now: () => number
  log?: (code: string, meta?: Record<string, unknown>) => void
}

function toDay(ts: number | undefined): string {
  return ts ? bangkokDay(ts) : ''
}

function buildRow(r: OaContactRecord, s: OaSummary, now: number): (string | number)[] {
  // 欄序對齊設計：日期 | 詢問項目 | 人數 | 預估金額 | 加好友日 | 成交✓ | 成交金額 | 備註
  return [toDay(now), s.inquiry, s.headcount, s.amount, toDay(r.followedAt), '', '', '自動']
}

export async function runAdsDailySheet(deps: RunAdsDailySheetDeps): Promise<{ appended: number; skipped: number }> {
  const all = await deps.store.listOaContactRecords()
  const pending = all.filter((r) => r.firstMessageAt && !r.sheetWritten)
  let appended = 0
  for (const r of pending) {
    try {
      const summary = await deps.summarize({ messages: r.messages ?? [] })
      await deps.sheets.appendRows(deps.spreadsheetId, deps.range, [buildRow(r, summary, deps.now())])
      await deps.store.putOaContactRecord({ ...r, sheetWritten: true })
      appended++
    } catch {
      deps.log?.('ads_row_failed', { userId: r.userId }) // 不標 sheetWritten → 下次 cron 重試
    }
  }
  return { appended, skipped: all.length - pending.length }
}
```
> `bangkokDay` 若目前不是 export：改為從 `daily-cost-cap.ts` export 它，或抽到 `observability/bangkok-day.ts` 共用（DRY，絕不自寫第二份時區換算）。

**Step 4：跑到綠** — 同 Step 2 指令 → PASS。

**Step 5：cron route（薄殼，composition root）**
```ts
// src/app/api/cron/ads-daily-sheet/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { runAdsDailySheet } from '@/lib/line-agent/ads/run-daily-sheet'
import { createSheetsClient } from '@/lib/line-agent/ads/sheets-client'
import { summarizeOaInquiry } from '@/lib/line-agent/ads/summary-adapter'
// 復用 webhook 用的同一 store 工廠 + KV client + Anthropic 封裝
// （執行者：對齊 route.ts:92 getStore() 與 webhook-runtime 的 createKvClientFromEnv / models）

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? ''
  if (secret === '' || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  try {
    const store = getStore() // 同 webhook
    const saJson = Buffer.from(process.env.AI_AGENT_GOOGLE_SA_JSON ?? '', 'base64').toString('utf-8')
    const sheets = createSheetsClient({ transport: fetch, serviceAccountJson: saJson })
    const summarize = (input: { messages: any }) =>
      summarizeOaInquiry(input, {
        env: process.env,
        llm: async (prompt) => {
          const res = await callAnthropicMessages(
            { model: process.env.AI_AGENT_ADS_SUMMARY_MODEL ?? 'claude-haiku-4-5-20251001', system: '', messages: [{ role: 'user', content: prompt }], maxTokens: 300, fallbackInputTokens: 500 },
            { transport: fetch, apiKey: process.env.ANTHROPIC_API_KEY ?? '', costCap },
          )
          return res.text
        },
        costCap,
        log,
      })
    const result = await runAdsDailySheet({
      store, sheets, summarize,
      spreadsheetId: process.env.AI_AGENT_ADS_SHEET_ID ?? '',
      range: process.env.AI_AGENT_ADS_SHEET_RANGE ?? 'A1',
      now: () => Date.now(),
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    // 外部呼叫全 try-catch；錯誤訊息不得 minified
    return NextResponse.json({ ok: false, error: String(err instanceof Error ? err.message : err) }, { status: 500 })
  }
}
```
> 執行者：`getStore` / `createKvClientFromEnv` / `callAnthropicMessages` / `createDailyCostCap` 的**確切** import 路徑對齊既有 `webhook-runtime.ts:935-960` 與 `route.ts:92`。`costCap` 用 `createDailyCostCap({ env: process.env, kv: createKvClientFromEnv() })`。此 route 無法純單元測，靠 runner 測（已綠）＋ Step 8 smoke。

**Step 6：vercel.json**
```json
{
  "crons": [
    { "path": "/api/cron/ads-daily-sheet", "schedule": "0 2 * * *" }
  ]
}
```
> 09:00 Asia/Bangkok(UTC+7) = 02:00 UTC。Vercel cron 一律 UTC。route 需 `export const dynamic = 'force-dynamic'`（若 Next 對 cron route 有靜態化風險）。

**Step 7：commit**
```bash
git add src/lib/line-agent/ads/run-daily-sheet.ts "src/app/api/cron/ads-daily-sheet/route.ts" vercel.json src/lib/line-agent/ads/__tests__/run-daily-sheet.test.ts
git commit -m "feat(ads): 刀8 每日 cron＋冪等 runner＋Sheets append（TDD）"
```

**Step 8：收斂驗證 + 真連線 smoke（唯一觸網步驟）**
- `npx vitest run src/lib/line-agent` → 全綠。
- `npx tsc --noEmit`（或專案既有 typecheck）→ 0 error。
- **Eric 一次性前置**（人工）：把目標 Sheet `1DhSGSmaPtlszo4k-nc0wjrHVj1oaaWusk962dYrhjNU` 的**編輯權**分享給 service account email；env 設好 `AI_AGENT_GOOGLE_SA_JSON`(base64)、`AI_AGENT_ADS_SHEET_ID`、`AI_AGENT_ADS_SHEET_RANGE`、`CRON_SECRET`、`AI_AGENT_OA_CAPTURE_ENABLED`、`AI_AGENT_ADS_SUMMARY_ENABLED`、`AI_AGENT_ADS_SUMMARY_MODEL`、`ANTHROPIC_API_KEY`。
- smoke：`curl -H "Authorization: Bearer $CRON_SECRET" https://<preview-domain>/api/cron/ads-daily-sheet` → 檢查 Sheet 出現一列且回 `{ok:true, appended:N}`；重打一次驗冪等（appended 應為 0）。

---

## 環境變數清單（部署前備妥）

| var | 用途 | default |
|-----|------|---------|
| `AI_AGENT_OA_CAPTURE_ENABLED` | 刀4/5 被動記錄閘 | off |
| `AI_AGENT_ADS_SUMMARY_ENABLED` | 刀7 Haiku 摘要閘 | off（off 時全走原文節錄，仍可寫列） |
| `AI_AGENT_ADS_SUMMARY_MODEL` | 摘要模型 | `claude-haiku-4-5-20251001` |
| `AI_AGENT_DAILY_COST_CAP_USD` | 摘要日 cap（沿用既有；獨立池需加 keyPrefix，見刀7） | 未設=不限 |
| `CRON_SECRET` | cron 驗證（Vercel 自動帶 Bearer） | 必填 |
| `AI_AGENT_GOOGLE_SA_JSON` | service account JSON（base64） | 必填 |
| `AI_AGENT_ADS_SHEET_ID` | 目標 Sheet ID | 必填 |
| `AI_AGENT_ADS_SHEET_RANGE` | append range（如 `轉換!A1`） | `A1` |

## 完成後（docs commit）
依 CLAUDE.md：feature commit 完 → 更新本計畫「執行紀錄」與 `docs/plans/2026-07-06-...-design.md` 的落地狀態，另開 docs commit。

---

## Execution Handoff

計畫已存 `docs/plans/2026-07-06-ads-daily-conversion-sheet-plan.md`。兩種執行法：

1. **Subagent-Driven（本 session）** — 我逐刀派 fresh subagent、刀間 code review、快速迭代（REQUIRED SUB-SKILL: superpowers:subagent-driven-development）。
2. **Parallel Session（另開）** — 新 session 用 superpowers:executing-plans 批次執行＋檢查點。

⚠️ 提醒：先前 Plan agent 兩度撞 API 額度耗盡而 terminate。逐刀派 subagent（每刀短活）比一次派長活安全；若又撞額度，改本 session 直接手作。

**要走哪一種？** → 已定：本 session 逐刀派 subagent（subagent-driven-development，每刀 implementer→spec review→code quality review）。

---

## 執行紀錄（subagent-driven，逐刀更新）

- **刀1 ✅ 完成** — commit `b82e747`。normalizer 擴收 follow→oa_follow。順修一條 stale 測試（原斷言 user follow→null，改用 postback 驗 fail-closed）。spec ✅／code quality ✅（reviewer 實追下游 webhook 路由確認不破「不自動回」鐵律）。全 line-agent 1870 passed。
- **刀2 ✅ 完成** — commit `0983b62`(型別＋契約＋MemoryStore) + `192b9f9`(review fix)。code review 抓到 Important：MemoryStore 對巢狀 `messages` 用 shallow copy → 改 `structuredClone`（對齊 distill 先例，消除 MemoryStore↔KvStore 分歧），補 isolation 契約測。MemoryStore 67/67 綠。**KvStore 目前 5 紅＝刻意 stub（`not implemented (Task 3)`），刀3 補真實作即轉綠。**（註：原本 amend 成 `c6c5133`，但發現 `0983b62` 已被 push，為守「絕不改寫已 push 的 commit」，改用非破壞式：把 fix 疊成新 commit `192b9f9`。）
- **刀3 ✅ 完成** — commit `66c2ff2`(KvStore 三方法) + `36782f7`(review fix)。two-stage review：spec ✅（三方法與 transcript 同構、TTL/前綴/空值正確、無 over-build）、code quality ✅（僅 Minor）。收掉 3 Minor：常數改名 `OA_CONTACT_KEY_PREFIX`→`OA_CONTACT_PREFIX`（對齊 `*_PREFIX` 兄弟）、補 `oa:contact:` 頂層 namespace 註解、補「空 userId no-op」跨兩 store 契約測。**list 機制定案＝keys-scan**（`kv.keys('oa:contact:*')`），照抄 `listTranscriptEntries`——該面本來就無獨立 index-set，transcript 也是 scan。storage 全區 125 passed。⚠️ 環境會在 commit 後自動 push（本刀 66c2ff2/36782f7 都已上 origin），故**絕不 amend 已 commit 的 code**；review fix 一律疊新 commit（同刀2 0983b62+192b9f9 先例）。效能備註：`listOaContactRecords` 為 unbounded scan，聯絡人量長期累積會是熱點，屬後續 index-set 的事、不擋本刀。
- **刀4 ⏳ 待做（下一步從這開始）** — `src/lib/line-agent/ads/oa-contact-recorder.ts` 被動記錄邏輯（閘 `AI_AGENT_OA_CAPTURE_ENABLED` off、fail-safe）。範本 archiver `transcript/archiver.ts:32-36/:83/:88-146`。base SHA = `36782f7`（目前分支 tip，local==remote）。
- 刀5–8 待做（見上各 Task；刀6、刀7 與 1–5 無依賴可平行）。刀5 暗坑：`oa_follow` 新 kind 可能進不了 `defaultEventHandler`（webhook route 早段擋非建案類），接線時端到端追 `route.ts:113-117`。

