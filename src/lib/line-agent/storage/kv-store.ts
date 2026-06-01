/**
 * KV / Upstash-compatible implementation of CaseStore.
 *
 * Production usage: backed by Vercel KV / Upstash Redis.
 * Test safety: the KV client is INJECTED via the constructor.
 *   - In tests, pass a mock client or use MemoryStore instead.
 *   - When no client is provided, the constructor checks for AGENT_KV_URL
 *     in the environment.  If missing, every method throws KvNotConfiguredError
 *     rather than making unexpected network calls.
 *
 * Key schema (see product spec "Temporary Storage"):
 *   case:{caseId}                  → JSON-serialised AgentCase
 *   lineUser:{lineUserId}:activeCase → caseId string
 *   audit:{caseId}                 → JSON array of AuditEntry (append as list)
 */

import { Redis } from '@upstash/redis'
import { type AgentCase, type CaseStatus, TERMINAL_STATUSES } from '../cases/case-state'
import type { AuditEntry } from '../audit/audit-log'
import type { CaseStore } from './store'

// ---------------------------------------------------------------------------
// Error when KV is not configured
// ---------------------------------------------------------------------------

export class KvNotConfiguredError extends Error {
  constructor() {
    super(
      '[KvNotConfiguredError] KV store is not configured. ' +
        'Set AGENT_KV_URL / AGENT_KV_TOKEN or inject a client in tests.'
    )
    this.name = 'KvNotConfiguredError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ---------------------------------------------------------------------------
// Minimal KV client interface (subset of Upstash/Vercel KV we actually need)
// ---------------------------------------------------------------------------

/**
 * The minimal interface the KvStore needs from an Upstash/Vercel KV client.
 * Inject a real @upstash/redis client in production, or a mock in tests.
 */
export interface KvClient {
  get<T = unknown>(key: string): Promise<T | null>
  set(key: string, value: unknown): Promise<unknown>
  del(...keys: string[]): Promise<unknown>
  /** RPUSH — append values to a Redis list */
  rpush(key: string, ...values: string[]): Promise<unknown>
  /** LRANGE — retrieve a range from a Redis list */
  lrange(key: string, start: number, stop: number): Promise<string[]>
  /** KEYS — match keys by pattern (avoid in hot paths; used for listAll) */
  keys(pattern: string): Promise<string[]>
}

// ---------------------------------------------------------------------------
// Real Upstash adapter
// ---------------------------------------------------------------------------

/**
 * Wrap a real @upstash/redis client in the minimal KvClient contract the
 * KvStore depends on — the SAME contract the test mock guarantees.
 *
 * `automaticDeserialization: false` is deliberate: with Upstash's default
 * (true), `lrange` would JSON-parse each list element, so `getAudit`'s own
 * `JSON.parse(string)` would receive an already-parsed object and throw.
 * Turning it off makes Upstash return raw strings, and we own (de)serialization
 * explicitly here — objects round-trip via JSON, list elements stay raw strings.
 */
function createUpstashKvClient(url: string, token: string): KvClient {
  const redis = new Redis({ url, token, automaticDeserialization: false })
  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      const raw = (await redis.get(key)) as string | null
      return raw == null ? null : (JSON.parse(raw) as T)
    },
    set(key: string, value: unknown): Promise<unknown> {
      return redis.set(key, JSON.stringify(value))
    },
    del(...keys: string[]): Promise<unknown> {
      return redis.del(...keys)
    },
    rpush(key: string, ...values: string[]): Promise<unknown> {
      return redis.rpush(key, ...values)
    },
    async lrange(key: string, start: number, stop: number): Promise<string[]> {
      return (await redis.lrange(key, start, stop)) as string[]
    },
    keys(pattern: string): Promise<string[]> {
      return redis.keys(pattern)
    },
  }
}

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

const CASE_PREFIX = 'case:'
const LINE_USER_PREFIX = 'lineUser:'
const AUDIT_PREFIX = 'audit:'

function caseKey(caseId: string): string {
  return `${CASE_PREFIX}${caseId}`
}

function lineUserKey(lineUserId: string): string {
  return `${LINE_USER_PREFIX}${lineUserId}:activeCase`
}

function auditKey(caseId: string): string {
  return `${AUDIT_PREFIX}${caseId}`
}

// ---------------------------------------------------------------------------
// KvStore
// ---------------------------------------------------------------------------

export class KvStore implements CaseStore {
  private readonly client: KvClient | null

  /**
   * @param client Optional KV client.  If omitted, the constructor checks
   *               process.env.AGENT_KV_URL.  If still absent, all methods
   *               will throw KvNotConfiguredError.
   */
  constructor(client?: KvClient) {
    if (client) {
      this.client = client
      return
    }
    // No injected client: construct a real Upstash client only when BOTH env
    // vars are present.  Otherwise stay unconfigured so every method throws
    // KvNotConfiguredError (fail closed) instead of making surprise network
    // calls during env-less test runs.  Importing @upstash/redis has no side
    // effects; only constructing the client + calling methods hits the network.
    const url = typeof process !== 'undefined' ? process.env.AGENT_KV_URL : undefined
    const token = typeof process !== 'undefined' ? process.env.AGENT_KV_TOKEN : undefined
    this.client = url && token ? createUpstashKvClient(url, token) : null
  }

  private ensureClient(): KvClient {
    if (!this.client) throw new KvNotConfiguredError()
    return this.client
  }

  // ── put ───────────────────────────────────────────────────────────────────

  async put(agentCase: AgentCase): Promise<void> {
    const kv = this.ensureClient()
    await kv.set(caseKey(agentCase.caseId), agentCase)
    // Maintain the lineUser → activeCase index.  Terminal cases
    // (converted/lost) must DROP OUT of the active index so getByLineUserId
    // returns null for them — mirroring MemoryStore's read-time exclusion.
    // The case record itself stays under case:{id} and is still retrievable
    // by caseId; only the active pointer is cleared.
    if (TERMINAL_STATUSES.has(agentCase.status)) {
      await kv.del(lineUserKey(agentCase.lineUserId))
    } else {
      await kv.set(lineUserKey(agentCase.lineUserId), agentCase.caseId)
    }
  }

  // ── get ───────────────────────────────────────────────────────────────────

  async get(caseId: string): Promise<AgentCase | null> {
    const kv = this.ensureClient()
    return kv.get<AgentCase>(caseKey(caseId))
  }

  // ── getByLineUserId ───────────────────────────────────────────────────────

  async getByLineUserId(lineUserId: string): Promise<AgentCase | null> {
    const kv = this.ensureClient()
    const caseId = await kv.get<string>(lineUserKey(lineUserId))
    if (!caseId) return null
    return this.get(caseId)
  }

  // ── listAll ───────────────────────────────────────────────────────────────

  async listAll(): Promise<AgentCase[]> {
    const kv = this.ensureClient()
    const keys = await kv.keys(`${CASE_PREFIX}*`)
    if (keys.length === 0) return []
    const cases = await Promise.all(
      keys.map((k) => kv.get<AgentCase>(k))
    )
    return cases.filter((c): c is AgentCase => c !== null)
  }

  // ── listByStatus ──────────────────────────────────────────────────────────

  async listByStatus(status: CaseStatus): Promise<AgentCase[]> {
    const all = await this.listAll()
    return all.filter((c) => c.status === status)
  }

  // ── delete ────────────────────────────────────────────────────────────────

  async delete(caseId: string): Promise<void> {
    const kv = this.ensureClient()
    const existing = await this.get(caseId)
    if (existing) {
      await kv.del(lineUserKey(existing.lineUserId))
    }
    await kv.del(caseKey(caseId))
    await kv.del(auditKey(caseId))
  }

  // ── appendAudit ───────────────────────────────────────────────────────────

  async appendAudit(caseId: string, entry: AuditEntry): Promise<void> {
    const kv = this.ensureClient()
    await kv.rpush(auditKey(caseId), JSON.stringify(entry))
  }

  // ── getAudit ──────────────────────────────────────────────────────────────

  async getAudit(caseId: string): Promise<AuditEntry[]> {
    const kv = this.ensureClient()
    const raw = await kv.lrange(auditKey(caseId), 0, -1)
    return raw.map((s) => JSON.parse(s) as AuditEntry)
  }
}
