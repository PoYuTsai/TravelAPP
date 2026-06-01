/**
 * select-store.test.ts
 *
 * Tests for the production store bootstrap selector.
 *
 * Behaviour matrix:
 *   - KV env present                         → KvStore
 *   - No KV env + NODE_ENV !== 'production'   → MemoryStore (local/test)
 *   - No KV env + production (NODE_ENV==prod
 *     OR VERCEL set)                          → THROWS (fail closed)
 *
 * Fail-closed is the whole point: a serverless instance with no KV would look
 * healthy while silently forgetting every case, so we must throw rather than
 * fall back to MemoryStore in production.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { selectStore, StoreBootstrapError } from '../storage/select-store'
import { KvStore } from '../storage/kv-store'
import { MemoryStore } from '../storage/memory-store'

// ---------------------------------------------------------------------------
// Env snapshot / restore — these tests mutate process.env.
// ---------------------------------------------------------------------------

const KEYS = ['AGENT_KV_URL', 'AGENT_KV_TOKEN', 'NODE_ENV', 'VERCEL'] as const
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = {}
  for (const k of KEYS) saved[k] = process.env[k]
  for (const k of KEYS) delete process.env[k]
})

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectStore', () => {
  it('returns a KvStore when KV env vars are present', () => {
    process.env.AGENT_KV_URL = 'https://example.upstash.io'
    process.env.AGENT_KV_TOKEN = 'token-xyz'
    const store = selectStore()
    expect(store).toBeInstanceOf(KvStore)
  })

  it('returns a MemoryStore when KV env is missing and not production', () => {
    process.env.NODE_ENV = 'test'
    const store = selectStore()
    expect(store).toBeInstanceOf(MemoryStore)
  })

  it('returns a MemoryStore in development when KV env is missing', () => {
    process.env.NODE_ENV = 'development'
    const store = selectStore()
    expect(store).toBeInstanceOf(MemoryStore)
  })

  it('THROWS in production (NODE_ENV=production) when KV env is missing — fail closed', () => {
    process.env.NODE_ENV = 'production'
    expect(() => selectStore()).toThrow(StoreBootstrapError)
  })

  it('THROWS when running on Vercel (VERCEL set) and KV env is missing — fail closed', () => {
    process.env.VERCEL = '1'
    expect(() => selectStore()).toThrow(StoreBootstrapError)
  })

  it('prefers KvStore even in production when KV env IS present', () => {
    process.env.NODE_ENV = 'production'
    process.env.AGENT_KV_URL = 'https://example.upstash.io'
    process.env.AGENT_KV_TOKEN = 'token-xyz'
    const store = selectStore()
    expect(store).toBeInstanceOf(KvStore)
  })
})
