/**
 * inbox-enrich.test.ts
 *
 * Read-path enrichment (M2 Task 5B): `handleListRecentCases` must derive an
 * inbox `zone`, a `reminder` candidate and surface the stored `eventCategory`
 * on every `CaseSummary` — all as plain serialisable values that can cross the
 * HTTP boundary to `scripts/agent-command.mjs`.
 *
 * `now` is injected so zone/reminder math is deterministic.
 *
 * Includes the mixed "補資料 + 問行程" guard Codex asked for: a follow-up that
 * also carries an itinerary question must NOT be silenced into browsing_idle
 * nor misfiled into awaiting_customer — it stays in need_reply.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  handleListRecentCases,
  type CaseSummary,
} from '@/lib/line-agent/commands/handlers'
import { routeCommand } from '@/lib/line-agent/commands/router'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'
import { createInitialCase, type AgentCase } from '@/lib/line-agent/cases/case-state'
import type { CustomerMessage } from '@/lib/line-agent/cases/case-state'
import type { LlmIntentClassifier, CommandIntent } from '@/lib/line-agent/commands/intent'

const analyzeStub: LlmIntentClassifier = {
  classify: async (): Promise<CommandIntent> => ({
    action: 'analyze',
    confidence: 'high',
    source: 'llm',
  }),
}

const NOW = '2026-06-03T12:00:00.000Z'

function msg(text: string, receivedAt: string): CustomerMessage {
  return { messageId: `m-${receivedAt}`, text, receivedAt, source: 'line_oa' }
}

function seed(store: MemoryStore, over: Partial<AgentCase>): Promise<void> {
  const c = createInitialCase({
    caseId: over.caseId ?? 'CW-seed',
    lineUserId: over.lineUserId ?? `U-${over.caseId ?? 'seed'}`,
    customerDisplayName: over.customerDisplayName ?? '測試客',
    now: '2026-06-03T00:00:00.000Z',
  })
  return store.put({ ...c, ...over })
}

async function listSummaries(
  store: MemoryStore,
  now: string = NOW
): Promise<CaseSummary[]> {
  const result = await handleListRecentCases(store, { limit: 20, now })
  return (result.meta as { cases: CaseSummary[] }).cases
}

describe('handleListRecentCases — enriched CaseSummary contract', () => {
  let store: MemoryStore
  beforeEach(() => {
    store = new MemoryStore()
  })

  it('every summary carries serialisable zone / eventCategory / reminder fields', async () => {
    await seed(store, {
      caseId: 'CW-1',
      status: 'new_inquiry',
      latestEventCategory: 'price_question',
      customerMessages: [msg('報價1600是哪間？', '2026-06-03T11:00:00.000Z')],
      lastCustomerMessageAt: '2026-06-03T11:00:00.000Z',
    })

    const [summary] = await listSummaries(store)

    expect(summary.zone).toBeDefined()
    expect(typeof summary.zone).toBe('string')
    expect(
      typeof summary.eventCategory === 'string' || summary.eventCategory === undefined
    ).toBe(true)
    expect(summary.reminder === null || typeof summary.reminder.reason === 'string').toBe(
      true
    )
    // price_question → need_reply
    expect(summary.zone).toBe('need_reply')
    // serialisable: a JSON round-trip must not lose anything
    expect(JSON.parse(JSON.stringify(summary)).zone).toBe('need_reply')
  })

  it('a stale unanswered question produces an urgent reminder in need_reply', async () => {
    await seed(store, {
      caseId: 'CW-2',
      status: 'new_inquiry',
      latestEventCategory: 'product_or_itinerary_question',
      customerMessages: [msg('大象體驗含午餐嗎？', '2026-06-03T08:00:00.000Z')],
      lastCustomerMessageAt: '2026-06-03T08:00:00.000Z',
    })

    const [summary] = await listSummaries(store) // 4hr later

    expect(summary.zone).toBe('need_reply')
    expect(summary.reminder?.reason).toBe('unanswered_question_overdue')
    expect(summary.reminder?.severity).toBe('urgent')
  })
})

describe('handleListRecentCases — follow-up info is never silenced or misfiled', () => {
  let store: MemoryStore
  beforeEach(() => {
    store = new MemoryStore()
  })

  it('a pure follow_up_info top-up lands in awaiting_customer (visible, not browsing)', async () => {
    await seed(store, {
      caseId: 'CW-followup',
      status: 'needs_info',
      latestEventCategory: 'follow_up_info',
      missingFields: ['childAges'],
      customerMessages: [msg('小孩一個5歲一個8歲', '2026-06-03T11:30:00.000Z')],
      lastCustomerMessageAt: '2026-06-03T11:30:00.000Z',
    })

    const [summary] = await listSummaries(store)

    expect(summary.zone).toBe('awaiting_customer')
    expect(summary.zone).not.toBe('browsing_idle') // not silenced
    expect(summary.eventCategory).toBe('follow_up_info')
  })

  it('mixed "補資料 + 問行程" message stays in need_reply (not muted, not awaiting_customer)', async () => {
    // Full write→read flow so the real classifier runs on the live text.
    await routeCommand({
      event: {
        kind: 'oa_text',
        sourceChannel: 'line_oa',
        lineUserId: 'U_mixed',
        messageId: 'mix_1',
        text: '8/21，2大2小，想去大象，夜間動物園排哪天',
        mentionsBot: false,
        timestamp: Date.parse('2026-06-03T11:00:00.000Z'),
      },
      store,
      llmClassifier: analyzeStub,
    })

    const summaries = await listSummaries(store)
    const mixed = summaries.find((s) => s.caseId === 'CW-mix_1')
    expect(mixed).toBeDefined()
    // Itinerary question wins → must reach a human, never silenced.
    expect(mixed?.eventCategory).toBe('product_or_itinerary_question')
    expect(mixed?.zone).toBe('need_reply')
    expect(mixed?.zone).not.toBe('browsing_idle')
    expect(mixed?.zone).not.toBe('awaiting_customer')
  })
})

describe('handleListRecentCases — urgency, not recency, survives the limit', () => {
  let store: MemoryStore
  beforeEach(() => {
    store = new MemoryStore()
  })

  it('keeps an old needs_eric case even when newer ordinary cases fill the limit', async () => {
    // 6 newer, ordinary cases.
    for (let i = 0; i < 6; i++) {
      const hh = String(10 + i).padStart(2, '0')
      await seed(store, {
        caseId: `CW-normal-${i}`,
        lineUserId: `U-normal-${i}`,
        status: 'new_inquiry',
        latestEventCategory: 'new_inquiry',
        customerMessages: [msg('想問清邁包車', `2026-06-03T${hh}:00:00.000Z`)],
        lastCustomerMessageAt: `2026-06-03T${hh}:00:00.000Z`,
      })
    }
    // 1 OLDER case that escalates (medical keyword → needs_eric).
    await seed(store, {
      caseId: 'CW-escalate',
      lineUserId: 'U-escalate',
      status: 'new_inquiry',
      latestEventCategory: 'new_inquiry',
      customerMessages: [msg('小孩會過敏，這樣可以去嗎', '2026-06-01T00:00:00.000Z')],
      lastCustomerMessageAt: '2026-06-01T00:00:00.000Z',
    })

    const result = await handleListRecentCases(store, { limit: 5, now: NOW })
    const cases = (result.meta as { cases: CaseSummary[] }).cases

    expect(cases).toHaveLength(5)
    const escalate = cases.find((c) => c.caseId === 'CW-escalate')
    expect(escalate).toBeDefined() // not dropped despite being the oldest
    expect(escalate?.zone).toBe('needs_eric')
    // needs_eric pins to the very top.
    expect(cases[0].caseId).toBe('CW-escalate')
  })
})

describe('handleListRecentCases — browsing never nags', () => {
  let store: MemoryStore
  beforeEach(() => {
    store = new MemoryStore()
  })

  it('a menu_browsing case lands in browsing_idle with no reminder, even when old', async () => {
    await seed(store, {
      caseId: 'CW-browse',
      status: 'idle',
      latestEventCategory: 'menu_browsing',
      customerMessages: [msg('（點選選單）', '2026-05-30T00:00:00.000Z')],
      lastCustomerMessageAt: '2026-05-30T00:00:00.000Z',
    })

    const [summary] = await listSummaries(store) // days later

    expect(summary.zone).toBe('browsing_idle')
    expect(summary.reminder).toBeNull()
  })
})
