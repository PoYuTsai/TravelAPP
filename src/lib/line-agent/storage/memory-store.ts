/**
 * In-memory implementation of CaseStore.
 *
 * Used in unit tests and local development.  All data lives in Maps in
 * process memory — nothing is persisted across restarts.
 *
 * Thread-safety: Node.js is single-threaded, so concurrent async operations
 * on the same MemoryStore instance are safe without locks.
 */

import type { AgentCase, CaseStatus } from '../cases/case-state'
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

export class MemoryStore implements CaseStore {
  /** Primary map: caseId → AgentCase */
  private readonly cases = new Map<string, AgentCase>()

  /** Audit log map: caseId → AuditEntry[] (append-only) */
  private readonly audits = new Map<string, AuditEntry[]>()

  /**
   * Send-once markers for partner-group tagged replies (NOT case state).
   * A messageId present here means a reply was already claimed for it.
   */
  private readonly claimedPartnerReplies = new Set<string>()

  /**
   * Bot-authored partner-group message ids (NOT case state).  A messageId here
   * means THIS bot sent it in the partner group, so a later quote-reply to it
   * counts as addressing the bot (quote-to-bot plan §2).
   */
  private readonly botAuthoredPartnerMsgs = new Set<string>()

  /**
   * Cached outbound content of bot-authored partner-group messages (NOT case
   * state), keyed by messageId (M3.6c quote-to-bot carryover).  Length-capped
   * on write; only populated when a content arg is supplied to put.
   */
  private readonly botAuthoredPartnerMsgContent = new Map<string, string>()

  /**
   * Partner-group image message markers (NOT case state) — 圖片刀B.
   * A messageId here means a partner sent it as an IMAGE, so a later quote
   * to it counts as「引用了一張圖」and can trigger the vision path.
   */
  private readonly partnerGroupImageMsgs = new Set<string>()

  /**
   * 旁聽存檔（沉澱管線刀1，NOT case state）— messageId → TranscriptEntry。
   * In-memory 不模擬 TTL（同其他 marker 的慣例）；30 天滾動窗只在 KV 層成立。
   */
  private readonly transcriptEntries = new Map<string, TranscriptEntry>()

  /**
   * 沉澱過目 pending batch（刀2，NOT case state）— groupId → batch。
   * Singleton per groupId、覆寫語意；in-memory 不模擬 TTL（同上慣例）。
   */
  private readonly distillPending = new Map<string, DistillPendingBatch>()

  /**
   * 刀A 複述確認狀態（NOT case state）— groupId → confirmation。
   * Singleton per groupId、覆寫語意；in-memory 不模擬 TTL（同上慣例），
   * 10 分鐘過期只在 KV 層成立。
   */
  private readonly distillConfirmations = new Map<string, DistillApprovalConfirmation>()

  /**
   * 廣告刀1：OA 被動聯絡記錄（NOT case state）— userId → OaContactRecord。
   * 覆寫語意；in-memory 不模擬 TTL（同其他 marker 的慣例）。
   */
  private readonly oaContactRecords = new Map<string, OaContactRecord>()

  // ── put ───────────────────────────────────────────────────────────────────

  async put(agentCase: AgentCase): Promise<void> {
    // Shallow copy to prevent callers from mutating the stored record via
    // their reference.  Deep structures (knownFacts, linkedGroupMessageIds)
    // get their own copies too.
    this.cases.set(agentCase.caseId, {
      ...agentCase,
      customerMessages: [...(agentCase.customerMessages ?? [])],
      missingFields: [...agentCase.missingFields],
      knownFacts: { ...agentCase.knownFacts },
      linkedGroupMessageIds: [...agentCase.linkedGroupMessageIds],
      processedMessageIds: [...agentCase.processedMessageIds],
    })
  }

  // ── get ───────────────────────────────────────────────────────────────────

  async get(caseId: string): Promise<AgentCase | null> {
    return this.cases.get(caseId) ?? null
  }

  // ── getByLineUserId ───────────────────────────────────────────────────────

  async getByLineUserId(lineUserId: string): Promise<AgentCase | null> {
    // Return the most recently active case for this LINE user, excluding
    // terminal statuses (converted/lost are complete records).
    // In MVP there should be at most one active case per LINE user, but
    // we guard defensively by returning the most recently updated one.
    let best: AgentCase | null = null

    for (const c of Array.from(this.cases.values())) {
      if (c.lineUserId !== lineUserId) continue
      if (c.status === 'converted' || c.status === 'lost') continue
      if (
        best === null ||
        c.lastCustomerMessageAt > best.lastCustomerMessageAt
      ) {
        best = c
      }
    }

    return best
  }

  // ── listAll ───────────────────────────────────────────────────────────────

  async listAll(): Promise<AgentCase[]> {
    return Array.from(this.cases.values())
  }

  // ── listByStatus ──────────────────────────────────────────────────────────

  async listByStatus(status: CaseStatus): Promise<AgentCase[]> {
    return Array.from(this.cases.values()).filter((c) => c.status === status)
  }

  // ── delete ────────────────────────────────────────────────────────────────

  async delete(caseId: string): Promise<void> {
    this.cases.delete(caseId)
    this.audits.delete(caseId)
  }

  // ── appendAudit ───────────────────────────────────────────────────────────

  async appendAudit(caseId: string, entry: AuditEntry): Promise<void> {
    const existing = this.audits.get(caseId) ?? []
    this.audits.set(caseId, [...existing, { ...entry }])
  }

  // ── getAudit ──────────────────────────────────────────────────────────────

  async getAudit(caseId: string): Promise<AuditEntry[]> {
    return this.audits.get(caseId) ?? []
  }

  // ── claimPartnerReply ───────────────────────────────────────────────────────

  async claimPartnerReply(messageId: string): Promise<boolean> {
    // Single-threaded Node: this check-then-add pair is effectively atomic.
    if (this.claimedPartnerReplies.has(messageId)) return false
    this.claimedPartnerReplies.add(messageId)
    return true
  }

  // ── putBotAuthoredPartnerMsg ─────────────────────────────────────────────────

  async putBotAuthoredPartnerMsg(messageId: string, content?: string): Promise<void> {
    if (messageId === '') return
    this.botAuthoredPartnerMsgs.add(messageId)
    if (typeof content === 'string' && content !== '') {
      this.botAuthoredPartnerMsgContent.set(
        messageId,
        content.slice(0, BOT_AUTHORED_CONTENT_MAX_CHARS),
      )
    }
  }

  // ── isBotAuthoredPartnerMsg ──────────────────────────────────────────────────

  async isBotAuthoredPartnerMsg(messageId: string): Promise<boolean> {
    if (messageId === '') return false
    return this.botAuthoredPartnerMsgs.has(messageId)
  }

  // ── getBotAuthoredPartnerMsgContent ──────────────────────────────────────────

  async getBotAuthoredPartnerMsgContent(messageId: string): Promise<string | null> {
    if (messageId === '') return null
    return this.botAuthoredPartnerMsgContent.get(messageId) ?? null
  }

  // ── Partner-group image tracking（圖片刀B）──────────────────────────────────

  async putPartnerGroupImageMsg(messageId: string): Promise<void> {
    if (messageId === '') return
    this.partnerGroupImageMsgs.add(messageId)
  }

  async isPartnerGroupImageMsg(messageId: string): Promise<boolean> {
    if (messageId === '') return false
    return this.partnerGroupImageMsgs.has(messageId)
  }

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

  // ── 沉澱刀2：markTranscriptDistilled＋pending batch ─────────────────────────

  async markTranscriptDistilled(messageId: string): Promise<void> {
    if (messageId === '') return
    const existing = this.transcriptEntries.get(messageId)
    if (!existing) return
    this.transcriptEntries.set(messageId, { ...existing, distilled: true })
  }

  async putDistillPending(batch: DistillPendingBatch): Promise<void> {
    if (batch.groupId === '') return
    // Deep copy（structuredClone）— batch 有巢狀 candidates/resolved，
    // shallow copy 擋不住呼叫端透過引用改已存紀錄。
    this.distillPending.set(batch.groupId, structuredClone(batch))
  }

  async getDistillPending(groupId: string): Promise<DistillPendingBatch | null> {
    if (groupId === '') return null
    return structuredClone(this.distillPending.get(groupId) ?? null)
  }

  // ── 刀A：複述確認狀態 ───────────────────────────────────────────────────

  async putDistillConfirmation(conf: DistillApprovalConfirmation): Promise<void> {
    if (conf.groupId === '') return
    // Deep copy — approval 是巢狀物件，shallow copy 擋不住引用改寫。
    this.distillConfirmations.set(conf.groupId, structuredClone(conf))
  }

  async getDistillConfirmation(groupId: string): Promise<DistillApprovalConfirmation | null> {
    if (groupId === '') return null
    return structuredClone(this.distillConfirmations.get(groupId) ?? null)
  }

  async deleteDistillConfirmation(groupId: string): Promise<void> {
    if (groupId === '') return
    this.distillConfirmations.delete(groupId)
  }

  // ── 廣告刀1：OA 被動聯絡記錄 ───────────────────────────────────────────────

  async putOaContactRecord(record: OaContactRecord): Promise<void> {
    if (record.userId === '') return
    // Shallow copy 防呼叫端透過引用改已存紀錄（同 put 的慣例）。
    this.oaContactRecords.set(record.userId, { ...record })
  }

  async getOaContactRecord(userId: string): Promise<OaContactRecord | null> {
    if (userId === '') return null
    const r = this.oaContactRecords.get(userId)
    return r ? { ...r } : null
  }

  async listOaContactRecords(): Promise<OaContactRecord[]> {
    return Array.from(this.oaContactRecords.values()).map((r) => ({ ...r }))
  }
}
