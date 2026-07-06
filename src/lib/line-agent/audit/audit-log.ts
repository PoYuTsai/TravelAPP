/**
 * Audit log types and helpers for the LINE OA agent.
 *
 * Audit entries are append-only records of state transitions.
 * They record: which case, from/to status, which event caused it,
 * which actor triggered it, and the timestamp (always injected —
 * never generated internally so entries remain deterministic and testable).
 */

import type { CaseStatus } from '../cases/case-state'

// ---------------------------------------------------------------------------
// AuditEntry — one record per state transition
// ---------------------------------------------------------------------------

export interface AuditEntry {
  /** The case this entry belongs to. */
  caseId: string

  /** The status BEFORE the transition. */
  from: CaseStatus

  /** The status AFTER the transition. */
  to: CaseStatus

  /** The event type that triggered this transition. */
  eventType: string

  /**
   * Who or what triggered the event.
   * "partner" = partner group member, "eric" = Eric,
   * "system" = automated/timeout, "unknown" = unidentified.
   */
  actor?: string

  /**
   * ISO-8601 timestamp for when the transition occurred.
   * ALWAYS injected from outside — never call Date.now() here.
   */
  timestamp: string
}

// ---------------------------------------------------------------------------
// Helper to build a new AuditEntry
// ---------------------------------------------------------------------------

export function makeAuditEntry(
  caseId: string,
  from: CaseStatus,
  to: CaseStatus,
  eventType: string,
  timestamp: string,
  actor?: string
): AuditEntry {
  return { caseId, from, to, eventType, actor, timestamp }
}
