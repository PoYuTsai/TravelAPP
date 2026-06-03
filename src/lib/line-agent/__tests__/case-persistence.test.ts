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

  it('persists the raw OA message text inside the case for later summary', async () => {
    const input: RouterInput = {
      event: makeOaEvent({ text: '測試 webhook：2026/8/21' }),
      store,
      llmClassifier: analyzeStub,
    }
    await routeCommand(input)

    const persisted = await store.getByLineUserId('U_customer_persist')
    const messages = (persisted as {
      customerMessages?: Array<{
        messageId: string
        text: string
        receivedAt: string
        source: string
      }>
    } | null)?.customerMessages

    expect(messages).toEqual([
      {
        messageId: 'msg_aaa',
        text: '測試 webhook：2026/8/21',
        receivedAt: '2023-11-14T22:13:20.000Z',
        source: 'line_oa',
      },
    ])
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
// Idempotent redelivery (LINE at-least-once delivery)
// ---------------------------------------------------------------------------

describe('OA message persistence — idempotent redelivery', () => {
  let store: MemoryStore
  beforeEach(() => {
    store = new MemoryStore()
  })

  it('ignores a redelivered message with the same LINE messageId (no duplicate audit)', async () => {
    // First delivery — creates the case and appends one audit entry.
    await routeCommand({ event: makeOaEvent(), store, llmClassifier: analyzeStub })

    const persisted = await store.getByLineUserId('U_customer_persist')
    const auditAfterFirst = await store.getAudit(persisted!.caseId)
    expect(auditAfterFirst).toHaveLength(1)

    // LINE redelivers the EXACT same event (at-least-once) — must be a no-op.
    const decision = await routeCommand({
      event: makeOaEvent(),
      store,
      llmClassifier: analyzeStub,
    })

    expect(decision.action).toBe('silent')

    const auditAfterRedeliver = await store.getAudit(persisted!.caseId)
    expect(auditAfterRedeliver).toHaveLength(1) // unchanged — no duplicate audit

    const afterRedeliver = await store.getByLineUserId('U_customer_persist')
    expect(afterRedeliver?.customerMessages).toHaveLength(1)
  })

  it('keys dedup on messageId, not timestamp (a redelivery never bumps lastCustomerMessageAt)', async () => {
    await routeCommand({
      event: makeOaEvent({ timestamp: TS0 }),
      store,
      llmClassifier: analyzeStub,
    })

    // Same messageId, later timestamp — still a redelivery of the SAME message.
    await routeCommand({
      event: makeOaEvent({ timestamp: TS1 }),
      store,
      llmClassifier: analyzeStub,
    })

    const persisted = await store.getByLineUserId('U_customer_persist')
    expect(persisted?.lastCustomerMessageAt).toBe('2023-11-14T22:13:20.000Z') // TS0, not bumped
  })

  it('still processes a genuinely new messageId from the same user (not over-deduped)', async () => {
    await routeCommand({ event: makeOaEvent(), store, llmClassifier: analyzeStub })

    const persisted = await store.getByLineUserId('U_customer_persist')
    await routeCommand({
      event: makeOaEvent({ messageId: 'msg_distinct', timestamp: TS1, text: '想加一天' }),
      store,
      llmClassifier: analyzeStub,
    })

    const auditAfterSecond = await store.getAudit(persisted!.caseId)
    expect(auditAfterSecond).toHaveLength(2) // a distinct message DOES append
  })

  it('does not dedup when messageId is empty (missing id must never collapse messages)', async () => {
    await routeCommand({
      event: makeOaEvent({ messageId: '' }),
      store,
      llmClassifier: analyzeStub,
    })
    const persisted = await store.getByLineUserId('U_customer_persist')

    // A second id-less message must NOT be swallowed as a "duplicate empty id".
    const decision = await routeCommand({
      event: makeOaEvent({ messageId: '', timestamp: TS1 }),
      store,
      llmClassifier: analyzeStub,
    })

    expect(decision.action).toBe('update_case')
    const audit = await store.getAudit(persisted!.caseId)
    expect(audit).toHaveLength(2)
  })

  it('caps processedMessageIds at the 200 most recent (FIFO evicts oldest)', async () => {
    // Fold in 201 distinct messages from the same user — the dedup set must
    // stay bounded so a long-lived case never grows an unbounded KV value.
    for (let i = 0; i < 201; i++) {
      await routeCommand({
        event: makeOaEvent({ messageId: `msg_${i}`, timestamp: TS0 + i }),
        store,
        llmClassifier: analyzeStub,
      })
    }

    const persisted = await store.getByLineUserId('U_customer_persist')
    expect(persisted?.processedMessageIds).toHaveLength(200)
    // Oldest id (msg_0) is evicted FIFO; the most recent 200 are retained.
    expect(persisted?.processedMessageIds).not.toContain('msg_0')
    expect(persisted?.processedMessageIds[0]).toBe('msg_1')
    expect(persisted?.processedMessageIds.at(-1)).toBe('msg_200')
  })
})

// ---------------------------------------------------------------------------
// Customer-event classification stored at write-time (M2 Task 5A)
// ---------------------------------------------------------------------------

describe('OA message persistence — customer-event classification (write-time)', () => {
  let store: MemoryStore
  beforeEach(() => {
    store = new MemoryStore()
  })

  it('classifies a travel-intent first message as new_inquiry', async () => {
    await routeCommand({
      event: makeOaEvent({ text: '想帶小孩去清邁玩，有包車嗎' }),
      store,
      llmClassifier: analyzeStub,
    })

    const persisted = await store.getByLineUserId('U_customer_persist')
    expect(persisted?.latestEventCategory).toBe('new_inquiry')
    expect(persisted?.latestClassifiedAt).toBe('2023-11-14T22:13:20.000Z')
  })

  it('classifies an image event as media_or_ocr_needed (no text needed)', async () => {
    await routeCommand({
      event: makeOaEvent({ kind: 'image', text: undefined, messageId: 'img_1' }),
      store,
      llmClassifier: analyzeStub,
    })

    const persisted = await store.getByLineUserId('U_customer_persist')
    expect(persisted?.latestEventCategory).toBe('media_or_ocr_needed')
  })

  it('classification is advisory — it never changes routing away from the internal case action', async () => {
    const decision = await routeCommand({
      event: makeOaEvent({ text: '報價多少' }),
      store,
      llmClassifier: analyzeStub,
    })
    expect(['create_case', 'update_case']).toContain(decision.action)
    const persisted = await store.getByLineUserId('U_customer_persist')
    expect(persisted?.latestEventCategory).toBe('price_question')
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
