/**
 * Case status enum/union, AgentCase data type, and createInitialCase helper.
 *
 * All 12 canonical statuses are defined here as a string-literal union.
 * No other file may introduce ad-hoc case status strings — always import
 * CaseStatus from this module.
 */

import type { CustomerEventCategory } from './customer-event'

// ---------------------------------------------------------------------------
// CaseStatus — EXACTLY these 12 values, no others
// ---------------------------------------------------------------------------

export type CaseStatus =
  | 'new_inquiry'
  | 'needs_info'
  | 'ready_for_itinerary'
  | 'itinerary_in_progress'
  | 'itinerary_review'
  | 'ready_for_quote'
  | 'quote_review'
  | 'quoted_tracking'
  | 'added_eric'
  | 'converted'
  | 'lost'
  | 'idle'

/**
 * Array of all valid status values — useful for validation loops and tests.
 * Keep in sync with the CaseStatus union above.
 */
export const ALL_CASE_STATUSES: CaseStatus[] = [
  'new_inquiry',
  'needs_info',
  'ready_for_itinerary',
  'itinerary_in_progress',
  'itinerary_review',
  'ready_for_quote',
  'quote_review',
  'quoted_tracking',
  'added_eric',
  'converted',
  'lost',
  'idle',
]

/**
 * Terminal statuses: once a case reaches these, no further transitions
 * are allowed (except possibly re-opening, which is out of MVP scope).
 */
export const TERMINAL_STATUSES: ReadonlySet<CaseStatus> = new Set<CaseStatus>([
  'converted',
  'lost',
])

/**
 * Keep only recent customer messages in the case record.  The full product
 * will eventually have a richer event store; this bounded history is enough
 * for MVP triage ("what did the customer just ask?") without unbounded KV
 * growth.
 */
export const MAX_CUSTOMER_MESSAGES = 50

export interface CustomerMessage {
  /** LINE message ID if available; empty string when LINE omits it. */
  messageId: string
  /** Raw customer text, kept for internal triage and summary only. */
  text: string
  /** ISO-8601 timestamp when the message was received. */
  receivedAt: string
  /** Source channel that produced this customer message. */
  source: 'line_oa'
}

// ---------------------------------------------------------------------------
// AgentCase — the core case data record
// ---------------------------------------------------------------------------

export interface AgentCase {
  /** Unique case identifier, e.g. "CW-0601-001". */
  caseId: string

  /** LINE user ID of the customer who initiated this case. Immutable. */
  lineUserId: string

  /** Display name as reported by LINE. */
  customerDisplayName: string

  /** Current state machine status. */
  status: CaseStatus

  /** ISO-8601 timestamp when the case was first created. */
  createdAt: string

  /** ISO-8601 timestamp of the most recent customer message. */
  lastCustomerMessageAt: string

  /**
   * Recent raw OA customer messages, bounded by MAX_CUSTOMER_MESSAGES.
   * This is the internal source material for "客人問了什麼" summaries.
   */
  customerMessages: CustomerMessage[]

  /** ISO-8601 timestamp of last partner group activity, if any. */
  lastGroupDiscussionAt?: string

  /**
   * Fields the team still needs from the customer.
   * E.g. ["childAges", "childSeat", "accommodationLocation"].
   */
  missingFields: string[]

  /**
   * Free-form known facts extracted from messages.
   * E.g. { dates: "4/12-4/16", adults: 4, children: 2 }.
   */
  knownFacts: Record<string, unknown>

  /**
   * If the case was lost, the reason code.
   * Only set when status === 'lost'.
   */
  lostReason?: string

  /**
   * LINE group message IDs for case cards posted to the partner group.
   * Used to link quoted replies back to this case.
   */
  linkedGroupMessageIds: string[]

  /**
   * LINE messageIds already folded into this case — the idempotency key set
   * for at-least-once webhook delivery.  LINE may redeliver the same event
   * (e.g. after a 500), so the handler skips any messageId already present
   * here.  Bounded to a recent window (a redelivery always arrives within
   * minutes, never after hundreds of newer messages).
   */
  processedMessageIds: string[]

  /**
   * Event category of the most recent customer message (advisory — drives
   * `/inbox` presentation, SLA zoning and reminder candidates only).  Computed
   * at write-time because media/postback events cannot be reclassified from the
   * stored text alone.  Optional for backward compatibility (design §7).
   */
  latestEventCategory?: CustomerEventCategory

  /** ISO-8601 time the above classification was computed. */
  latestClassifiedAt?: string

  // ── OA 超時提醒（design 2026-06-10 §3 刀1）──────────────────────────────
  // LINE webhook 看不到 OA 後台手動回覆 → 「回了沒」只能靠顯式 ack。
  // handled 的判定是 DERIVED：handledAt >= lastCustomerMessageAt 才算已處理；
  // 客人再發新訊息（lastCustomerMessageAt 前進）⇒ 自動回到未處理、重開計時。

  /** ISO-8601 time of the last explicit `@bot done <caseId>` ack. */
  handledAt?: string

  /** Who acked（partner lineUserId or operator label）。 */
  handledBy?: string

  /**
   * 本輪（自 lastCustomerMessageAt 起）已 surfaced 的提醒數 — 單 case 提醒
   * 上限用（防無限重複）。新客人訊息到達時由 reducer 歸零。刀1 dry-run 只讀
   * 不增；刀2 cron 真推時每推一次 +1。
   */
  reminderCount?: number

  /** ISO-8601 time the last reminder was surfaced（刀2 安靜時段／每日上限用）。 */
  lastReminderAt?: string
}

// ---------------------------------------------------------------------------
// createInitialCase — factory for new cases
// ---------------------------------------------------------------------------

export interface CreateInitialCaseParams {
  caseId: string
  lineUserId: string
  customerDisplayName: string
  /** ISO-8601 timestamp — injected so the helper stays deterministic. */
  now: string
  /** Override default initial status (mainly for testing). */
  status?: CaseStatus
}

/**
 * Create a new AgentCase with sensible defaults.
 * The `now` timestamp is injected rather than calling Date.now() internally,
 * so all callers — including tests — get deterministic behaviour.
 */
export function createInitialCase(params: CreateInitialCaseParams): AgentCase {
  return {
    caseId: params.caseId,
    lineUserId: params.lineUserId,
    customerDisplayName: params.customerDisplayName,
    status: params.status ?? 'new_inquiry',
    createdAt: params.now,
    lastCustomerMessageAt: params.now,
    customerMessages: [],
    missingFields: [],
    knownFacts: {},
    linkedGroupMessageIds: [],
    processedMessageIds: [],
  }
}
