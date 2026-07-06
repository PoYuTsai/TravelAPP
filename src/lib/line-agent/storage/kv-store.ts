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
import type { TranscriptEntry } from '../transcript/transcript-entry'
import type {
  DistillPendingBatch,
  DistillApprovalConfirmation,
} from '../distill/pending'
import type { OaContactRecord } from '../ads/oa-contact-record'
import {
  type CaseStore,
  BOT_AUTHORED_CONTENT_MAX_CHARS,
} from './store'

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
  /** SET key value EX ttlSeconds — set with an expiry (seconds). */
  setWithTtl(key: string, value: unknown, ttlSeconds: number): Promise<unknown>
  /**
   * SET key value NX — set only when the key is absent.
   * Resolves `true` when this call created the key, `false` when it already
   * existed.  This is the atomic primitive behind the partner-reply claim.
   */
  setIfAbsent(key: string, value: unknown): Promise<boolean>
  /**
   * INCRBY key by — integer accumulate; attach a TTL (seconds) when this call
   * CREATES the key.  Resolves to the post-increment total.  This is the
   * metering primitive behind the daily LLM cost cap（P0-A 刀 2）.
   */
  incrByWithTtl(key: string, by: number, ttlSeconds: number): Promise<number>
  del(...keys: string[]): Promise<unknown>
  /** RPUSH — append values to a Redis list */
  rpush(key: string, ...values: string[]): Promise<unknown>
  /** LRANGE — retrieve a range from a Redis list */
  lrange(key: string, start: number, stop: number): Promise<string[]>
  /** KEYS — match keys by pattern (avoid in hot paths; used for listAll) */
  keys(pattern: string): Promise<string[]>
  /** TTL key — 剩餘秒數；無 TTL 回 -1、key 不存在回 -2（Redis 語意）。 */
  ttl(key: string): Promise<number>
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
    setWithTtl(key: string, value: unknown, ttlSeconds: number): Promise<unknown> {
      return redis.set(key, JSON.stringify(value), { ex: ttlSeconds })
    },
    async setIfAbsent(key: string, value: unknown): Promise<boolean> {
      // Upstash `SET … NX` returns "OK" when the key was created, null when it
      // already existed.  (`automaticDeserialization: false` keeps it a raw
      // string, so the strict "OK" compare is reliable.)
      const res = await redis.set(key, JSON.stringify(value), { nx: true })
      return res === 'OK'
    },
    async incrByWithTtl(key: string, by: number, ttlSeconds: number): Promise<number> {
      const total = await redis.incrby(key, by)
      // The key was just CREATED iff the post-increment total equals this
      // increment — only then attach the TTL.  Two concurrent first increments
      // race benignly: exactly one of them observes total === by.
      if (total === by) await redis.expire(key, ttlSeconds)
      return total
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
    ttl(key: string): Promise<number> {
      return redis.ttl(key)
    },
  }
}

/**
 * Build a real Upstash-backed KvClient from env, or null when either
 * `AGENT_KV_URL` / `AGENT_KV_TOKEN` is missing（fail closed — callers must
 * treat null as "KV not wired"）.  Construction is network-free; only method
 * calls hit the wire.  Shared by KvStore's env fallback and the daily cost
 * cap（P0-A 刀 2）.
 */
export function createKvClientFromEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined'
    ? process.env
    : {},
): KvClient | null {
  const url = (env.AGENT_KV_URL ?? '').trim()
  const token = (env.AGENT_KV_TOKEN ?? '').trim()
  return url !== '' && token !== '' ? createUpstashKvClient(url, token) : null
}

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

const CASE_PREFIX = 'case:'
const LINE_USER_PREFIX = 'lineUser:'
const AUDIT_PREFIX = 'audit:'
// Dedicated namespace for partner-reply send-once markers.  Deliberately
// distinct from CASE_PREFIX so these markers never match `case:*` in listAll().
const PARTNER_REPLY_PREFIX = 'line-agent:partner-reply:'
// Dedicated namespace for bot-authored partner-group message ids (quote-to-bot
// plan §2).  Written ONLY by the webhook send gate's partner-group path; the
// customer OA plane never writes here, so an OA quotedMessageId can never hit.
const PARTNER_BOT_MSG_PREFIX = 'line-agent:partner-bot-msg:'
// Sibling namespace for the cached OUTBOUND content of a bot-authored message
// (M3.6c quote-to-bot carryover).  Distinct from the id-flag namespace so the
// flag and the content have independent lifecycles and neither matches case:*.
const PARTNER_BOT_MSG_CONTENT_PREFIX = 'line-agent:partner-bot-msg-content:'
const BOT_AUTHORED_TTL_SECONDS = 604800 // 7 days
// Dedicated namespace for per-message image markers in the partner group
// （圖片刀B：引用圖＋tag 即觸發）.  Written ONLY by the webhook's partner-group
// image path; the customer OA plane never writes here.  TTL mirrors the
// bot-authored marker（7 天）— both answer「被引用的那則訊息是什麼」; a quote
// to an expired marker simply does not trigger vision（fail-closed）.
const PARTNER_GROUP_IMG_PREFIX = 'line-agent:partner-group-img-msg:'
const PARTNER_GROUP_IMG_TTL_SECONDS = 604800 // 7 days
// 旁聽存檔（沉澱管線刀1）— 獨立 namespace，永不 match case:* 。TTL 30 天
// 滾動窗（design 2026-06-11：不永久留存夥伴對話—隱私重量）；同 messageId
// 覆寫＝LINE at-least-once 冪等。
const TRANSCRIPT_PREFIX = 'line-agent:transcript:'
const TRANSCRIPT_TTL_SECONDS = 2_592_000 // 30 days
// 沉澱過目 pending batch（刀2）— singleton per groupId。TTL 30 天：candidates
// 的源頭 transcript 最多也只活 30 天，掛更久沒有意義。
const DISTILL_PENDING_PREFIX = 'line-agent:distill-pending:'
const DISTILL_PENDING_TTL_SECONDS = 2_592_000 // 30 days
// 刀A：複述確認狀態 — singleton per groupId。TTL 10 分鐘：複述貼出後沒人
// 確認就自動作廢（design §1），絕不讓 stale 確認在幾小時後誤觸發收錄。
const DISTILL_CONFIRM_PREFIX = 'line-agent:distill-confirm:'
const DISTILL_CONFIRM_TTL_SECONDS = 600 // 10 分鐘（design §1 複述確認）
// 廣告刀1：OA 被動聯絡記錄 — 獨立 namespace，以 userId 為 key，永不 match case:*。
// TTL 60 天：每日轉換表回填的滾動窗；同 userId 覆寫＝加好友→首訊軌跡最新化。
const OA_CONTACT_KEY_PREFIX = 'oa:contact:'
const OA_CONTACT_TTL_SECONDS = 5_184_000 // 60 days（60 * 24 * 60 * 60）

function caseKey(caseId: string): string {
  return `${CASE_PREFIX}${caseId}`
}

function partnerReplyKey(messageId: string): string {
  return `${PARTNER_REPLY_PREFIX}${messageId}`
}

function partnerBotMsgKey(messageId: string): string {
  return `${PARTNER_BOT_MSG_PREFIX}${messageId}`
}

function partnerBotMsgContentKey(messageId: string): string {
  return `${PARTNER_BOT_MSG_CONTENT_PREFIX}${messageId}`
}

function partnerGroupImgKey(messageId: string): string {
  return `${PARTNER_GROUP_IMG_PREFIX}${messageId}`
}

function transcriptKey(messageId: string): string {
  return `${TRANSCRIPT_PREFIX}${messageId}`
}

function oaContactKey(userId: string): string {
  return `${OA_CONTACT_KEY_PREFIX}${userId}`
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
    this.client = createKvClientFromEnv()
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

  // ── claimPartnerReply ───────────────────────────────────────────────────────

  async claimPartnerReply(messageId: string): Promise<boolean> {
    const kv = this.ensureClient()
    // Atomic SET NX: the first instance to claim this messageId wins, even
    // under concurrent invocations across serverless instances.
    return kv.setIfAbsent(partnerReplyKey(messageId), 1)
  }

  // ── putBotAuthoredPartnerMsg ─────────────────────────────────────────────────

  async putBotAuthoredPartnerMsg(messageId: string, content?: string): Promise<void> {
    if (messageId === '') return
    const kv = this.ensureClient()
    await kv.setWithTtl(partnerBotMsgKey(messageId), '1', BOT_AUTHORED_TTL_SECONDS)
    // Cache the outbound content (M3.6c) only when supplied — preserves the
    // id-only write for callers that do not pass content.
    if (typeof content === 'string' && content !== '') {
      await kv.setWithTtl(
        partnerBotMsgContentKey(messageId),
        content.slice(0, BOT_AUTHORED_CONTENT_MAX_CHARS),
        BOT_AUTHORED_TTL_SECONDS,
      )
    }
  }

  // ── isBotAuthoredPartnerMsg ──────────────────────────────────────────────────

  async isBotAuthoredPartnerMsg(messageId: string): Promise<boolean> {
    if (messageId === '') return false
    const kv = this.ensureClient()
    return (await kv.get(partnerBotMsgKey(messageId))) !== null
  }

  // ── getBotAuthoredPartnerMsgContent ──────────────────────────────────────────

  async getBotAuthoredPartnerMsgContent(messageId: string): Promise<string | null> {
    if (messageId === '') return null
    const kv = this.ensureClient()
    return (await kv.get<string>(partnerBotMsgContentKey(messageId))) ?? null
  }

  // ── Partner-group image tracking（圖片刀B）──────────────────────────────────

  async putPartnerGroupImageMsg(messageId: string): Promise<void> {
    if (messageId === '') return
    const kv = this.ensureClient()
    // Idempotent marker: a LINE redelivery overwrites the same key.
    await kv.setWithTtl(partnerGroupImgKey(messageId), '1', PARTNER_GROUP_IMG_TTL_SECONDS)
  }

  async isPartnerGroupImageMsg(messageId: string): Promise<boolean> {
    if (messageId === '') return false
    const kv = this.ensureClient()
    return (await kv.get(partnerGroupImgKey(messageId))) !== null
  }

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

  // ── 沉澱刀2：markTranscriptDistilled＋pending batch ─────────────────────────

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
      `${DISTILL_PENDING_PREFIX}${batch.groupId}`,
      batch,
      DISTILL_PENDING_TTL_SECONDS,
    )
  }

  async getDistillPending(groupId: string): Promise<DistillPendingBatch | null> {
    if (groupId === '') return null
    const kv = this.ensureClient()
    return kv.get<DistillPendingBatch>(`${DISTILL_PENDING_PREFIX}${groupId}`)
  }

  // ── 刀A：複述確認狀態（KV TTL 10 分鐘）──────────────────────────────────

  async putDistillConfirmation(conf: DistillApprovalConfirmation): Promise<void> {
    if (conf.groupId === '') return
    const kv = this.ensureClient()
    await kv.setWithTtl(
      `${DISTILL_CONFIRM_PREFIX}${conf.groupId}`,
      conf,
      DISTILL_CONFIRM_TTL_SECONDS,
    )
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

  // ── 廣告刀1：OA 被動聯絡記錄（以 userId 為 key，TTL 60 天）───────────────────
  // 獨立 namespace，永不漏進案件面（listAll/get 走 case:*）。list 機制復用
  // listTranscriptEntries 的 keys-scan（無獨立 index-set）。

  async putOaContactRecord(record: OaContactRecord): Promise<void> {
    if (record.userId === '') return
    const kv = this.ensureClient()
    // setWithTtl JSON round-trips the record（同 putTranscriptEntry），
    // 覆寫語意：同 userId 最新軌跡取代舊值。
    await kv.setWithTtl(oaContactKey(record.userId), record, OA_CONTACT_TTL_SECONDS)
  }

  async getOaContactRecord(userId: string): Promise<OaContactRecord | null> {
    if (userId === '') return null
    const kv = this.ensureClient()
    return kv.get<OaContactRecord>(oaContactKey(userId))
  }

  async listOaContactRecords(): Promise<OaContactRecord[]> {
    const kv = this.ensureClient()
    const keys = await kv.keys(`${OA_CONTACT_KEY_PREFIX}*`)
    if (keys.length === 0) return []
    const records = await Promise.all(keys.map((k) => kv.get<OaContactRecord>(k)))
    return records.filter((r): r is OaContactRecord => r !== null)
  }
}
