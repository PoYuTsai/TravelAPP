# Quote-to-Bot Message Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 讓夥伴在 partner group 內「引用/回覆 bot 先前發出的訊息」時，即使不再 tag bot，也視為對 bot 說話並產生恰一則 LINE reply；引用真人訊息維持不回，其餘平面（客人 OA、dev、quote formal write）行為完全不變。

**Architecture:** 把 bot-directed 判定由「只認 `event.mentionsBot`」放寬為 runtime derived `botDirected = mentionsBot || isBotAuthoredQuote`。`isBotAuthoredQuote` 只在 partner group 的 `group_quoted` 路徑、靠新的 KV bot-authored id store 計算（KV 讀失敗 fail-safe=false）。`botDirected` 貫穿 runtime precondition → dedup claim → router/permissions → 純函數 gate。bot 送出 reply 後，把 `replyMessage` 回傳的 `sentMessages[].id` 寫回 store（TTL 7 天），下次被引用即命中。

**Tech Stack:** TypeScript、Next.js App Router、Vitest（`npm run test:run`）、Upstash/Vercel KV（`@upstash/redis`，經 `KvClient` seam 注入）、fetch-based LINE client（無 SDK）。

**設計來源：** `docs/plans/2026-06-04-quote-to-bot-message-tracking-design.md`（§0 Scope、§2 store、§3 control flow、§4 replyMessage、§5 失敗、§6 不變量、§7 測試矩陣）。

**全程紀律：** DRY / YAGNI / TDD（先寫失敗測試 → 跑紅 → 最小實作 → 跑綠 → commit）。每個 commit 必須能編譯且全測試綠。所有測試零真 key、零真 API、fake transport / fake store。

**Scope 守門（每個 task 都不得越界）：**
- ❌ 不開 anthropic mode（responder 仍預設 stub）。
- ❌ 不碰 reminder push / cron / CUA。
- ❌ 不碰 quote formal write / Sanity 寫入。
- ❌ 不碰客人 OA auto-reply。
- ❌ 不解析/保存 `quoteToken`（只比對 message id）。
- ❌ 不動 `event-normalizer.ts`（`quotedRef.quotedMessageId` 已捕捉，足夠）。

---

## 編譯安全的任務順序（為何這樣切）

每個 task 結束時 codebase 必須編譯且全綠，因此：

- **Task 1–2** 純加法（新 store 方法、`replyMessage` 回傳型別放寬），不破壞既有 caller。
- **Task 3** 新增一個純 helper `deriveBotDirected`（孤立可測），不改任何既有呼叫點。
- **Task 4** 一次改完所有「讀 botDirected」的 signature（permissions B1/B2、router、gate）**並同步更新唯一 caller**（webhook-runtime 暫時傳 `event.mentionsBot === true` 當 `botDirected`），所以行為不變、編譯通過。
- **Task 5** 才把 Task 3 的 helper 接進 webhook 控制流（真 `botDirected`、claim 位置、送後寫 store），行為正式改變。
- **Task 6** 不變量回歸，鎖死邊界。

---

## Task 1: bot-authored id store contract

新增 store 兩個方法 + KV TTL 寫入能力。純加法，先做因為 Task 3/5 都依賴它。

**Files:**
- Modify: `src/lib/line-agent/storage/kv-store.ts`（`KvClient` 介面加 `setWithTtl`；Upstash adapter 實作；`KvStore` 加兩方法 + key helper）
- Modify: `src/lib/line-agent/storage/store.ts`（`CaseStore` 介面加兩方法）
- Modify: `src/lib/line-agent/storage/memory-store.ts`（`MemoryStore` 實作兩方法 + 記錄 TTL 供斷言）
- Test: `src/lib/line-agent/__tests__/kv-store.test.ts`
- Test: `src/lib/line-agent/__tests__/memory-store.test.ts`

### Step 1: 寫失敗測試（KvStore round-trip + TTL）

在 `kv-store.test.ts` 用既有 mock KvClient 風格新增：

```ts
describe('bot-authored partner message store', () => {
  it('putBotAuthoredPartnerMsg writes with 7-day TTL and isBotAuthoredPartnerMsg reads it back', async () => {
    const calls: Array<{ key: string; value: unknown; ttl: number }> = []
    const seen = new Set<string>()
    const client = makeMockKvClient({
      setWithTtl: async (key, value, ttl) => { calls.push({ key, value, ttl }); seen.add(key); return 'OK' },
      get: async (key) => (seen.has(key) ? ('1' as unknown as null) : null),
    })
    const store = new KvStore(client)

    await store.putBotAuthoredPartnerMsg('Mbot123')
    expect(calls).toHaveLength(1)
    expect(calls[0].key).toBe('line-agent:partner-bot-msg:Mbot123')
    expect(calls[0].ttl).toBe(604800) // 7 days in seconds

    expect(await store.isBotAuthoredPartnerMsg('Mbot123')).toBe(true)
    expect(await store.isBotAuthoredPartnerMsg('Munknown')).toBe(false)
  })

  it('putBotAuthoredPartnerMsg is a no-op for empty id (no KV write)', async () => {
    const calls: unknown[] = []
    const client = makeMockKvClient({ setWithTtl: async (...a) => { calls.push(a); return 'OK' } })
    await new KvStore(client).putBotAuthoredPartnerMsg('')
    expect(calls).toHaveLength(0)
  })

  it('isBotAuthoredPartnerMsg returns false for empty id without touching KV', async () => {
    let getCalls = 0
    const client = makeMockKvClient({ get: async () => { getCalls++; return null } })
    expect(await new KvStore(client).isBotAuthoredPartnerMsg('')).toBe(false)
    expect(getCalls).toBe(0)
  })
})
```

> 對齊 `kv-store.test.ts` 既有 mock 工廠的真實名稱/簽章（若無 `makeMockKvClient`，沿用該檔現有 mock 物件寫法；mock 須補上 `setWithTtl`）。

### Step 2: 跑測試確認紅

Run: `npm run test:run -- src/lib/line-agent/__tests__/kv-store.test.ts`
Expected: FAIL（`setWithTtl` / `putBotAuthoredPartnerMsg` / `isBotAuthoredPartnerMsg` 未定義）

### Step 3: 最小實作

`store.ts` 的 `CaseStore` 介面，在 `claimPartnerReply` 之後新增：

```ts
  // ── Bot-authored partner-group message tracking ─────────────────────────────

  /**
   * Record that `messageId` is a message THIS bot sent in the partner group, so
   * a later quote-reply to it counts as addressing the bot (quote-to-bot plan
   * §2). TTL 7 days. Empty id is a no-op. Own key namespace — never a case.
   */
  putBotAuthoredPartnerMsg(messageId: string): Promise<void>

  /**
   * True when `messageId` was recorded by putBotAuthoredPartnerMsg and has not
   * expired. Empty id returns false without I/O.
   */
  isBotAuthoredPartnerMsg(messageId: string): Promise<boolean>
```

`kv-store.ts`：
- `KvClient` 介面在 `set` 後加：
  ```ts
  /** SET key value EX ttlSeconds — set with an expiry (seconds). */
  setWithTtl(key: string, value: unknown, ttlSeconds: number): Promise<unknown>
  ```
- Upstash adapter（`createUpstashKvClient`）實作：
  ```ts
  setWithTtl(key, value, ttlSeconds) {
    return redis.set(key, JSON.stringify(value), { ex: ttlSeconds })
  },
  ```
- 常數與 key helper（接在 `PARTNER_REPLY_PREFIX` 區塊後）：
  ```ts
  const BOT_AUTHORED_TTL_SECONDS = 604800 // 7 days
  const PARTNER_BOT_MSG_PREFIX = 'line-agent:partner-bot-msg:'
  function partnerBotMsgKey(messageId: string): string {
    return `${PARTNER_BOT_MSG_PREFIX}${messageId}`
  }
  ```
- `KvStore` 方法（接在 `claimPartnerReply` 後）：
  ```ts
  async putBotAuthoredPartnerMsg(messageId: string): Promise<void> {
    if (messageId === '') return
    const kv = this.ensureClient()
    await kv.setWithTtl(partnerBotMsgKey(messageId), '1', BOT_AUTHORED_TTL_SECONDS)
  }

  async isBotAuthoredPartnerMsg(messageId: string): Promise<boolean> {
    if (messageId === '') return false
    const kv = this.ensureClient()
    return (await kv.get(partnerBotMsgKey(messageId))) !== null
  }
  ```

### Step 4: 跑測試確認綠

Run: `npm run test:run -- src/lib/line-agent/__tests__/kv-store.test.ts`
Expected: PASS

### Step 5: 寫 MemoryStore 失敗測試

在 `memory-store.test.ts` 新增：

```ts
describe('bot-authored partner message tracking', () => {
  it('round-trips put → is', async () => {
    const store = new MemoryStore()
    expect(await store.isBotAuthoredPartnerMsg('Mb1')).toBe(false)
    await store.putBotAuthoredPartnerMsg('Mb1')
    expect(await store.isBotAuthoredPartnerMsg('Mb1')).toBe(true)
  })

  it('empty id: put is no-op, is returns false', async () => {
    const store = new MemoryStore()
    await store.putBotAuthoredPartnerMsg('')
    expect(await store.isBotAuthoredPartnerMsg('')).toBe(false)
  })
})
```

Run: `npm run test:run -- src/lib/line-agent/__tests__/memory-store.test.ts`
Expected: FAIL（方法未定義）

### Step 6: 實作 MemoryStore

接在 `claimPartnerReply` 後：

```ts
  /** Bot-authored partner-group message ids (NOT case state). */
  private readonly botAuthoredPartnerMsgs = new Set<string>()

  async putBotAuthoredPartnerMsg(messageId: string): Promise<void> {
    if (messageId === '') return
    this.botAuthoredPartnerMsgs.add(messageId)
  }

  async isBotAuthoredPartnerMsg(messageId: string): Promise<boolean> {
    if (messageId === '') return false
    return this.botAuthoredPartnerMsgs.has(messageId)
  }
```

> `Set` 欄位宣告放 class 頂部 fields 區（與 `claimedPartnerReplies` 並列），方法放方法區。

Run: `npm run test:run -- src/lib/line-agent/__tests__/memory-store.test.ts`
Expected: PASS

### Step 7: 全測試回歸 + commit

Run: `npm run test:run`
Expected: 既有 488 + 新測試全綠

```bash
git add src/lib/line-agent/storage/ src/lib/line-agent/__tests__/kv-store.test.ts src/lib/line-agent/__tests__/memory-store.test.ts
git commit -m "feat(line-agent): bot-authored partner-msg store (put/is, 7d TTL, empty-id safe)"
```

---

## Task 2: `replyMessage` 回傳 sentMessages[].id

放寬 `replyMessage` 由 `Promise<void>` → `Promise<string[]>`，解析 LINE response `sentMessages[].id`。純加法（void caller 仍相容）。

**Files:**
- Modify: `src/lib/line-agent/line/message-client.ts:114-149`
- Test: `src/lib/line-agent/__tests__/message-client.test.ts`（**新檔**）

### Step 1: 寫失敗測試

新建 `src/lib/line-agent/__tests__/message-client.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { replyMessage, LineApiError } from '../line/message-client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('replyMessage', () => {
  it('returns sentMessages[].id on success', async () => {
    const fakeFetch = async () => jsonResponse({ sentMessages: [{ id: '461230966842064897', quoteToken: 'q' }] })
    const ids = await replyMessage('rt', [{ type: 'text', text: 'hi' }], 'tok', fakeFetch as typeof fetch)
    expect(ids).toEqual(['461230966842064897'])
  })

  it('returns [] when response lacks sentMessages (does not throw)', async () => {
    const fakeFetch = async () => jsonResponse({})
    const ids = await replyMessage('rt', [{ type: 'text', text: 'hi' }], 'tok', fakeFetch as typeof fetch)
    expect(ids).toEqual([])
  })

  it('returns [] when body is unparseable JSON (does not throw)', async () => {
    const fakeFetch = async () => new Response('not-json', { status: 200 })
    const ids = await replyMessage('rt', [{ type: 'text', text: 'hi' }], 'tok', fakeFetch as typeof fetch)
    expect(ids).toEqual([])
  })

  it('still throws LineApiError on non-2xx (unchanged failure semantics)', async () => {
    const fakeFetch = async () => new Response('bad token', { status: 401 })
    await expect(
      replyMessage('rt', [{ type: 'text', text: 'hi' }], 'tok', fakeFetch as typeof fetch)
    ).rejects.toBeInstanceOf(LineApiError)
  })
})
```

### Step 2: 跑測試確認紅

Run: `npm run test:run -- src/lib/line-agent/__tests__/message-client.test.ts`
Expected: FAIL（目前回 `void`，前三條斷言失敗）

### Step 3: 最小實作

改 `replyMessage` 簽章與成功分支（`message-client.ts:114-149`）：

```ts
export async function replyMessage(
  replyToken: string,
  messages: LineMessage[],
  accessToken: string,
  fetchFn: typeof fetch = fetch
): Promise<string[]> {
  // ... url / body / try-fetch / network-error 區塊維持不變 ...

  if (!response.ok) {
    const text = await response.text().catch(() => '(unreadable)')
    throw new LineApiError(
      response.status,
      text,
      `replyMessage failed with status ${response.status}: ${text}`
    )
  }

  // Parse sentMessages[].id — the only reliable source of bot-authored message
  // ids (LINE never webhook-echoes the bot's own messages). A parse miss is NOT
  // an error: the reply already succeeded; failing to track it only means a
  // future quote to it would need a re-tag (quote-to-bot plan §4).
  try {
    const data = (await response.json()) as { sentMessages?: Array<{ id?: string }> }
    return (data.sentMessages ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === 'string' && id !== '')
  } catch {
    return []
  }
}
```

加一行 JSDoc 註明 `@returns sentMessages[].id；解析不出回 []（不 throw）`。

### Step 4: 跑測試確認綠

Run: `npm run test:run -- src/lib/line-agent/__tests__/message-client.test.ts`
Expected: PASS

### Step 5: 全測試回歸 + commit

> `ReplyClient` seam 型別此刻仍是 `Promise<void>`；預設 reply client `(rt, m) => replyMessage(...)` 回 `Promise<string[]>` 賦值給 `Promise<void>` 在 TS 合法（void 接受任意回傳），故編譯不破。型別正式收斂在 Task 3。

Run: `npm run test:run`
Expected: 全綠

```bash
git add src/lib/line-agent/line/message-client.ts src/lib/line-agent/__tests__/message-client.test.ts
git commit -m "feat(line-agent): replyMessage returns sentMessages[].id (parse-miss safe)"
```

---

## Task 3: `deriveBotDirected` 純 helper（fail-safe）

把「是否引用 bot 訊息」+「botDirected」的計算抽成孤立可測 helper。此 task 不接進控制流（避免破壞編譯），只新增函數 + 測試。

**Files:**
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`（新增 exported helper `deriveBotDirected`；`ReplyClient` 型別收斂為 `Promise<string[]>`）
- Test: `src/lib/line-agent/__tests__/webhook-runtime.test.ts`

### Step 1: 寫失敗測試

在 `webhook-runtime.test.ts` 新增（import 加 `deriveBotDirected`）：

```ts
import { deriveBotDirected } from '../line/webhook-runtime'

describe('deriveBotDirected', () => {
  const base = (o: Partial<NormalizedLineEvent> = {}): NormalizedLineEvent => ({
    kind: 'group_text', sourceChannel: 'line_partner_group', lineUserId: 'U', groupId: 'G',
    messageId: 'M', mentionsBot: false, timestamp: 1, ...o,
  })

  it('true when mentionsBot is true (store not consulted)', async () => {
    let called = 0
    const store = { ...new MemoryStore() } as any
    store.isBotAuthoredPartnerMsg = async () => { called++; return false }
    expect(await deriveBotDirected(base({ mentionsBot: true }), store)).toBe(true)
    expect(called).toBe(0) // short-circuit: no store read when already mentioned
  })

  it('true when group_quoted quotes a bot-authored id', async () => {
    const store = new MemoryStore()
    await store.putBotAuthoredPartnerMsg('Mbot')
    const ev = base({ kind: 'group_quoted', quotedRef: { quotedMessageId: 'Mbot' } })
    expect(await deriveBotDirected(ev, store)).toBe(true)
  })

  it('false when group_quoted quotes a non-bot (human) id', async () => {
    const ev = base({ kind: 'group_quoted', quotedRef: { quotedMessageId: 'Mhuman' } })
    expect(await deriveBotDirected(ev, new MemoryStore())).toBe(false)
  })

  it('false for OA even if a quotedRef somehow present (store never consulted)', async () => {
    let called = 0
    const store = new MemoryStore()
    store.isBotAuthoredPartnerMsg = async () => { called++; return true }
    const ev = base({ sourceChannel: 'line_oa', kind: 'group_quoted', quotedRef: { quotedMessageId: 'X' }, mentionsBot: false })
    expect(await deriveBotDirected(ev, store)).toBe(false)
    expect(called).toBe(0)
  })

  it('fail-safe false when store read throws', async () => {
    const store = new MemoryStore()
    store.isBotAuthoredPartnerMsg = async () => { throw new Error('KV timeout') }
    const ev = base({ kind: 'group_quoted', quotedRef: { quotedMessageId: 'Mbot' } })
    expect(await deriveBotDirected(ev, store)).toBe(false)
  })

  it('false when group_quoted but quotedMessageId empty', async () => {
    const ev = base({ kind: 'group_quoted', quotedRef: { quotedMessageId: '' } })
    expect(await deriveBotDirected(ev, new MemoryStore())).toBe(false)
  })
})
```

### Step 2: 跑測試確認紅

Run: `npm run test:run -- src/lib/line-agent/__tests__/webhook-runtime.test.ts`
Expected: FAIL（`deriveBotDirected` 未定義）

### Step 3: 最小實作

在 `webhook-runtime.ts` 新增（建議放在 `mayProducePartnerGroupReply` 附近；import 已含 `CaseStore`、`NormalizedLineEvent`）：

```ts
/**
 * Derive the runtime "is the bot being addressed?" signal (quote-to-bot plan §3):
 *   botDirected = mentionsBot || isBotAuthoredQuote
 *
 * `isBotAuthoredQuote` is computed ONLY for a partner-group `group_quoted` event
 * whose quotedMessageId hits the bot-authored store. The customer OA plane is
 * never consulted (it can never be botDirected). A store read failure is
 * fail-safe: treat as NOT bot-authored, so the worst case is the partner re-tags.
 *
 * This NEVER mutates the normalizer's raw `event.mentionsBot`.
 */
export async function deriveBotDirected(
  event: NormalizedLineEvent,
  store: CaseStore
): Promise<boolean> {
  if (event.mentionsBot === true) return true // short-circuit: no store read needed

  const qid = event.quotedRef?.quotedMessageId
  if (
    event.sourceChannel === 'line_partner_group' &&
    event.kind === 'group_quoted' &&
    typeof qid === 'string' &&
    qid !== ''
  ) {
    try {
      return await store.isBotAuthoredPartnerMsg(qid)
    } catch {
      return false // fail-safe: cannot confirm bot-authored → not addressed
    }
  }
  return false
}
```

同步把 `ReplyClient` 型別收斂（`webhook-runtime.ts:227`）：

```ts
export type ReplyClient = (replyToken: string, messages: LineMessage[]) => Promise<string[]>
```

> 預設 reply client 已回 `replyMessage(...)`（Task 2 後為 `Promise<string[]>`），無需再改實作。Task 5 才會使用回傳值。

### Step 4: 跑測試確認綠

Run: `npm run test:run -- src/lib/line-agent/__tests__/webhook-runtime.test.ts`
Expected: PASS（既有 webhook 測試 + 新 `deriveBotDirected` 測試）

### Step 5: 全測試回歸 + commit

Run: `npm run test:run`
Expected: 全綠

```bash
git add src/lib/line-agent/line/webhook-runtime.ts src/lib/line-agent/__tests__/webhook-runtime.test.ts
git commit -m "feat(line-agent): add deriveBotDirected helper (fail-safe, OA never directed)"
```

---

## Task 4: permissions / router / gate 改讀 botDirected

一次改完三處 signature 並更新唯一 caller，行為保持不變（webhook 暫傳 `event.mentionsBot === true`），下一刀才接真值。

**Files:**
- Modify: `src/lib/line-agent/permissions.ts`（B1 `canRespondToPartnerGroupTag`、B2 `shouldIgnoreCasualPartnerGroupChat`）
- Modify: `src/lib/line-agent/commands/router.ts`（`RouterInput` 加 `botDirected?`；B1/B2 呼叫帶入）
- Modify: `src/lib/line-agent/line/partner-reply-gate.ts`（gate 第 3 條改吃 `botDirected`）
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`（gate 呼叫改 3 參數，暫傳 `event.mentionsBot === true`）
- Test: `src/lib/line-agent/__tests__/permissions.test.ts`
- Test: `src/lib/line-agent/__tests__/partner-reply-gate.test.ts`

### Step 1: 寫失敗測試（permissions B1/B2）

在 `permissions.test.ts` 新增（並把既有 B1/B2 呼叫更新為帶 `botDirected` 第二參數——既有 `mentionsBot:true` 案例改傳 `true`，維持斷言不變）：

```ts
describe('B1/B2 read botDirected (quote-to-bot)', () => {
  const pg = (o = {}): NormalizedLineEvent => ({
    kind: 'group_quoted', sourceChannel: 'line_partner_group', lineUserId: 'U', groupId: 'G',
    messageId: 'M', mentionsBot: false, timestamp: 1, ...o,
  })

  it('B1 allows when botDirected=true even though mentionsBot=false', () => {
    expect(canRespondToPartnerGroupTag(pg(), true).allowed).toBe(true)
  })
  it('B1 denies when botDirected=false', () => {
    expect(canRespondToPartnerGroupTag(pg(), false).allowed).toBe(false)
  })
  it('B2 ignores when botDirected=false', () => {
    expect(shouldIgnoreCasualPartnerGroupChat(pg(), false)).toBe(true)
  })
  it('B2 processes (not ignore) when botDirected=true', () => {
    expect(shouldIgnoreCasualPartnerGroupChat(pg(), true)).toBe(false)
  })
})
```

### Step 2: 跑測試確認紅

Run: `npm run test:run -- src/lib/line-agent/__tests__/permissions.test.ts`
Expected: FAIL（多了一個必填參數 / 型別錯）

### Step 3: 改 permissions

`canRespondToPartnerGroupTag`（`permissions.ts:76`）：

```ts
export function canRespondToPartnerGroupTag(
  event: NormalizedLineEvent,
  botDirected: boolean
): PermissionResult {
  if (event.sourceChannel !== 'line_partner_group') {
    return { allowed: false, reason: `canRespondToPartnerGroupTag: source is ${event.sourceChannel}, not line_partner_group` }
  }
  if (botDirected) return { allowed: true }
  return { allowed: false, reason: 'canRespondToPartnerGroupTag: bot is not addressed (botDirected is false)' }
}
```

`shouldIgnoreCasualPartnerGroupChat`（`permissions.ts:112`）：

```ts
export function shouldIgnoreCasualPartnerGroupChat(
  event: NormalizedLineEvent,
  botDirected: boolean
): boolean {
  if (event.sourceChannel !== 'line_partner_group') return false
  return !botDirected
}
```

> 同步更新兩處 doc comment：把「mentionsBot」描述改為「botDirected（mentionsBot 或引用 bot 訊息）」。

### Step 4: 改 router 貫穿 botDirected

`RouterInput` 加欄位（`router.ts:80-112` 區塊）：

```ts
  /**
   * Runtime-derived "bot is addressed" signal (quote-to-bot plan §3):
   * mentionsBot OR a quote-reply to a bot-authored message. Threaded into B1/B2
   * so a quote-to-bot message reaches `respond` without a re-tag. Defaults to
   * `event?.mentionsBot === true` to preserve the tag-only behavior when a caller
   * does not provide it.
   */
  botDirected?: boolean
```

在 partner-group 分支（`router.ts:223` 起）開頭解析一次：

```ts
    if (event.sourceChannel === 'line_partner_group') {
      const botDirected = input.botDirected ?? (event.mentionsBot === true)
      // ... B5 dev-action gate 維持不變 ...
      if (shouldIgnoreCasualPartnerGroupChat(event, botDirected)) { /* silent */ }
      const tagPerm = canRespondToPartnerGroupTag(event, botDirected)
      // ... 其餘維持不變 ...
```

> B5 `canPartnerGroupTriggerDevAction` 不吃 botDirected（dev 行為與 addressed 無關，維持）。

### Step 5: 改 gate 第 3 條

`partner-reply-gate.ts:29`：

```ts
export function shouldReplyToPartnerGroup(
  event: NormalizedLineEvent,
  decision: RouterDecision,
  botDirected: boolean
): boolean {
  const outboundText = decision.handlerResult?.outboundText
  return (
    event.sourceChannel === 'line_partner_group' &&
    decision.source === 'line_partner_group' &&
    botDirected === true && // ← was event.mentionsBot === true
    decision.action === 'respond' &&
    decision.denied !== true &&
    typeof outboundText === 'string' &&
    outboundText.trim() !== '' &&
    typeof event.replyToken === 'string' &&
    event.replyToken.trim() !== ''
  )
}
```

更新檔頭 7 條註解：第 3 條改為 `botDirected === true (tag OR quote-to-bot)`。

### Step 6: 更新 gate 失敗測試 + webhook caller（維持行為）

`partner-reply-gate.test.ts`：所有既有呼叫補第三參數。原本靠 `event.mentionsBot:true` 通過的案例 → 傳 `true`；靠 `mentionsBot:false` 擋下的案例 → 傳 `false`。新增一條真值表：

```ts
it('condition 3 now reads botDirected, not mentionsBot', () => {
  const ev = { ...respondReadyEvent(), mentionsBot: false } // mention false
  const dec = respondDecision()
  expect(shouldReplyToPartnerGroup(ev, dec, true)).toBe(true)   // quote-to-bot
  expect(shouldReplyToPartnerGroup(ev, dec, false)).toBe(false) // not directed
})
```

`webhook-runtime.ts`：把現有兩處 gate 呼叫改 3 參數，**暫時**傳 `event.mentionsBot === true`（行為與現況等價，真 botDirected 在 Task 5 接）：

```ts
  if (shouldReplyToPartnerGroup(event, decision, event.mentionsBot === true)) { ... }
  // probe 診斷那段同樣補第三參數：
  if (!event.replyToken &&
      shouldReplyToPartnerGroup({ ...event, replyToken: 'probe' }, decision, event.mentionsBot === true)) { ... }
```

router 對 B1/B2 的呼叫已在 Step 4 帶入 `botDirected`（此刻 `input.botDirected` 仍未由 webhook 傳入 → fallback 到 `event.mentionsBot`，行為不變）。

### Step 7: 跑測試確認綠 + 全回歸 + commit

Run: `npm run test:run`
Expected: 全綠（行為未變，僅 signature 擴充）

```bash
git add src/lib/line-agent/permissions.ts src/lib/line-agent/commands/router.ts src/lib/line-agent/line/partner-reply-gate.ts src/lib/line-agent/line/webhook-runtime.ts src/lib/line-agent/__tests__/permissions.test.ts src/lib/line-agent/__tests__/partner-reply-gate.test.ts
git commit -m "refactor(line-agent): B1/B2/gate/router read botDirected (behavior-preserving)"
```

---

## Task 5: webhook 控制流接真 botDirected + 送後寫 store

把 Task 3 helper 接進 `defaultEventHandler`：先算 `botDirected` → claim → 帶 botDirected 進 router → 帶 botDirected 進 gate → 送出後寫回 bot-authored id。這是行為正式改變的一刀。

**Files:**
- Modify: `src/lib/line-agent/line/webhook-runtime.ts`（`mayProducePartnerGroupReply` 改 async 吃 botDirected；`defaultEventHandler` 重排）
- Test: `src/lib/line-agent/__tests__/webhook-runtime.test.ts`

### Step 1: 寫失敗測試（end-to-end runtime，全 fake）

在 `webhook-runtime.test.ts` 新增。沿用既有 `recordingReplyClient()` + fake responder + `MemoryStore` 模式（reply client 回 `['<id>']` 以驗證寫回）：

```ts
describe('quote-to-bot runtime control flow', () => {
  function quoteEvent(o: Partial<NormalizedLineEvent> = {}): NormalizedLineEvent {
    return {
      kind: 'group_quoted', sourceChannel: 'line_partner_group', lineUserId: 'U_min',
      groupId: 'G_partner', messageId: 'M_q1', text: '這個行程可以嗎',
      mentionsBot: false, timestamp: 1, replyToken: 'rt_q1',
      quotedRef: { quotedMessageId: 'M_botPrev' }, ...o,
    }
  }

  it('quote-to-bot (store hit, no mention): responds once and records the new sent id', async () => {
    const store = new MemoryStore()
    await store.putBotAuthoredPartnerMsg('M_botPrev')
    const { client, calls } = recordingReplyClient(['M_botNew']) // returns new sent id
    setReplyClient(client)
    setPartnerGroupResponder(fakeResponder('好的，這個行程沒問題'))

    await getEventHandler()(quoteEvent(), store)

    expect(calls).toHaveLength(1)
    expect(await store.isBotAuthoredPartnerMsg('M_botNew')).toBe(true) // chain continues
  })

  it('quote-to-human (store miss, no mention): no responder, no reply', async () => {
    const store = new MemoryStore()
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)
    const spy = vi.fn()
    setPartnerGroupResponder(fakeResponderSpy(spy))

    await getEventHandler()(quoteEvent(), store) // M_botPrev not in store
    expect(calls).toHaveLength(0)
    expect(spy).not.toHaveBeenCalled()
  })

  it('store read throws: fail-safe → no reply, webhook does not throw', async () => {
    const store = new MemoryStore()
    store.isBotAuthoredPartnerMsg = async () => { throw new Error('KV down') }
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)
    await expect(getEventHandler()(quoteEvent(), store)).resolves.toBeUndefined()
    expect(calls).toHaveLength(0)
  })

  it('quote-to-bot + dev command: denied → no reply', async () => {
    const store = new MemoryStore()
    await store.putBotAuthoredPartnerMsg('M_botPrev')
    const { client, calls } = recordingReplyClient(['x'])
    setReplyClient(client)
    await getEventHandler()(quoteEvent({ text: '幫我 deploy 上線' }), store)
    expect(calls).toHaveLength(0)
  })

  it('quote-to-bot redelivery (same messageId): replies exactly once', async () => {
    const store = new MemoryStore()
    await store.putBotAuthoredPartnerMsg('M_botPrev')
    const { client, calls } = recordingReplyClient(['M_botNew'])
    setReplyClient(client)
    setPartnerGroupResponder(fakeResponder('ok'))
    const ev = quoteEvent()
    await getEventHandler()(ev, store)
    await getEventHandler()(ev, store) // redelivery
    expect(calls).toHaveLength(1)
  })

  it('quote-to-bot without replyToken: no reply, warns, responder not called', async () => {
    const store = new MemoryStore()
    await store.putBotAuthoredPartnerMsg('M_botPrev')
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)
    const spy = vi.fn()
    setPartnerGroupResponder(fakeResponderSpy(spy))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await getEventHandler()(quoteEvent({ replyToken: undefined }), store)
    expect(calls).toHaveLength(0)
    expect(spy).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })
})
```

> 若既有 `recordingReplyClient()` 尚未支援自訂回傳 id，於本 task 擴充它接受 `returnIds: string[] = []` 並讓 fake client `return returnIds`。`fakeResponder` / `fakeResponderSpy` 沿用既有 Task 3/4 測試的 responder helper（無則照 `partner-group-responder.test.ts` 風格補）。

### Step 2: 跑測試確認紅

Run: `npm run test:run -- src/lib/line-agent/__tests__/webhook-runtime.test.ts`
Expected: FAIL（目前 precondition 仍只認 `mentionsBot`，quote-to-bot 不回；寫回 store 未實作）

### Step 3: 改 precondition 為 botDirected 版

`mayProducePartnerGroupReply` 由「讀 mentionsBot」改為「吃 botDirected」純判斷（保持 subset 語義）：

```ts
function mayProducePartnerGroupReply(event: NormalizedLineEvent, botDirected: boolean): boolean {
  return (
    event.sourceChannel === 'line_partner_group' &&
    botDirected === true &&
    typeof event.replyToken === 'string' &&
    event.replyToken.trim() !== ''
  )
}
```

### Step 4: 重排 defaultEventHandler

```ts
const defaultEventHandler: NormalizedEventHandler = async (event, store) => {
  // 1. derive botDirected (fail-safe inside; OA plane always false)
  const botDirected = await deriveBotDirected(event, store)

  // 2. cheap precondition (subset of the full gate) using botDirected
  const replyCandidate = mayProducePartnerGroupReply(event, botDirected)

  // 3. send-once claim AFTER botDirected, BEFORE the (billed) responder (§4/§5)
  if (replyCandidate && event.messageId !== '') {
    const claimed = await store.claimPartnerReply(event.messageId)
    if (!claimed) return
  }

  // 4. route — thread botDirected so permissions reach `respond` for quote-to-bot
  const decision = await routeCommand({
    event,
    store,
    llmClassifier: safeDefaultLlmClassifier,
    botDirected,
    partnerGroupResponder: replyCandidate ? getPartnerGroupResponder() : undefined,
  })

  // 5. full gate (post-routing) — only send when it returns true
  if (shouldReplyToPartnerGroup(event, decision, botDirected)) {
    const outboundText = decision.handlerResult!.outboundText!
    try {
      const sentIds = await getReplyClient()(event.replyToken!, [{ type: 'text', text: outboundText }])
      // 6. record bot-authored ids so a future quote to THIS reply is directed.
      // Best-effort: a write failure must not disturb the already-sent reply.
      for (const id of sentIds) {
        try {
          await store.putBotAuthoredPartnerMsg(id)
        } catch (err) {
          console.error(
            '[line-agent] failed to record bot-authored partner msg id; reply already sent:',
            err instanceof Error ? `${err.name}: ${err.message}` : String(err)
          )
        }
      }
    } catch (err) {
      // §5: reply failure must NOT propagate and must NOT fall back to OA/push.
      console.error(
        '[line-agent] partner-group reply failed; suppressed to keep webhook 200:',
        err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      )
    }
    return
  }

  // diagnostic: respond-worthy but missing replyToken (probe must carry botDirected)
  if (
    !event.replyToken &&
    shouldReplyToPartnerGroup({ ...event, replyToken: 'probe' }, decision, botDirected)
  ) {
    console.warn('[line-agent] partner-group respond decision had no replyToken; skipping reply')
  }
}
```

### Step 5: 跑測試確認綠

Run: `npm run test:run -- src/lib/line-agent/__tests__/webhook-runtime.test.ts`
Expected: PASS

### Step 6: 全測試回歸 + commit

Run: `npm run test:run`
Expected: 全綠

```bash
git add src/lib/line-agent/line/webhook-runtime.ts src/lib/line-agent/__tests__/webhook-runtime.test.ts
git commit -m "feat(line-agent): quote-to-bot reply flow (botDirected wiring + record sent ids)"
```

---

## Task 6: 不變量回歸守門（design §6 / §7）

把 design §6 的 7 條不變量鎖成顯式測試（部分已被前面 task 覆蓋，這裡補齊缺口並集中成回歸帶）。不新增產品碼。

**Files:**
- Test: `src/lib/line-agent/__tests__/webhook-runtime.test.ts`（或新建 `quote-to-bot-invariants.test.ts`）

### Step 1: 寫不變量測試

涵蓋尚未被 Task 1–5 直接斷言的缺口：

```ts
describe('quote-to-bot invariants (design §6)', () => {
  // §6.1 customer OA never botDirected
  it('OA inbound with a quotedRef: responder 0, reply client 0', async () => {
    const store = new MemoryStore()
    const { client, calls } = recordingReplyClient(['x'])
    setReplyClient(client)
    const spy = vi.fn(); setPartnerGroupResponder(fakeResponderSpy(spy))
    const oa: NormalizedLineEvent = {
      kind: 'group_quoted', sourceChannel: 'line_oa', lineUserId: 'U_cust',
      messageId: 'M_oa', text: 'hi', mentionsBot: false, timestamp: 1,
      replyToken: 'rt', quotedRef: { quotedMessageId: 'whatever' },
    }
    await getEventHandler()(oa, store)
    expect(calls).toHaveLength(0)
    expect(spy).not.toHaveBeenCalled()
  })

  // §6.7 stub default — no anthropic env → never a billed model
  it('responder defaults to stub when AI_AGENT_PARTNER_RESPONDER_MODE unset', () => {
    delete process.env.AI_AGENT_PARTNER_RESPONDER_MODE
    // getPartnerGroupResponder()() returns STUB_PARTNER_GROUP_REPLY (assert per existing stub test)
  })

  // §6.3 existing tag path still works (regression: mention still replies)
  it('tagged (mentionsBot) message still replies exactly once', async () => {
    const store = new MemoryStore()
    const { client, calls } = recordingReplyClient(['M_new'])
    setReplyClient(client); setPartnerGroupResponder(fakeResponder('ok'))
    await getEventHandler()(taggedPartnerGroupEvent(), store)
    expect(calls).toHaveLength(1)
  })
})
```

> §6.2（引用真人不回）、§6.4（denied 不回）、§6.5（redelivery 不重燒）、§6.6（responder 純度：send/store 只在 webhook 發生）已分別被 Task 5 Step 1 / Task 4 覆蓋——若該處已足夠，這裡不重複，只在本檔註明對應測試名稱即可（DRY）。

### Step 2: 跑測試確認紅→實作（無）→綠

> 本 task 不寫產品碼；測試應在 Task 1–5 完成後直接綠。若任一條紅 → 視為前面 task 的缺陷，回該 task 修（systematic-debugging），不要在這裡塞補丁。

Run: `npm run test:run -- src/lib/line-agent/__tests__/`
Expected: PASS

### Step 3: 完整回歸（design §7 #15：第一刀 488 全綠 + 本刀新增）

Run: `npm run test:run`
Expected: 全部綠（488 既有 + 本刀新增，數字應只增不減）

### Step 4: commit

```bash
git add src/lib/line-agent/__tests__/
git commit -m "test(line-agent): quote-to-bot invariants regression band (OA-never, stub-default, tag-path)"
```

---

## 完成後（不在本刀自動執行）

- 文件更新 commit（依 CLAUDE.md「feature commit first, then docs」）：更新 `docs/plans/2026-06-04-quote-to-bot-message-tracking-design.md` 標記「implemented」，並在 `project_line_oa_agent_m1` memory 補一行。
- Push（CLAUDE.md：commit 後立即 push；但本 branch 既有規範為「保留 as-is、不 merge/PR」——push 前先向 Eric 確認是否照常 push 到 `codex/line-oa-agent-mvp`）。
- 實機 smoke（design §7 contract 級已可全 fake 驗；真機 quote-to-bot 三項需 Vercel preview，待 `vercel login`）。

## 邊界自檢（對照 CLAUDE.md Operating Boundaries — 每個 task 都要守住）

- ✅ 客人 OA 不自動回覆（`deriveBotDirected` 對 OA 恆 false；不變量 §6.1 測試證明）。
- ✅ 對外 push / 主動貼群仍需明確 send intent（本刀只做 reply）。
- ✅ 報價 dry-run only，不新增 Sanity 寫入。
- ✅ 無 secrets 進 repo；responder 預設 stub、測試零真 key、零真 API。
- ✅ CC/tmux 是 operator，bot 只是 LINE 執行通道。
