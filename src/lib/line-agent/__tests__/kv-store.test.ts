/**
 * kv-store.test.ts
 *
 * Runs the shared CaseStore contract against KvStore (backed by an in-memory
 * mock KvClient that mimics Upstash/Redis semantics), plus KvStore-specific
 * tests for the fail-closed behaviour when no client and no env are present.
 *
 * No network I/O: the mock client is injected via the constructor, so these
 * tests never touch a real Redis.
 */

import { describe, it, expect } from 'vitest'
import {
  KvStore,
  KvNotConfiguredError,
  createKvClientFromEnv,
  type KvClient,
} from '../storage/kv-store'
import { runCaseStoreContract } from './case-store-contract'

// ---------------------------------------------------------------------------
// In-memory mock KvClient — mimics the subset of Redis we use.
//
// Fidelity choices that mirror @upstash/redis:
//  - set/get JSON round-trip objects (so callers can't mutate stored records
//    via a shared reference, just like a real serialise→deserialise hop).
//  - rpush appends raw strings; lrange returns them unchanged.
//  - keys supports a trailing-'*' prefix match (enough for `case:*`).
// ---------------------------------------------------------------------------

function makeMockKvClient(): KvClient {
  const kv = new Map<string, string>()
  const lists = new Map<string, string[]>()

  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      const raw = kv.get(key)
      return raw === undefined ? null : (JSON.parse(raw) as T)
    },
    async set(key: string, value: unknown): Promise<unknown> {
      kv.set(key, JSON.stringify(value))
      return 'OK'
    },
    async setWithTtl(key: string, value: unknown): Promise<unknown> {
      // TTL is not enforced in this in-memory mock; round-trip the value so
      // contract reads behave like a real SET … EX.
      kv.set(key, JSON.stringify(value))
      return 'OK'
    },
    async setIfAbsent(key: string, value: unknown): Promise<boolean> {
      // Mirrors Redis `SET key value NX`: only the first write for a key wins.
      if (kv.has(key)) return false
      kv.set(key, JSON.stringify(value))
      return true
    },
    async incrByWithTtl(key: string, by: number): Promise<number> {
      // TTL not enforced in this in-memory mock (mirrors setWithTtl above).
      const next = Number(kv.get(key) ?? 0) + by
      kv.set(key, String(next))
      return next
    },
    async del(...keys: string[]): Promise<unknown> {
      let removed = 0
      for (const k of keys) {
        if (kv.delete(k)) removed++
        if (lists.delete(k)) removed++
      }
      return removed
    },
    async rpush(key: string, ...values: string[]): Promise<unknown> {
      const existing = lists.get(key) ?? []
      existing.push(...values)
      lists.set(key, existing)
      return existing.length
    },
    async lrange(key: string, start: number, stop: number): Promise<string[]> {
      const list = lists.get(key) ?? []
      // Emulate Redis inclusive range + negative indices (-1 = last element).
      const end = stop < 0 ? list.length + stop : stop
      return list.slice(start, end + 1)
    },
    async keys(pattern: string): Promise<string[]> {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1)
        return Array.from(kv.keys()).filter((k) => k.startsWith(prefix))
      }
      return Array.from(kv.keys()).filter((k) => k === pattern)
    },
    async ttl(key: string): Promise<number> {
      // TTL is not tracked in this mock: existing key → a positive remainder
      // (so markTranscriptDistilled's preserve-TTL rewrite proceeds); missing
      // key → -2 (Redis semantics).
      return kv.has(key) ? 999 : -2
    },
  }
}

// ---------------------------------------------------------------------------
// Contract: KvStore over a mock client must satisfy the same behaviour as
// MemoryStore.
// ---------------------------------------------------------------------------

runCaseStoreContract('KvStore (mock client)', () => new KvStore(makeMockKvClient()))

// ---------------------------------------------------------------------------
// createKvClientFromEnv（P0-A 刀 2 — daily cost cap 的 env→client factory）
// ---------------------------------------------------------------------------

describe('createKvClientFromEnv', () => {
  it('returns null when AGENT_KV_URL / AGENT_KV_TOKEN are missing (fail closed)', () => {
    expect(createKvClientFromEnv({})).toBeNull()
    expect(createKvClientFromEnv({ AGENT_KV_URL: 'https://x.upstash.io' })).toBeNull()
    expect(createKvClientFromEnv({ AGENT_KV_TOKEN: 't' })).toBeNull()
  })

  it('returns a KvClient exposing incrByWithTtl when both env vars are present', () => {
    // Constructing @upstash/redis is network-free; only method calls hit the wire.
    const client = createKvClientFromEnv({
      AGENT_KV_URL: 'https://example.upstash.io',
      AGENT_KV_TOKEN: 'test-token',
    })
    expect(client).not.toBeNull()
    expect(typeof client!.incrByWithTtl).toBe('function')
    expect(typeof client!.get).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Bot-authored partner-group message store (quote-to-bot plan §2 / Task 1)
// ---------------------------------------------------------------------------

describe('bot-authored partner message store', () => {
  it('putBotAuthoredPartnerMsg writes with 7-day TTL; isBotAuthoredPartnerMsg reads it back', async () => {
    const calls: Array<{ key: string; value: unknown; ttl: number }> = []
    const seen = new Set<string>()
    // Inline recording client: only the methods these two store methods touch.
    const client: KvClient = {
      ...makeMockKvClient(),
      async setWithTtl(key, value, ttl) {
        calls.push({ key, value, ttl })
        seen.add(key)
        return 'OK'
      },
      async get<T = unknown>(key: string): Promise<T | null> {
        return (seen.has(key) ? ('1' as unknown as T) : null)
      },
    }
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
    const client: KvClient = {
      ...makeMockKvClient(),
      async setWithTtl(...args) {
        calls.push(args)
        return 'OK'
      },
    }
    await new KvStore(client).putBotAuthoredPartnerMsg('')
    expect(calls).toHaveLength(0)
  })

  it('isBotAuthoredPartnerMsg returns false for empty id without touching KV', async () => {
    let getCalls = 0
    const client: KvClient = {
      ...makeMockKvClient(),
      async get() {
        getCalls++
        return null
      },
    }
    expect(await new KvStore(client).isBotAuthoredPartnerMsg('')).toBe(false)
    expect(getCalls).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Bot-authored partner-group message CONTENT cache (M3.6c quote-to-bot carryover)
// ---------------------------------------------------------------------------

describe('bot-authored partner message content cache', () => {
  it('put(id, content) writes the content key with a 7-day TTL; get reads it back', async () => {
    const calls: Array<{ key: string; value: unknown; ttl: number }> = []
    const kv = new Map<string, string>()
    const client: KvClient = {
      ...makeMockKvClient(),
      async setWithTtl(key, value, ttl) {
        calls.push({ key, value, ttl })
        kv.set(key, String(value))
        return 'OK'
      },
      async get<T = unknown>(key: string): Promise<T | null> {
        return (kv.has(key) ? (kv.get(key) as unknown as T) : null)
      },
    }
    const store = new KvStore(client)

    await store.putBotAuthoredPartnerMsg('Mbot777', '【夥伴內部草稿】行程草稿內容')
    // Two writes: the id flag AND the content, each on its own namespaced key.
    expect(calls).toHaveLength(2)
    const contentCall = calls.find((c) =>
      c.key === 'line-agent:partner-bot-msg-content:Mbot777',
    )
    expect(contentCall).toBeDefined()
    expect(contentCall?.ttl).toBe(604800)
    expect(contentCall?.value).toBe('【夥伴內部草稿】行程草稿內容')

    expect(await store.getBotAuthoredPartnerMsgContent('Mbot777')).toBe(
      '【夥伴內部草稿】行程草稿內容',
    )
    expect(await store.getBotAuthoredPartnerMsgContent('Munknown')).toBeNull()
  })

  it('put without content writes ONLY the id flag (no content key)', async () => {
    const keys: string[] = []
    const client: KvClient = {
      ...makeMockKvClient(),
      async setWithTtl(key, _value, _ttl) {
        keys.push(key)
        return 'OK'
      },
    }
    await new KvStore(client).putBotAuthoredPartnerMsg('Mbot888')
    expect(keys).toEqual(['line-agent:partner-bot-msg:Mbot888'])
  })

  it('getBotAuthoredPartnerMsgContent returns null for empty id without touching KV', async () => {
    let getCalls = 0
    const client: KvClient = {
      ...makeMockKvClient(),
      async get() {
        getCalls++
        return null
      },
    }
    expect(await new KvStore(client).getBotAuthoredPartnerMsgContent('')).toBeNull()
    expect(getCalls).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// markTranscriptDistilled — TTL 保留語意（沉澱刀2）
// 標記絕不延長 30 天滾動窗：先讀剩餘 TTL，再以同值覆寫；讀寫間恰好過期
// （ttl ≤ 0）就跳過 — 寧可漏標也絕不把滾動窗變永久。
// ---------------------------------------------------------------------------

describe('markTranscriptDistilled TTL preservation (KvStore)', () => {
  it('rewrites the entry with the REMAINING ttl, not a fresh 30 days', async () => {
    const calls: Array<{ key: string; value: unknown; ttl: number }> = []
    const base = makeMockKvClient()
    const client: KvClient = {
      ...base,
      async setWithTtl(key, value, ttl) {
        calls.push({ key, value, ttl })
        return base.setWithTtl(key, value, ttl)
      },
      async ttl() {
        return 12345 // 剩 12345 秒（遠小於 30 天）
      },
    }
    const store = new KvStore(client)
    await store.putTranscriptEntry({
      messageId: 'MT001',
      groupId: 'G_partner',
      lineUserId: 'U_tsai',
      timestamp: 1_700_000_000_000,
      kind: 'text',
      text: '高山行程2月可以走嗎',
    })
    calls.length = 0 // 只看 mark 那次寫入

    await store.markTranscriptDistilled('MT001')
    expect(calls).toHaveLength(1)
    expect(calls[0].key).toBe('line-agent:transcript:MT001')
    expect(calls[0].ttl).toBe(12345)
    expect((calls[0].value as { distilled?: boolean }).distilled).toBe(true)
  })

  it('skips the write when the key expired between read and ttl (ttl = -2)', async () => {
    const writes: string[] = []
    const base = makeMockKvClient()
    const client: KvClient = {
      ...base,
      async setWithTtl(key, value, ttl) {
        writes.push(key)
        return base.setWithTtl(key, value, ttl)
      },
      async ttl() {
        return -2 // Redis：key 不存在
      },
    }
    const store = new KvStore(client)
    // 直接塞底層 base，繞過 setWithTtl 記錄（模擬「get 還讀得到、ttl 已 -2」）
    await base.setWithTtl('line-agent:transcript:MT001', {
      messageId: 'MT001',
      groupId: 'G_partner',
      lineUserId: 'U_tsai',
      timestamp: 1_700_000_000_000,
      kind: 'text',
      text: 'x',
    }, 1)

    await store.markTranscriptDistilled('MT001')
    expect(writes).toHaveLength(0) // 絕不覆寫
  })
})

// ---------------------------------------------------------------------------
// Distill confirmation TTL（刀A）— 複述確認 10 分鐘自動作廢（design §1）
// ---------------------------------------------------------------------------

describe('distill confirmation TTL (KvStore)', () => {
  it('putDistillConfirmation writes with 10-minute TTL', async () => {
    const calls: Array<{ key: string; value: unknown; ttl: number }> = []
    const base = makeMockKvClient()
    const client: KvClient = {
      ...base,
      async setWithTtl(key, value, ttl) {
        calls.push({ key, value, ttl })
        return base.setWithTtl(key, value, ttl)
      },
    }
    const store = new KvStore(client)

    await store.putDistillConfirmation({
      groupId: 'G_partner',
      approval: { type: 'approve_all' },
      restatementText: '你是要全收對嗎？引用這句回「對」就收',
      createdAt: 1_700_000_000_000,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].key).toBe('line-agent:distill-confirm:G_partner')
    expect(calls[0].ttl).toBe(600) // 10 minutes in seconds
  })
})

// ---------------------------------------------------------------------------
// Fail-closed: no injected client AND no env → every method throws.
// ---------------------------------------------------------------------------

describe('KvStore fail-closed when unconfigured', () => {
  const savedUrl = process.env.AGENT_KV_URL
  const savedToken = process.env.AGENT_KV_TOKEN

  function clearEnv(): void {
    delete process.env.AGENT_KV_URL
    delete process.env.AGENT_KV_TOKEN
  }
  function restoreEnv(): void {
    if (savedUrl === undefined) delete process.env.AGENT_KV_URL
    else process.env.AGENT_KV_URL = savedUrl
    if (savedToken === undefined) delete process.env.AGENT_KV_TOKEN
    else process.env.AGENT_KV_TOKEN = savedToken
  }

  it('throws KvNotConfiguredError on every method when no client and no env', async () => {
    clearEnv()
    try {
      const store = new KvStore()
      await expect(store.get('x')).rejects.toBeInstanceOf(KvNotConfiguredError)
      await expect(store.getByLineUserId('U')).rejects.toBeInstanceOf(
        KvNotConfiguredError
      )
      await expect(store.listAll()).rejects.toBeInstanceOf(KvNotConfiguredError)
      await expect(
        store.put({
          caseId: 'c',
          lineUserId: 'U',
          customerDisplayName: 'n',
          status: 'new_inquiry',
          createdAt: '2026-06-01T00:00:00.000Z',
          lastCustomerMessageAt: '2026-06-01T00:00:00.000Z',
          missingFields: [],
          knownFacts: {},
          linkedGroupMessageIds: [],
          processedMessageIds: [],
        })
      ).rejects.toBeInstanceOf(KvNotConfiguredError)
    } finally {
      restoreEnv()
    }
  })
})
