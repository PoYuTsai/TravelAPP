/**
 * CaseStore interface — the abstract storage contract.
 *
 * Both MemoryStore (tests/local) and KvStore (production) implement this
 * interface.  No consumer of the store should depend on the concrete class.
 */

import type { AgentCase, CaseStatus } from '../cases/case-state'
import type { AuditEntry } from '../audit/audit-log'
import type { TranscriptEntry } from '../transcript/transcript-entry'
import type {
  DistillPendingBatch,
  DistillApprovalConfirmation,
} from '../distill/pending'
import type { OaContactRecord } from '../ads/oa-contact-record'

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

  // ── Partner-group image tracking（圖片刀B）──────────────────────────────────

  /**
   * Mark a partner-group message as an IMAGE message（圖片刀B）, so a later
   * quote-reply to it can be recognised as「引用了一張圖」and trigger the
   * vision path（引用圖＋tag 即觸發、無關鍵詞 — 2026-06-11 拍板）.
   * Idempotent per messageId（LINE redelivery 覆寫同 key）; empty messageId is
   * a no-op.  Lives in its own key namespace — never case state, never the
   * customer OA plane (the webhook only writes partner-group events).
   */
  putPartnerGroupImageMsg(messageId: string): Promise<void>

  /**
   * True iff the messageId was recorded as a partner-group image message and
   * the marker has not expired.  Empty messageId returns false with no I/O.
   */
  isPartnerGroupImageMsg(messageId: string): Promise<boolean>

  // ── 旁聽存檔層（沉澱管線刀1）───────────────────────────────────────────────

  /**
   * Persist one partner-group transcript entry（旁聽存檔，design 2026-06-11 §2 ①）.
   * Idempotent per messageId — LINE at-least-once 重送覆寫同 key，絕不重複記。
   * KV 實作帶 TTL 30 天（滾動窗）；empty messageId 是 no-op。
   * 獨立 key namespace — 永不出現在 listAll()/案件面，OA 客人面永不寫入。
   */
  putTranscriptEntry(entry: TranscriptEntry): Promise<void>

  /**
   * Read one transcript entry by messageId；不存在（或已過期）回 null。
   * Empty messageId 回 null、零 I/O。冪等防雙重 OCR 的前置檢查用。
   */
  getTranscriptEntry(messageId: string): Promise<TranscriptEntry | null>

  /**
   * List all live transcript entries（刀2 批次沉澱掃描＋CLI dry-run 驗證用）。
   * KV 實作走 keys-scan — 不在 webhook 熱路徑上呼叫。
   */
  listTranscriptEntries(): Promise<TranscriptEntry[]>

  // ── 沉澱刀2：批次沉澱＋過目 pending batch ─────────────────────────────────

  /**
   * 把一筆 transcript entry 標為已沉澱（distilled=true），**保留剩餘 TTL** —
   * 絕不重設 30 天（隱私滾動窗不得因掃描而延長）。entry 不存在/已過期＝no-op。
   */
  markTranscriptDistilled(messageId: string): Promise<void>

  /** 寫入該群的沉澱過目 pending batch（singleton per groupId，覆寫語意）。 */
  putDistillPending(batch: DistillPendingBatch): Promise<void>

  /** 讀該群 pending batch；不存在回 null。 */
  getDistillPending(groupId: string): Promise<DistillPendingBatch | null>

  // ── 刀A：複述確認狀態（KV TTL 10 分鐘）──────────────────────────────────

  /** 寫入該群的複述確認狀態（singleton per groupId，覆寫語意；TTL 10 分鐘）。 */
  putDistillConfirmation(conf: DistillApprovalConfirmation): Promise<void>

  /** 讀該群確認狀態；不存在/已過期回 null。empty groupId 回 null、零 I/O。 */
  getDistillConfirmation(groupId: string): Promise<DistillApprovalConfirmation | null>

  /** 刪除該群確認狀態（講了別的＝作廢）。empty groupId 是 no-op；冪等。 */
  deleteDistillConfirmation(groupId: string): Promise<void>

  // ── 廣告刀1：OA 被動聯絡記錄（以 userId 為 key）────────────────────────────

  /**
   * Persist（insert or update）一筆 OA 被動聯絡記錄。userId 為 primary key —
   * 覆寫語意（last write wins）。empty userId 是 no-op。獨立 namespace — 永不
   * 出現在案件面（listAll()/get()），永不觸發對客回覆。
   */
  putOaContactRecord(record: OaContactRecord): Promise<void>

  /** 依 userId 讀一筆記錄；不存在回 null。empty userId 回 null、零 I/O。 */
  getOaContactRecord(userId: string): Promise<OaContactRecord | null>

  /** 列出所有 OA 聯絡記錄（每日轉換表批次填 Sheet 掃描用）。 */
  listOaContactRecords(): Promise<OaContactRecord[]>
}
