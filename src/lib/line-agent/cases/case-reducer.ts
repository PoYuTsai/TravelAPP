/**
 * Pure reducer for the AgentCase state machine.
 *
 * Contract:
 * - PURE: no I/O, no mutations of input objects, no Date.now() calls.
 * - Timestamps are ALWAYS injected via event.now.
 * - A case keyed by lineUserId must NEVER receive events from a different
 *   lineUserId — throws CaseUserMismatchError immediately.
 * - Reducer returns a NEW case object + a NEW audit array (input arrays
 *   are never mutated).
 */

import {
  type AgentCase,
  type CaseStatus,
  TERMINAL_STATUSES,
} from './case-state'
import { type AuditEntry, makeAuditEntry } from '../audit/audit-log'

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class CaseUserMismatchError extends Error {
  constructor(expected: string, received: string, caseId: string) {
    super(
      `[CaseUserMismatchError] Case ${caseId} belongs to lineUserId "${expected}" ` +
        `but received event from lineUserId "${received}". ` +
        `A case must NEVER mix two customers.`
    )
    this.name = 'CaseUserMismatchError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ---------------------------------------------------------------------------
// Event discriminated union
// ---------------------------------------------------------------------------

/** A new customer message arrived on the official LINE OA channel. */
interface LineOAMessageEvent {
  type: 'line_oa_message'
  /** LINE user ID of the sender — MUST match case.lineUserId. */
  lineUserId: string
  text: string
  now: string
}

/** Partner identified that info is missing from the customer. */
interface NeedsInfoEvent {
  type: 'needs_info'
  actor: string
  missingFields: string[]
  now: string
}

/** Partner confirmed all info is sufficient to draft an itinerary. */
interface ReadyForItineraryEvent {
  type: 'ready_for_itinerary'
  actor: string
  now: string
}

/** Partner posted an itinerary draft to the group. */
interface ItineraryPostedEvent {
  type: 'itinerary_posted'
  actor: string
  groupMessageId: string
  now: string
}

/** A quote was posted or updated (used across multiple stages). */
interface QuotePostedEvent {
  type: 'quote_posted'
  actor: string
  groupMessageId: string
  now: string
}

/** Partner or Eric replied with notes about the current quote. */
interface PartnerQuoteReplyEvent {
  type: 'partner_quote_reply'
  actor: string
  text: string
  now: string
}

/** Customer added Eric's personal LINE. */
interface AddedEricEvent {
  type: 'added_eric'
  actor: string
  now: string
}

/** Deal confirmed — Eric or partner recorded conversion. */
interface ConvertedEvent {
  type: 'converted'
  actor: string
  now: string
}

/** Case marked as lost with an optional reason code. */
interface LostEvent {
  type: 'lost'
  actor: string
  reason?: string
  now: string
}

/** No meaningful movement for the retention window — mark idle. */
interface IdleTimeoutEvent {
  type: 'idle_timeout'
  now: string
}

export type CaseEvent =
  | LineOAMessageEvent
  | NeedsInfoEvent
  | ReadyForItineraryEvent
  | ItineraryPostedEvent
  | QuotePostedEvent
  | PartnerQuoteReplyEvent
  | AddedEricEvent
  | ConvertedEvent
  | LostEvent
  | IdleTimeoutEvent

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export interface ReducerResult {
  case: AgentCase
  audit: AuditEntry[]
}

/**
 * Pure reducer: applies a single event to a case and returns the updated
 * case + an updated audit log.
 *
 * @param current   The current case state (never mutated).
 * @param event     The event to apply.
 * @param prevAudit The existing audit entries (never mutated).
 * @returns         A new { case, audit } with the transition applied.
 * @throws {CaseUserMismatchError} if event.lineUserId != case.lineUserId
 *         (for line_oa_message events only — other events are operator/system).
 */
export function caseReducer(
  current: AgentCase,
  event: CaseEvent,
  prevAudit: AuditEntry[]
): ReducerResult {
  // ── Guard: user identity check for customer-originated events ─────────────
  if (event.type === 'line_oa_message') {
    if (event.lineUserId !== current.lineUserId) {
      throw new CaseUserMismatchError(
        current.lineUserId,
        event.lineUserId,
        current.caseId
      )
    }
  }

  // ── Terminal cases: return unchanged for most events ─────────────────────
  if (TERMINAL_STATUSES.has(current.status)) {
    // Terminal cases accept further audit recording but stay in their status.
    // Only add an audit if there's something noteworthy (we log the attempt).
    const entry = makeAuditEntry(
      current.caseId,
      current.status,
      current.status,
      event.type,
      event.now,
      'actor' in event ? event.actor : 'system'
    )
    return {
      case: { ...current },
      audit: [...prevAudit, entry],
    }
  }

  // ── Compute next state ────────────────────────────────────────────────────
  let nextStatus: CaseStatus = current.status
  let caseUpdates: Partial<AgentCase> = {}

  switch (event.type) {
    // -- LINE OA customer message -------------------------------------------
    case 'line_oa_message': {
      // If customer replies while we're waiting for info, treat it as new
      // info arrival → reset to new_inquiry for partner review.
      nextStatus =
        current.status === 'needs_info' ? 'new_inquiry' : current.status
      caseUpdates = { lastCustomerMessageAt: event.now }
      break
    }

    // -- Needs info (partner) -----------------------------------------------
    case 'needs_info': {
      nextStatus = 'needs_info'
      caseUpdates = {
        missingFields: event.missingFields,
      }
      break
    }

    // -- Ready for itinerary -------------------------------------------------
    case 'ready_for_itinerary': {
      nextStatus = 'ready_for_itinerary'
      break
    }

    // -- Itinerary posted ----------------------------------------------------
    case 'itinerary_posted': {
      nextStatus = 'itinerary_review'
      caseUpdates = {
        lastGroupDiscussionAt: event.now,
        linkedGroupMessageIds: [
          ...current.linkedGroupMessageIds,
          event.groupMessageId,
        ],
      }
      break
    }

    // -- Quote posted (multi-stage) -----------------------------------------
    case 'quote_posted': {
      // Advance through the quote stages:
      // itinerary_review → ready_for_quote → quote_review → quoted_tracking
      const quoteStageMap: Partial<Record<CaseStatus, CaseStatus>> = {
        itinerary_review: 'ready_for_quote',
        ready_for_quote: 'quote_review',
        quote_review: 'quoted_tracking',
      }
      nextStatus = quoteStageMap[current.status] ?? current.status
      caseUpdates = {
        lastGroupDiscussionAt: event.now,
        linkedGroupMessageIds: [
          ...current.linkedGroupMessageIds,
          event.groupMessageId,
        ],
      }
      break
    }

    // -- Partner quote reply ------------------------------------------------
    case 'partner_quote_reply': {
      // Status stays the same — this is just a comment/note.
      nextStatus = current.status
      caseUpdates = { lastGroupDiscussionAt: event.now }
      break
    }

    // -- Customer added Eric ------------------------------------------------
    case 'added_eric': {
      nextStatus = 'added_eric'
      break
    }

    // -- Converted ----------------------------------------------------------
    case 'converted': {
      nextStatus = 'converted'
      break
    }

    // -- Lost ---------------------------------------------------------------
    case 'lost': {
      nextStatus = 'lost'
      caseUpdates = { lostReason: event.reason }
      break
    }

    // -- Idle timeout -------------------------------------------------------
    case 'idle_timeout': {
      nextStatus = 'idle'
      break
    }
  }

  // ── Build next case (immutable) ───────────────────────────────────────────
  const nextCase: AgentCase = {
    ...current,
    ...caseUpdates,
    status: nextStatus,
  }

  // ── Append audit entry ────────────────────────────────────────────────────
  const actor = 'actor' in event ? (event as { actor?: string }).actor : 'system'
  const entry = makeAuditEntry(
    current.caseId,
    current.status,
    nextStatus,
    event.type,
    event.now,
    actor
  )

  return {
    case: nextCase,
    audit: [...prevAudit, entry],
  }
}

// ---------------------------------------------------------------------------
// findDuplicateCandidate — duplicate detection using LINE user ID + time window
// ---------------------------------------------------------------------------

export interface DuplicateCheckInput {
  /** LINE user ID of the incoming inquiry. */
  lineUserId: string
  /** Display name from LINE (used for fuzzy checks but NOT the primary key). */
  displayName: string
  /** ISO-8601 timestamp of the incoming message. */
  now: string
}

/**
 * Check whether an incoming inquiry matches an existing open case.
 *
 * Rules (in priority order):
 * 1. Same lineUserId AND lastCustomerMessageAt is within `windowMs` → duplicate.
 * 2. Different lineUserId → always a distinct case, even if displayNames match.
 * 3. Terminal cases (converted/lost) are excluded from duplicate candidates.
 *
 * Returns the matching case if a duplicate is found, otherwise null.
 */
export function findDuplicateCandidate(
  input: DuplicateCheckInput,
  existingCases: AgentCase[],
  windowMs: number
): AgentCase | null {
  const nowMs = new Date(input.now).getTime()

  for (const c of existingCases) {
    // Skip terminal cases — they're complete records, not active candidates.
    if (TERMINAL_STATUSES.has(c.status)) continue

    // Primary key: LINE user ID must match exactly.
    if (c.lineUserId !== input.lineUserId) continue

    // Time window: lastCustomerMessageAt must be within the window.
    const lastMs = new Date(c.lastCustomerMessageAt).getTime()
    if (nowMs - lastMs <= windowMs) {
      return c
    }
  }

  return null
}
