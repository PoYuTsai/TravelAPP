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
import { KvStore, KvNotConfiguredError, type KvClient } from '../storage/kv-store'
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
  }
}

// ---------------------------------------------------------------------------
// Contract: KvStore over a mock client must satisfy the same behaviour as
// MemoryStore.
// ---------------------------------------------------------------------------

runCaseStoreContract('KvStore (mock client)', () => new KvStore(makeMockKvClient()))

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
        })
      ).rejects.toBeInstanceOf(KvNotConfiguredError)
    } finally {
      restoreEnv()
    }
  })
})
