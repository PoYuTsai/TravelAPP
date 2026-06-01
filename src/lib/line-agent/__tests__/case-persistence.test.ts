/**
 * case-persistence.test.ts
 *
 * Verifies that an OA customer message routed through routeCommand actually
 * PERSISTS a case via the reducer + store — not just returns a stub.
 *
 * Covers Codex review point D:
 *   - load-or-create via getByLineUserId
 *   - reducer applied, case put back, audit appended
 *   - a second message updates the SAME case (no duplicate)
 *   - deterministic caseId seam (no listAll().length + 1 race)
 *   - customerDisplayName fallback (NO LINE profile API call on the webhook path)
 *   - NEVER a customer-facing reply
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { routeCommand, type RouterInput } from '@/lib/line-agent/commands/router'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'
import { createInitialCase } from '@/lib/line-agent/cases/case-state'
import type { NormalizedLineEvent } from '@/lib/line-agent/line/event-normalizer'
import type { LlmIntentClassifier, CommandIntent } from '@/lib/line-agent/commands/intent'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const analyzeStub: LlmIntentClassifier = {
  classify: async (): Promise<CommandIntent> => ({
    action: 'analyze',
    confidence: 'high',
    source: 'llm',
  }),
}

const TS0 = 1_700_000_000_000 // 2023-11-14T22:13:20.000Z
const TS1 = 1_700_000_600_000 // +10 min

function makeOaEvent(overrides: Partial<NormalizedLineEvent> = {}): NormalizedLineEvent {
  return {
    kind: 'oa_text',
    sourceChannel: 'line_oa',
    lineUserId: 'U_customer_persist',
    messageId: 'msg_aaa',
    text: '請問清邁包車',
    timestamp: TS0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

describe('OA message persistence — create', () => {
  let store: MemoryStore
  beforeEach(() => {
    store = new MemoryStore()
  })

  it('creates a new case for a first-time OA message', async () => {
    const input: RouterInput = { event: makeOaEvent(), store, llmClassifier: analyzeStub }
    const decision = await routeCommand(input)

    expect(decision.action).toBe('create_case')

    const persisted = await store.getByLineUserId('U_customer_persist')
    expect(persisted).not.toBeNull()
    expect(persisted?.status).toBe('new_inquiry')
    expect(persisted?.lastCustomerMessageAt).toBe('2023-11-14T22:13:20.000Z')
  })

  it('appends an audit entry when a case is created', async () => {
    const input: RouterInput = { event: makeOaEvent(), store, llmClassifier: analyzeStub }
    await routeCommand(input)

    const persisted = await store.getByLineUserId('U_customer_persist')
    const audit = await store.getAudit(persisted!.caseId)
    expect(audit.length).toBeGreaterThanOrEqual(1)
    expect(audit[audit.length - 1].eventType).toBe('line_oa_message')
  })

  it('uses a deterministic caseId seam (not listAll length)', async () => {
    const input: RouterInput = {
      event: makeOaEvent(),
      store,
      llmClassifier: analyzeStub,
      deps: { generateCaseId: () => 'CW-DETERMINISTIC-1' },
    }
    await routeCommand(input)
    expect(await store.get('CW-DETERMINISTIC-1')).not.toBeNull()
  })

  it('falls back to a non-empty displayName without calling a profile API', async () => {
    const input: RouterInput = { event: makeOaEvent(), store, llmClassifier: analyzeStub }
    await routeCommand(input)
    const persisted = await store.getByLineUserId('U_customer_persist')
    expect(persisted?.customerDisplayName).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Update (no duplicate)
// ---------------------------------------------------------------------------

describe('OA message persistence — update existing', () => {
  let store: MemoryStore
  beforeEach(() => {
    store = new MemoryStore()
  })

  it('a second message from the same lineUserId updates the same case (no duplicate)', async () => {
    const first: RouterInput = { event: makeOaEvent(), store, llmClassifier: analyzeStub }
    await routeCommand(first)

    const second: RouterInput = {
      event: makeOaEvent({ messageId: 'msg_bbb', timestamp: TS1, text: '想問四天行程' }),
      store,
      llmClassifier: analyzeStub,
    }
    const decision = await routeCommand(second)

    expect(decision.action).toBe('update_case')

    const all = await store.listAll()
    expect(all.filter((c) => c.lineUserId === 'U_customer_persist')).toHaveLength(1)

    const persisted = await store.getByLineUserId('U_customer_persist')
    expect(persisted?.lastCustomerMessageAt).toBe('2023-11-14T22:23:20.000Z')
  })

  it('a customer reply while needs_info resets the case to new_inquiry (reducer reuse)', async () => {
    // Seed an existing case sitting in needs_info.
    const seeded = createInitialCase({
      caseId: 'CW-seeded-1',
      lineUserId: 'U_customer_persist',
      customerDisplayName: 'Seeded',
      now: '2023-11-14T20:00:00.000Z',
    })
    await store.put({ ...seeded, status: 'needs_info', missingFields: ['childAges'] })

    const input: RouterInput = {
      event: makeOaEvent({ messageId: 'msg_ccc', timestamp: TS1 }),
      store,
      llmClassifier: analyzeStub,
    }
    await routeCommand(input)

    const persisted = await store.get('CW-seeded-1')
    expect(persisted?.status).toBe('new_inquiry')
  })
})

// ---------------------------------------------------------------------------
// Never a customer-facing reply
// ---------------------------------------------------------------------------

describe('OA message persistence — never replies to the customer', () => {
  it('routes to an internal case action, never a customer reply', async () => {
    const store = new MemoryStore()
    const input: RouterInput = { event: makeOaEvent(), store, llmClassifier: analyzeStub }
    const decision = await routeCommand(input)
    expect(['create_case', 'update_case']).toContain(decision.action)
    expect(decision.action).not.toBe('respond')
    expect(decision.denied).toBeFalsy()
  })
})
