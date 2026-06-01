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

import type { AgentCase, CaseStatus } from '../cases/case-state'
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
    // Guard: if no client and no env vars, mark as unconfigured.
    const hasEnv =
      typeof process !== 'undefined' &&
      process.env.AGENT_KV_URL &&
      process.env.AGENT_KV_TOKEN
    this.client = hasEnv ? null : null  // real client would be created here
    // NOTE: In production, replace the line above with:
    //   const { Redis } = require('@upstash/redis')
    //   this.client = new Redis({ url: process.env.AGENT_KV_URL, token: process.env.AGENT_KV_TOKEN })
    // For now, defer to the injected-client pattern.
  }

  private ensureClient(): KvClient {
    if (!this.client) throw new KvNotConfiguredError()
    return this.client
  }

  // ── put ───────────────────────────────────────────────────────────────────

  async put(agentCase: AgentCase): Promise<void> {
    const kv = this.ensureClient()
    await kv.set(caseKey(agentCase.caseId), agentCase)
    // Keep the lineUser → activeCase index updated (overwrites on re-inquiry)
    await kv.set(lineUserKey(agentCase.lineUserId), agentCase.caseId)
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
