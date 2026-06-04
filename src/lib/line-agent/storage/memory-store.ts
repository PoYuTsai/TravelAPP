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
import type { CaseStore } from './store'

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

  async putBotAuthoredPartnerMsg(messageId: string): Promise<void> {
    if (messageId === '') return
    this.botAuthoredPartnerMsgs.add(messageId)
  }

  // ── isBotAuthoredPartnerMsg ──────────────────────────────────────────────────

  async isBotAuthoredPartnerMsg(messageId: string): Promise<boolean> {
    if (messageId === '') return false
    return this.botAuthoredPartnerMsgs.has(messageId)
  }
}
