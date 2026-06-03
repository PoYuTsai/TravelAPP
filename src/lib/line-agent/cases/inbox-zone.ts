/**
 * inbox-zone.ts
 *
 * SLA-oriented inbox zones for the operator `/inbox` view.
 *
 * The `InboxZone` union is the type seam that `reminder.ts` imports (defined
 * first to avoid a forward reference between the zone resolver and the reminder
 * engine — plan §3 型別相依順序).  `resolveInboxZone` (design §6.2) and the
 * within-zone comparator (design §6.3) follow below.
 *
 * Zoning is ADVISORY presentation only: it decides which `/inbox` bucket a case
 * shows in.  It NEVER widens permissions, NEVER replies, NEVER pushes.
 */

import type { CaseStatus } from './case-state'
import type { CustomerEventCategory } from './customer-event'
import type { ReminderCandidate } from './reminder'

export type InboxZone =
  | 'need_reply' // 需回覆 / 需處理
  | 'awaiting_customer' // 等客人補資料
  | 'ready_itinerary' // 可排行程
  | 'quote_review' // 報價待檢查
  | 'quoted_tracking' // 已報價、追蹤中
  | 'browsing_idle' // 瀏覽中 / 靜置
  | 'needs_eric' // 需 Eric 介入

/**
 * Fixed display order, most urgent first (design §6.4). `needs_eric` always
 * pins to the top; `browsing_idle` sinks to the bottom. The `/inbox` renderer
 * iterates this array so empty zones still print a collapsed `(0)` header.
 */
export const INBOX_ZONE_ORDER: readonly InboxZone[] = [
  'needs_eric',
  'need_reply',
  'awaiting_customer',
  'ready_itinerary',
  'quote_review',
  'quoted_tracking',
  'browsing_idle',
]

// ---------------------------------------------------------------------------
// Zone resolver (design §6.2) — rules top-to-bottom, first match wins
// ---------------------------------------------------------------------------

/**
 * Customer-event categories that always demand a human reply (design §6.2 rule
 * 2). A case carrying one of these as its latest event lands in `need_reply`
 * regardless of status — a change/price/product question or an OCR-needed media
 * drop must never be silenced by a later status rule.
 */
const NEED_REPLY_CATEGORIES: ReadonlySet<CustomerEventCategory> =
  new Set<CustomerEventCategory>([
    'change_request',
    'price_question',
    'product_or_itinerary_question',
    'media_or_ocr_needed',
  ])

/**
 * Categories that, on their own, indicate the customer is just browsing / made
 * small talk (design §6.2 rule 7).
 */
const BROWSING_CATEGORIES: ReadonlySet<CustomerEventCategory> =
  new Set<CustomerEventCategory>(['menu_browsing', 'non_actionable'])

export interface ZoneInput {
  status: CaseStatus
  /** Latest customer-event category, if classified (advisory). */
  latestEventCategory?: CustomerEventCategory
  /** Whether the case has an open customer question with no reply yet. */
  hasUnansweredQuestion: boolean
  /** Escalation signal (medical/safety, competitor compare, spam, dup — §8). */
  isEscalation: boolean
  /** Whether a `new_inquiry` has aged past its reply SLA. */
  newInquiryOverdue: boolean
}

/**
 * Resolve the inbox zone for a case (design §6.2).
 *
 * Rules are evaluated strictly top-to-bottom; the first match wins. The final
 * fallback is the conservative `need_reply` ("寧可多看一眼") so nothing ever
 * silently disappears from the operator view.
 */
export function resolveInboxZone(input: ZoneInput): InboxZone {
  // 1. Escalation pins to the top, overriding every other signal.
  if (input.isEscalation) return 'needs_eric'

  // 2. Anything that needs a human reply.
  if (
    input.hasUnansweredQuestion ||
    input.newInquiryOverdue ||
    (input.latestEventCategory !== undefined &&
      NEED_REPLY_CATEGORIES.has(input.latestEventCategory))
  ) {
    return 'need_reply'
  }

  // 3–6. Status-driven zones.
  if (input.status === 'needs_info') return 'awaiting_customer'
  if (input.status === 'ready_for_itinerary') return 'ready_itinerary'
  if (input.status === 'quote_review' || input.status === 'ready_for_quote') {
    return 'quote_review'
  }
  if (input.status === 'quoted_tracking') return 'quoted_tracking'

  // 7. Browsing / small talk / idle.
  if (
    input.status === 'idle' ||
    (input.latestEventCategory !== undefined &&
      BROWSING_CATEGORIES.has(input.latestEventCategory))
  ) {
    return 'browsing_idle'
  }

  // Fallback — conservative: keep it visible in the reply queue.
  return 'need_reply'
}

// ---------------------------------------------------------------------------
// Within-zone ordering (design §6.3)
// ---------------------------------------------------------------------------

/** Minimal shape needed to order cases inside a zone. */
export interface ZoneSortable {
  /** Reminder severity, if any; undefined = no active reminder. */
  severity?: ReminderCandidate['severity']
  /** Hours past the reminder threshold (0 when no reminder). */
  ageHours: number
  /** ISO-8601 timestamp of the most recent customer message. */
  lastCustomerMessageAt: string
}

const SEVERITY_RANK: Record<ReminderCandidate['severity'], number> = {
  urgent: 3,
  attention: 2,
  info: 1,
}

function severityRank(severity: ZoneSortable['severity']): number {
  return severity ? SEVERITY_RANK[severity] : 0
}

/**
 * Comparator for cases within the same zone (design §6.3):
 *   1. severity (urgent > attention > info > none)
 *   2. reminder ageHours (longer overdue first)
 *   3. most recent customer message first
 *
 * Returns a negative number when `a` should sort before `b`.
 */
export function compareWithinZone(a: ZoneSortable, b: ZoneSortable): number {
  const bySeverity = severityRank(b.severity) - severityRank(a.severity)
  if (bySeverity !== 0) return bySeverity

  const byAge = b.ageHours - a.ageHours
  if (byAge !== 0) return byAge

  return b.lastCustomerMessageAt.localeCompare(a.lastCustomerMessageAt)
}
