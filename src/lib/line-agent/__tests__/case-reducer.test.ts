/**
 * Tests for the case state machine reducer.
 *
 * All tests use injected timestamps (no Date.now() inside reducer).
 * The reducer must be PURE: same inputs → same outputs, no I/O, no mutations.
 */

import { describe, it, expect } from 'vitest'
import {
  type AgentCase,
  type CaseStatus,
  ALL_CASE_STATUSES,
  createInitialCase,
} from '../cases/case-state'
import {
  caseReducer,
  type CaseEvent,
  findDuplicateCandidate,
} from '../cases/case-reducer'
import type { AuditEntry } from '../audit/audit-log'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T0 = '2026-06-01T08:00:00.000Z'
const T1 = '2026-06-01T09:00:00.000Z'
const T2 = '2026-06-01T10:00:00.000Z'
const T3 = '2026-06-01T11:00:00.000Z'

function makeCase(overrides: Partial<AgentCase> = {}): AgentCase {
  return createInitialCase({
    caseId: 'CW-0601-001',
    lineUserId: 'Uaaa111',
    customerDisplayName: 'Alice',
    now: T0,
    ...overrides,
  })
}

function apply(
  c: AgentCase,
  event: CaseEvent,
  audit: AuditEntry[] = []
): { case: AgentCase; audit: AuditEntry[] } {
  return caseReducer(c, event, audit)
}

// ---------------------------------------------------------------------------
// Status union completeness
// ---------------------------------------------------------------------------

describe('ALL_CASE_STATUSES', () => {
  it('contains exactly the 12 required status strings', () => {
    const expected: CaseStatus[] = [
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
    expect(ALL_CASE_STATUSES).toHaveLength(12)
    for (const s of expected) {
      expect(ALL_CASE_STATUSES).toContain(s)
    }
  })
})

// ---------------------------------------------------------------------------
// createInitialCase
// ---------------------------------------------------------------------------

describe('createInitialCase', () => {
  it('creates a case with status new_inquiry and the provided fields', () => {
    const c = makeCase()
    expect(c.caseId).toBe('CW-0601-001')
    expect(c.lineUserId).toBe('Uaaa111')
    expect(c.customerDisplayName).toBe('Alice')
    expect(c.status).toBe('new_inquiry')
    expect(c.createdAt).toBe(T0)
    expect(c.lastCustomerMessageAt).toBe(T0)
  })
})

// ---------------------------------------------------------------------------
// Reducer — LINE OA message arrival
// ---------------------------------------------------------------------------

describe('caseReducer — line_oa_message event', () => {
  it('new_inquiry + line_oa_message → stays new_inquiry, updates lastCustomerMessageAt', () => {
    const c = makeCase()
    const event: CaseEvent = {
      type: 'line_oa_message',
      lineUserId: 'Uaaa111',
      text: 'Hello I want to book a trip',
      now: T1,
    }
    const { case: next, audit } = apply(c, event)
    expect(next.status).toBe('new_inquiry')
    expect(next.lastCustomerMessageAt).toBe(T1)
    expect(audit).toHaveLength(1)
    expect(audit[0].from).toBe('new_inquiry')
    expect(audit[0].to).toBe('new_inquiry')
  })

  it('needs_info + line_oa_message → transitions to new_inquiry (customer replied)', () => {
    const c = makeCase({ status: 'needs_info' })
    const event: CaseEvent = {
      type: 'line_oa_message',
      lineUserId: 'Uaaa111',
      text: 'We are 4 adults and 2 kids',
      now: T1,
    }
    const { case: next } = apply(c, event)
    expect(next.status).toBe('new_inquiry')
  })

  it('rejects event from a DIFFERENT LINE user id — never mixes customers', () => {
    const c = makeCase({ lineUserId: 'Uaaa111' })
    const event: CaseEvent = {
      type: 'line_oa_message',
      lineUserId: 'Ubbb999',  // DIFFERENT user!
      text: 'Hi I want a tour',
      now: T1,
    }
    expect(() => apply(c, event)).toThrow(/user.*mismatch|mismatch.*user|wrong.*user|user.*id/i)
  })
})

// ---------------------------------------------------------------------------
// Reducer — needs_info event (partner identified missing info)
// ---------------------------------------------------------------------------

describe('caseReducer — needs_info event', () => {
  it('new_inquiry + needs_info → status becomes needs_info', () => {
    const c = makeCase()
    const event: CaseEvent = {
      type: 'needs_info',
      actor: 'partner',
      missingFields: ['childAges', 'childSeat'],
      now: T1,
    }
    const { case: next, audit } = apply(c, event)
    expect(next.status).toBe('needs_info')
    expect(next.missingFields).toContain('childAges')
    expect(audit[0].from).toBe('new_inquiry')
    expect(audit[0].to).toBe('needs_info')
  })
})

// ---------------------------------------------------------------------------
// Reducer — ready_for_itinerary
// ---------------------------------------------------------------------------

describe('caseReducer — ready_for_itinerary event', () => {
  it('needs_info + ready_for_itinerary → status becomes ready_for_itinerary', () => {
    const c = makeCase({ status: 'needs_info' })
    const event: CaseEvent = {
      type: 'ready_for_itinerary',
      actor: 'partner',
      now: T1,
    }
    const { case: next } = apply(c, event)
    expect(next.status).toBe('ready_for_itinerary')
  })
})

// ---------------------------------------------------------------------------
// Reducer — itinerary_posted
// ---------------------------------------------------------------------------

describe('caseReducer — itinerary_posted event', () => {
  it('ready_for_itinerary + itinerary_posted → itinerary_in_progress then itinerary_review', () => {
    const c = makeCase({ status: 'ready_for_itinerary' })
    const postEvent: CaseEvent = {
      type: 'itinerary_posted',
      actor: 'partner',
      groupMessageId: 'msg-itin-001',
      now: T1,
    }
    const { case: next } = apply(c, postEvent)
    expect(next.status).toBe('itinerary_review')
  })

  it('itinerary_in_progress + itinerary_posted → itinerary_review', () => {
    const c = makeCase({ status: 'itinerary_in_progress' })
    const event: CaseEvent = {
      type: 'itinerary_posted',
      actor: 'partner',
      groupMessageId: 'msg-itin-002',
      now: T2,
    }
    const { case: next } = apply(c, event)
    expect(next.status).toBe('itinerary_review')
  })
})

// ---------------------------------------------------------------------------
// Reducer — quote_posted
// ---------------------------------------------------------------------------

describe('caseReducer — quote_posted event', () => {
  it('itinerary_review + quote_posted → ready_for_quote', () => {
    const c = makeCase({ status: 'itinerary_review' })
    const event: CaseEvent = {
      type: 'quote_posted',
      actor: 'partner',
      groupMessageId: 'msg-quote-001',
      now: T2,
    }
    const { case: next } = apply(c, event)
    expect(next.status).toBe('ready_for_quote')
  })

  it('ready_for_quote + quote_posted → quote_review', () => {
    const c = makeCase({ status: 'ready_for_quote' })
    const event: CaseEvent = {
      type: 'quote_posted',
      actor: 'partner',
      groupMessageId: 'msg-quote-002',
      now: T3,
    }
    const { case: next } = apply(c, event)
    expect(next.status).toBe('quote_review')
  })

  it('quote_review + quote_posted → quoted_tracking', () => {
    const c = makeCase({ status: 'quote_review' })
    const event: CaseEvent = {
      type: 'quote_posted',
      actor: 'partner',
      groupMessageId: 'msg-quote-003',
      now: T3,
    }
    const { case: next } = apply(c, event)
    expect(next.status).toBe('quoted_tracking')
  })
})

// ---------------------------------------------------------------------------
// Reducer — partner_quote_reply
// ---------------------------------------------------------------------------

describe('caseReducer — partner_quote_reply event', () => {
  it('quoted_tracking + partner_quote_reply → stays quoted_tracking, appends audit', () => {
    const c = makeCase({ status: 'quoted_tracking' })
    const event: CaseEvent = {
      type: 'partner_quote_reply',
      actor: 'partner',
      text: 'Customer is thinking it over',
      now: T2,
    }
    const { case: next, audit } = apply(c, event)
    expect(next.status).toBe('quoted_tracking')
    expect(audit).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Reducer — added_eric
// ---------------------------------------------------------------------------

describe('caseReducer — added_eric event', () => {
  it('quoted_tracking + added_eric → status becomes added_eric', () => {
    const c = makeCase({ status: 'quoted_tracking' })
    const event: CaseEvent = {
      type: 'added_eric',
      actor: 'partner',
      now: T2,
    }
    const { case: next, audit } = apply(c, event)
    expect(next.status).toBe('added_eric')
    expect(audit[0].from).toBe('quoted_tracking')
    expect(audit[0].to).toBe('added_eric')
  })
})

// ---------------------------------------------------------------------------
// Reducer — converted
// ---------------------------------------------------------------------------

describe('caseReducer — converted event', () => {
  it('added_eric + converted → status becomes converted', () => {
    const c = makeCase({ status: 'added_eric' })
    const event: CaseEvent = {
      type: 'converted',
      actor: 'eric',
      now: T3,
    }
    const { case: next } = apply(c, event)
    expect(next.status).toBe('converted')
  })

  it('converted case is terminal — applying another event returns unchanged status', () => {
    const c = makeCase({ status: 'converted' })
    const event: CaseEvent = {
      type: 'line_oa_message',
      lineUserId: 'Uaaa111',
      text: 'Follow up message',
      now: T3,
    }
    const { case: next } = apply(c, event)
    expect(next.status).toBe('converted')
  })
})

// ---------------------------------------------------------------------------
// Reducer — lost
// ---------------------------------------------------------------------------

describe('caseReducer — lost event', () => {
  it('any non-terminal status + lost → status becomes lost with reason', () => {
    const c = makeCase({ status: 'quoted_tracking' })
    const event: CaseEvent = {
      type: 'lost',
      actor: 'partner',
      reason: 'price',
      now: T2,
    }
    const { case: next, audit } = apply(c, event)
    expect(next.status).toBe('lost')
    expect(next.lostReason).toBe('price')
    expect(audit[0].from).toBe('quoted_tracking')
    expect(audit[0].to).toBe('lost')
  })
})

// ---------------------------------------------------------------------------
// Reducer — idle_timeout
// ---------------------------------------------------------------------------

describe('caseReducer — idle_timeout event', () => {
  it('any active status + idle_timeout → status becomes idle', () => {
    const statuses: CaseStatus[] = [
      'new_inquiry',
      'needs_info',
      'ready_for_itinerary',
      'itinerary_in_progress',
      'itinerary_review',
      'ready_for_quote',
      'quote_review',
      'quoted_tracking',
      'added_eric',
    ]
    for (const status of statuses) {
      const c = makeCase({ status })
      const event: CaseEvent = {
        type: 'idle_timeout',
        now: T3,
      }
      const { case: next } = apply(c, event)
      expect(next.status).toBe('idle')
    }
  })

  it('lost + idle_timeout → stays lost (terminal)', () => {
    const c = makeCase({ status: 'lost' })
    const event: CaseEvent = { type: 'idle_timeout', now: T3 }
    const { case: next } = apply(c, event)
    expect(next.status).toBe('lost')
  })

  it('converted + idle_timeout → stays converted (terminal)', () => {
    const c = makeCase({ status: 'converted' })
    const event: CaseEvent = { type: 'idle_timeout', now: T3 }
    const { case: next } = apply(c, event)
    expect(next.status).toBe('converted')
  })
})

// ---------------------------------------------------------------------------
// Audit log — timestamps injected, not generated inside reducer
// ---------------------------------------------------------------------------

describe('audit log timestamps', () => {
  it('audit entries use the timestamp injected via event.now, not internal Date.now()', () => {
    const c = makeCase()
    const event: CaseEvent = {
      type: 'needs_info',
      actor: 'partner',
      missingFields: ['childAges'],
      now: '2099-01-01T00:00:00.000Z',  // deliberately far future
    }
    const { audit } = apply(c, event)
    expect(audit[0].timestamp).toBe('2099-01-01T00:00:00.000Z')
  })

  it('each transition appends a new audit entry (does not mutate the input array)', () => {
    const c = makeCase()
    const originalAudit: AuditEntry[] = []
    const event: CaseEvent = {
      type: 'needs_info',
      actor: 'partner',
      missingFields: [],
      now: T1,
    }
    const { audit: newAudit } = apply(c, event, originalAudit)
    // input array must not be mutated
    expect(originalAudit).toHaveLength(0)
    // new array must have the entry
    expect(newAudit).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// CRITICAL INVARIANT: a case must NEVER mix two customers
// ---------------------------------------------------------------------------

describe('CRITICAL: no customer mixing invariant', () => {
  it('line_oa_message from wrong lineUserId throws — never silently merges', () => {
    const c = makeCase({ lineUserId: 'Ucustomer-A' })
    const event: CaseEvent = {
      type: 'line_oa_message',
      lineUserId: 'Ucustomer-B',  // DIFFERENT customer
      text: 'I want to book April 10-15',
      now: T1,
    }
    // Must throw — never silently accept the wrong user
    expect(() => caseReducer(c, event, [])).toThrow()
  })

  it('same lineUserId is allowed — correct customer is accepted', () => {
    const c = makeCase({ lineUserId: 'Ucustomer-A' })
    const event: CaseEvent = {
      type: 'line_oa_message',
      lineUserId: 'Ucustomer-A',  // SAME customer
      text: 'Follow-up question',
      now: T1,
    }
    // Must NOT throw
    expect(() => caseReducer(c, event, [])).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Reducer purity: no mutation of input case object
// ---------------------------------------------------------------------------

describe('reducer purity', () => {
  it('does not mutate the original case object', () => {
    const c = makeCase()
    const originalStatus = c.status
    const event: CaseEvent = {
      type: 'needs_info',
      actor: 'partner',
      missingFields: ['childAges'],
      now: T1,
    }
    apply(c, event)
    expect(c.status).toBe(originalStatus)  // must be unchanged
  })
})

// ---------------------------------------------------------------------------
// findDuplicateCandidate — duplicate detection
// ---------------------------------------------------------------------------

describe('findDuplicateCandidate', () => {
  const windowMs = 30 * 60 * 1000 // 30 minutes

  const existingCase = makeCase({
    lineUserId: 'Uaaa111',
    customerDisplayName: 'Alice Wang',
    lastCustomerMessageAt: T0,  // 08:00
  })

  it('same lineUserId within time window → duplicate detected', () => {
    // T0 = 08:00; 08:20 is 20 min later, well within the 30-min window
    const withinWindow = '2026-06-01T08:20:00.000Z'
    const result = findDuplicateCandidate(
      { lineUserId: 'Uaaa111', displayName: 'Alice Wang', now: withinWindow },
      [existingCase],
      windowMs
    )
    expect(result).not.toBeNull()
    expect(result?.caseId).toBe('CW-0601-001')
  })

  it('same lineUserId OUTSIDE time window → no duplicate (treated as new inquiry)', () => {
    const laterTime = '2026-06-01T22:00:00.000Z'  // >> 30min after T0
    const result = findDuplicateCandidate(
      { lineUserId: 'Uaaa111', displayName: 'Alice Wang', now: laterTime },
      [existingCase],
      windowMs
    )
    expect(result).toBeNull()
  })

  it('different lineUserId → distinct case, even if displayName matches', () => {
    // Name collision should NOT trigger duplicate if user IDs differ
    const result = findDuplicateCandidate(
      { lineUserId: 'Uother999', displayName: 'Alice Wang', now: T1 },
      [existingCase],
      windowMs
    )
    expect(result).toBeNull()
  })

  it('empty case list → no duplicate', () => {
    const result = findDuplicateCandidate(
      { lineUserId: 'Uaaa111', displayName: 'Alice Wang', now: T1 },
      [],
      windowMs
    )
    expect(result).toBeNull()
  })

  it('terminal cases (converted/lost) are not returned as duplicate candidates', () => {
    const convertedCase = makeCase({
      lineUserId: 'Uaaa111',
      status: 'converted',
      lastCustomerMessageAt: T0,
    })
    const result = findDuplicateCandidate(
      { lineUserId: 'Uaaa111', displayName: 'Alice Wang', now: T1 },
      [convertedCase],
      windowMs
    )
    expect(result).toBeNull()
  })
})
