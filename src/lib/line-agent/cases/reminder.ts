/**
 * reminder.ts
 *
 * Read-time reminder candidate engine (design §5).
 *
 * ⚠️ READ-TIME ONLY: derived on `/inbox` / reminder queries.  It NEVER writes
 * KV and NEVER sends a LINE message.  Per design §5.2 the default policy is
 * "no push": a candidate only surfaces as an inbox flag.  Turning a candidate
 * into a partner-group nudge requires an explicit operator opt-in through the
 * existing `send` permission gate — never automatic here.
 *
 * `now` is injected so age/threshold math stays deterministic and testable.
 */

import type { CaseStatus } from './case-state'
import type { CustomerEventCategory } from './customer-event'
import type { InboxZone } from './inbox-zone'

// ---------------------------------------------------------------------------
// Reason / candidate types
// ---------------------------------------------------------------------------

export type ReminderReason =
  | 'unanswered_question_overdue' // 有客人提問未回，逾時
  | 'new_inquiry_unhandled' // 新詢問未處理逾時
  | 'awaiting_customer_stale' // 等客人補資料太久，可主動 nudge
  | 'quote_review_pending' // 報價待檢查逾時
  | 'quoted_tracking_followup' // 已報價未回，可追蹤

export interface ReminderCandidate {
  caseId: string
  /** Inbox zone this candidate belongs to (mapped from `reason`). */
  zone: InboxZone
  reason: ReminderReason
  severity: 'info' | 'attention' | 'urgent'
  /** Hours since the triggering condition started (from `lastCustomerMessageAt`). */
  ageHours: number
  /** One-line operator suggestion. May seed a future push draft; never pushed here. */
  suggestedAction: string
  /** ISO-8601 creation time (= input.now). */
  createdAt: string
}

export interface ReminderInput {
  caseId: string
  status: CaseStatus
  /** Latest customer-event category, if classified (advisory). */
  latestEventCategory?: CustomerEventCategory
  hasUnansweredQuestion: boolean
  /** ISO-8601 timestamp of the most recent customer message. */
  lastCustomerMessageAt: string
  /** ISO-8601 "now", injected for determinism. */
  now: string
}

// ---------------------------------------------------------------------------
// Shared reason → zone map (kept in one place so the Task 4 resolver can reuse
// it without drift).
// ---------------------------------------------------------------------------

const REASON_ZONE: Record<ReminderReason, InboxZone> = {
  unanswered_question_overdue: 'need_reply',
  new_inquiry_unhandled: 'need_reply',
  awaiting_customer_stale: 'awaiting_customer',
  quote_review_pending: 'quote_review',
  quoted_tracking_followup: 'quoted_tracking',
}

const REASON_SEVERITY: Record<ReminderReason, ReminderCandidate['severity']> = {
  unanswered_question_overdue: 'urgent',
  new_inquiry_unhandled: 'attention',
  awaiting_customer_stale: 'info',
  quote_review_pending: 'attention',
  quoted_tracking_followup: 'info',
}

const REASON_ACTION: Record<ReminderReason, string> = {
  unanswered_question_overdue: '客人有提問未回，盡快回覆或請夥伴群協助',
  new_inquiry_unhandled: '新詢問尚未處理，確認需求並開案',
  awaiting_customer_stale: '等客人補資料已久，可主動關心一句',
  quote_review_pending: '報價待檢查，確認金額後再決定下一步',
  quoted_tracking_followup: '已報價未回，可追蹤客人意願',
}

/**
 * Categories that must NEVER produce a reminder (守門：瀏覽不催 / 寒暄不催).
 */
const NON_REMINDABLE_CATEGORIES: ReadonlySet<CustomerEventCategory> =
  new Set<CustomerEventCategory>(['menu_browsing', 'non_actionable'])

// ---------------------------------------------------------------------------
// Threshold table (design §5.1) — strict → loose
// ---------------------------------------------------------------------------

const HOUR_MS = 3_600_000

function ageHoursBetween(fromIso: string, nowIso: string): number {
  return (Date.parse(nowIso) - Date.parse(fromIso)) / HOUR_MS
}

/**
 * Derive at most one reminder candidate for a case, or null.
 *
 * Rules are evaluated from most to least urgent; the first match wins.
 * `menu_browsing` / `non_actionable` are gated out entirely.
 */
export function deriveReminderCandidate(input: ReminderInput): ReminderCandidate | null {
  // Guard: browsing / small talk never nags.
  if (input.latestEventCategory && NON_REMINDABLE_CATEGORIES.has(input.latestEventCategory)) {
    return null
  }

  const ageHours = ageHoursBetween(input.lastCustomerMessageAt, input.now)

  const reason = pickReason(input, ageHours)
  if (reason === null) return null

  return {
    caseId: input.caseId,
    zone: REASON_ZONE[reason],
    reason,
    severity: REASON_SEVERITY[reason],
    ageHours,
    suggestedAction: REASON_ACTION[reason],
    createdAt: input.now,
  }
}

function pickReason(input: ReminderInput, ageHours: number): ReminderReason | null {
  if (input.hasUnansweredQuestion && ageHours > 2) {
    return 'unanswered_question_overdue'
  }
  if (input.status === 'new_inquiry' && ageHours > 4) {
    return 'new_inquiry_unhandled'
  }
  if (input.status === 'quote_review' && ageHours > 24) {
    return 'quote_review_pending'
  }
  if (input.status === 'needs_info' && ageHours > 48) {
    return 'awaiting_customer_stale'
  }
  if (input.status === 'quoted_tracking' && ageHours > 72) {
    return 'quoted_tracking_followup'
  }
  return null
}
