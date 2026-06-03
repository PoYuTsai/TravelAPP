/**
 * m2-guardrails.test.ts
 *
 * Cross-flow GUARDRAIL tests for the M2 customer-event layer (design §9 + §12,
 * UX doc §12).  These are NOT unit tests of "did the function compute X" — they
 * pin the four hard safety boundaries Eric named so a future refactor cannot
 * silently open a gate:
 *
 *   1. menu browsing 不提醒        — a browsing/postback case never produces a reminder.
 *   2. 客人自由文字零送出          — a customer OA message can only reach the receive-only
 *                                    create/update path; it can NEVER route to a send handler,
 *                                    and the auto-reply schema is dormant at the type level.
 *   3. low_context 不亂猜          — an ambiguous message falls back to new_inquiry/low (needs
 *                                    human); it never fabricates readiness/facts that would
 *                                    move the case into a ready/quote zone.
 *   4. send intent 不自動推群      — a reminder candidate only surfaces as an inbox flag; the
 *                                    ONLY path that posts to the partner group is an operator
 *                                    command carrying an explicit sendTarget.
 *
 * Most positive assertions live in the per-module tests; here we assert the
 * negatives at the seams that actually matter (router dispatch + schema).
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { routeCommand, type RouterInput, type RouterDecision } from '@/lib/line-agent/commands/router'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'
import { handleListRecentCases, type CaseSummary } from '@/lib/line-agent/commands/handlers'
import { deriveReminderCandidate } from '@/lib/line-agent/cases/reminder'
import { resolveInboxZone } from '@/lib/line-agent/cases/inbox-zone'
import { safeDefaultCustomerClassifier } from '@/lib/line-agent/cases/customer-event'
import { DEFAULT_AUTO_REPLY_CONFIG } from '@/lib/line-agent/cases/auto-reply'
import type { NormalizedLineEvent } from '@/lib/line-agent/line/event-normalizer'
import type { OperatorCommand } from '@/lib/line-agent/operator/operator-command'
import type { LlmIntentClassifier, CommandIntent } from '@/lib/line-agent/commands/intent'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TS0 = 1_700_000_000_000 // 2023-11-14T22:13:20.000Z
const TS0_ISO = new Date(TS0).toISOString()
const FIVE_HOURS_LATER_ISO = new Date(TS0 + 5 * 3_600_000).toISOString()

/** Operator intent stub — we never want a real model in a guardrail test. */
const analyzeStub: LlmIntentClassifier = {
  classify: async (): Promise<CommandIntent> => ({
    action: 'analyze',
    confidence: 'high',
    source: 'llm',
  }),
}

function makeOaEvent(overrides: Partial<NormalizedLineEvent> = {}): NormalizedLineEvent {
  return {
    kind: 'oa_text',
    sourceChannel: 'line_oa',
    lineUserId: 'U_guardrail_customer',
    messageId: 'msg_guard_1',
    text: '請問清邁包車',
    timestamp: TS0,
    ...overrides,
  }
}

function makeDcCommand(overrides: Partial<OperatorCommand> = {}): OperatorCommand {
  return {
    actor: 'eric',
    sourceChannel: 'discord_private',
    commandText: '貼到夥伴群：這團 8/21 兩大兩小',
    ...overrides,
  }
}

/** Router actions that mean a message left the building toward a customer/group. */
const SEND_ACTIONS = new Set(['respond', 'post_to_partner_group'])

// ---------------------------------------------------------------------------
// Guardrail 1 — menu browsing 不提醒
// ---------------------------------------------------------------------------

describe('Guardrail 1 — menu browsing 不提醒', () => {
  it('menu_browsing never produces a reminder, at any age', () => {
    for (const hours of [0, 5, 30, 100, 1000]) {
      const r = deriveReminderCandidate({
        caseId: 'CW-browse',
        status: 'idle',
        latestEventCategory: 'menu_browsing',
        hasUnansweredQuestion: false,
        lastCustomerMessageAt: TS0_ISO,
        now: new Date(TS0 + hours * 3_600_000).toISOString(),
      })
      expect(r).toBeNull()
    }
  })

  it('menu_browsing is suppressed even when status alone would trigger one', () => {
    // status new_inquiry + aged > 4hr would normally fire new_inquiry_unhandled;
    // the browsing guard must win and return null.
    const r = deriveReminderCandidate({
      caseId: 'CW-browse-2',
      status: 'new_inquiry',
      latestEventCategory: 'menu_browsing',
      hasUnansweredQuestion: false,
      lastCustomerMessageAt: TS0_ISO,
      now: FIVE_HOURS_LATER_ISO,
    })
    expect(r).toBeNull()
  })

  it('menu_browsing lands in the browsing_idle zone (not need_reply)', () => {
    const zone = resolveInboxZone({
      status: 'idle',
      latestEventCategory: 'menu_browsing',
      hasUnansweredQuestion: false,
      isEscalation: false,
      newInquiryOverdue: false,
    })
    expect(zone).toBe('browsing_idle')
  })
})

// ---------------------------------------------------------------------------
// Guardrail 2 — 客人自由文字零送出
// ---------------------------------------------------------------------------

describe('Guardrail 2 — 客人自由文字零送出', () => {
  let store: MemoryStore
  beforeEach(() => {
    store = new MemoryStore()
  })

  it('a customer OA message routes to create/update only — never a send action', async () => {
    const decision: RouterDecision = await routeCommand({
      event: makeOaEvent(),
      store,
      llmClassifier: analyzeStub,
    })
    expect(['create_case', 'update_case']).toContain(decision.action)
    expect(SEND_ACTIONS.has(decision.action)).toBe(false)
    expect(decision.denied).toBeFalsy()
    expect(decision.handlerResult?.handler).toBe('handleCreateOrUpdateCase')
  })

  it('no customer text — question, change, media — can reach a send handler', async () => {
    // Texts that look like they "want an answer" must STILL never auto-reply.
    const provocations: Array<Partial<NormalizedLineEvent>> = [
      { text: '報價多少？', messageId: 'g_price' },
      { text: '改成 8/22 出發', messageId: 'g_change' },
      { text: '在嗎', messageId: 'g_lowctx' },
      { kind: 'image', text: '', messageId: 'g_img' },
    ]
    for (const override of provocations) {
      const freshStore = new MemoryStore()
      const decision = await routeCommand({
        event: makeOaEvent({ lineUserId: `U_${override.messageId}`, ...override }),
        store: freshStore,
        llmClassifier: analyzeStub,
      })
      expect(SEND_ACTIONS.has(decision.action)).toBe(false)
    }
  })

  it('the auto-reply schema is dormant at the type level (kill-switch + every mapping)', () => {
    expect(DEFAULT_AUTO_REPLY_CONFIG.autoReplyEnabled).toBe(false)
    expect(DEFAULT_AUTO_REPLY_CONFIG.mappings.length).toBeGreaterThan(0)
    for (const mapping of DEFAULT_AUTO_REPLY_CONFIG.mappings) {
      expect(mapping.enabled).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Guardrail 3 — low_context 不亂猜
// ---------------------------------------------------------------------------

describe('Guardrail 3 — low_context 不亂猜', () => {
  it('ambiguous text falls back to new_inquiry/low (needs human), with no fabricated signals', async () => {
    const r = await safeDefaultCustomerClassifier.classify({
      text: '在嗎',
      messageType: 'text',
      isPostback: false,
      hasPriorMessages: false,
      missingFields: [],
      now: TS0_ISO,
    })
    expect(r.category).toBe('new_inquiry')
    expect(r.confidence).toBe('low')
    expect(r.source).toBe('llm')
    expect(r.signals).toEqual([]) // no invented evidence
  })

  it('a low-context new_inquiry never lands in a ready/quote zone', () => {
    // The conservative fallback must surface for a human (need_reply), never be
    // mistaken for a case that is ready to itinerary/quote.
    const zone = resolveInboxZone({
      status: 'new_inquiry',
      latestEventCategory: 'new_inquiry',
      hasUnansweredQuestion: false,
      isEscalation: false,
      newInquiryOverdue: false,
    })
    expect(zone).toBe('need_reply')
    expect(['ready_itinerary', 'quote_review', 'quoted_tracking']).not.toContain(zone)
  })

  it('a brand-new low-context case invents no urgency (no reminder at age 0)', () => {
    const r = deriveReminderCandidate({
      caseId: 'CW-lowctx',
      status: 'new_inquiry',
      latestEventCategory: 'new_inquiry',
      hasUnansweredQuestion: false,
      lastCustomerMessageAt: TS0_ISO,
      now: TS0_ISO,
    })
    expect(r).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Guardrail 4 — send intent 不自動推群
// ---------------------------------------------------------------------------

describe('Guardrail 4 — send intent 不自動推群', () => {
  let store: MemoryStore
  beforeEach(() => {
    store = new MemoryStore()
  })

  it('an aged case surfaces a reminder via a READ-ONLY list handler — no send', async () => {
    // Persist a real case through the receive-only path...
    await routeCommand({ event: makeOaEvent(), store, llmClassifier: analyzeStub })

    // ...then read the inbox 5h later: a reminder appears but the handler that
    // produced it is the read-only list handler, which structurally cannot push.
    const result = await handleListRecentCases(store, { now: FIVE_HOURS_LATER_ISO })
    expect(result.handler).toBe('handleListRecentCases')

    const cases = (result.meta as { cases: CaseSummary[] }).cases
    const summary = cases.find((c) => c.caseId.startsWith('CW-'))
    expect(summary).toBeDefined()
    expect(summary?.reminder?.reason).toBe('new_inquiry_unhandled')
    // The reminder carries an operator suggestion, never an auto-send instruction.
    expect(typeof summary?.reminder?.suggestedAction).toBe('string')
  })

  it('posting to the partner group requires an explicit sendTarget — not a reminder', async () => {
    const withTarget = await routeCommand({
      command: makeDcCommand({ sendTarget: { channel: 'line_partner_group', confirm: true } }),
      store,
      llmClassifier: analyzeStub,
    })
    expect(withTarget.action).toBe('post_to_partner_group')

    const withoutTarget = await routeCommand({
      command: makeDcCommand({ sendTarget: undefined }),
      store,
      llmClassifier: analyzeStub,
    })
    expect(withoutTarget.action).toBe('draft')
    expect(withoutTarget.action).not.toBe('post_to_partner_group')
  })
})
