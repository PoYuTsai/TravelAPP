/**
 * CaseStore interface — the abstract storage contract.
 *
 * Both MemoryStore (tests/local) and KvStore (production) implement this
 * interface.  No consumer of the store should depend on the concrete class.
 */

import type { AgentCase, CaseStatus } from '../cases/case-state'
import type { AuditEntry } from '../audit/audit-log'

/**
 * Max characters of bot-authored message content cached for quote-to-bot
 * carryover (M3.6c). A defensive bound so a long prior draft never bloats the
 * stored value; the content is only used as a presence trigger + light context,
 * never echoed to a customer.
 */
export const BOT_AUTHORED_CONTENT_MAX_CHARS = 4000

// ---------------------------------------------------------------------------
// CaseStore interface
// ---------------------------------------------------------------------------

export interface CaseStore {
  /**
   * Persist (insert or update) a case record.
   * The caseId is the primary key — a second put with the same caseId
   * replaces the previous record.
   */
  put(agentCase: AgentCase): Promise<void>

  /**
   * Retrieve a case by its caseId.
   * Returns null when not found.
   */
  get(caseId: string): Promise<AgentCase | null>

  /**
   * Retrieve the most-recently-active (non-terminal) case for a LINE user.
   * Returns null when none exists.
   */
  getByLineUserId(lineUserId: string): Promise<AgentCase | null>

  /** List all stored cases. */
  listAll(): Promise<AgentCase[]>

  /** List cases matching a specific status. */
  listByStatus(status: CaseStatus): Promise<AgentCase[]>

  /**
   * Delete a case record by caseId.
   * No-op (does not throw) when the caseId is not found.
   */
  delete(caseId: string): Promise<void>

  // ── Audit log ─────────────────────────────────────────────────────────────

  /**
   * Append an audit entry for a case.
   * Entries are ordered by insertion order (append-only).
   */
  appendAudit(caseId: string, entry: AuditEntry): Promise<void>

  /**
   * Retrieve all audit entries for a case in insertion order.
   * Returns empty array when none exist.
   */
  getAudit(caseId: string): Promise<AuditEntry[]>

  // ── Partner-group reply send-once claim ─────────────────────────────────────

  /**
   * Atomically claim the right to send the partner-group tagged reply for a
   * given LINE messageId.  Returns `true` for the FIRST caller of a messageId
   * and `false` for every subsequent caller (set-if-not-exists / NX semantics).
   *
   * This is the send-once secondary guard (tagged-reply plan §4): LINE delivers
   * at-least-once and concurrent serverless instances may handle the same event,
   * so the reply token's single-use semantics are backstopped here to stop a
   * redelivery from re-billing the responder or sending a duplicate reply.
   *
   * It is NOT case state — partner-group messages are never persisted as cases.
   * The marker lives in its own key namespace and never appears in `listAll()`
   * / `get()` / the customer OA plane.
   */
  claimPartnerReply(messageId: string): Promise<boolean>

  // ── Bot-authored partner-group message tracking ─────────────────────────────

  /**
   * Record that `messageId` is a message THIS bot sent in the partner group, so
   * a later quote-reply to it counts as addressing the bot (quote-to-bot plan
   * §2).  TTL 7 days.  Empty id is a no-op.  Lives in its own key namespace —
   * it is never case state and never appears in the customer OA plane.
   *
   * `content` (M3.6c) is the OUTBOUND text of the message. When provided and
   * non-empty it is cached (length-capped to BOT_AUTHORED_CONTENT_MAX_CHARS) in
   * a sibling namespace so a later quote-to-bot reply can carry the quoted draft
   * into the responder context. Omitting it preserves the prior id-only
   * behaviour (no content cached).
   */
  putBotAuthoredPartnerMsg(messageId: string, content?: string): Promise<void>

  /**
   * True when `messageId` was recorded by putBotAuthoredPartnerMsg and has not
   * expired.  Empty id returns false without I/O.
   */
  isBotAuthoredPartnerMsg(messageId: string): Promise<boolean>

  /**
   * The cached OUTBOUND content of a bot-authored partner-group message (M3.6c).
   * Returns null when no content was cached for `messageId` (id recorded without
   * content, never recorded, or expired) and for an empty id (no I/O). The
   * caller MUST treat null as fail-closed — never fabricate the quoted content.
   */
  getBotAuthoredPartnerMsgContent(messageId: string): Promise<string | null>
}
