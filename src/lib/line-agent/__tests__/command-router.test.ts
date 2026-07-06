/**
 * command-router.test.ts
 *
 * End-to-end routing tests.  The router is tested with a STUB LLM intent
 * classifier injected via the seam — no real model calls in tests.
 *
 * Test matrix:
 *  R1  Tagged partner-group message → respond action
 *  R2  Casual partner-group chat → silent / no-op action
 *  R3  OA customer message → NEVER customer reply (internal case event only)
 *  R4  DC command without sendTarget → no partner-group post (draft only)
 *  R5  DC command WITH sendTarget → posting to partner group ALLOWED
 *  R6  Partner-group message with deploy/parser-change intent → DENIED
 *  R7  LLM returns "deploy" for partner-group message → permission denies it
 */

import { describe, it, expect } from 'vitest'
import { routeCommand, type RouterInput, type RouterDecision } from '@/lib/line-agent/commands/router'
import type { NormalizedLineEvent } from '@/lib/line-agent/line/event-normalizer'
import type { OperatorCommand } from '@/lib/line-agent/operator/operator-command'
import type { LlmIntentClassifier, CommandIntent } from '@/lib/line-agent/commands/intent'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'

// ---------------------------------------------------------------------------
// Stub LLM intent classifiers
// ---------------------------------------------------------------------------

/** Stub that always returns "analyze" (safe default) */
const analyzeStub: LlmIntentClassifier = {
  classify: async (_text: string): Promise<CommandIntent> => ({
    action: 'analyze',
    confidence: 'high',
    source: 'llm',
  }),
}

/** Stub that always returns "deploy" (adversarial — tests permission gating) */
const deployStub: LlmIntentClassifier = {
  classify: async (_text: string): Promise<CommandIntent> => ({
    action: 'deploy',
    confidence: 'high',
    source: 'llm',
  }),
}

/** Stub that always returns "draft" */
const draftStub: LlmIntentClassifier = {
  classify: async (_text: string): Promise<CommandIntent> => ({
    action: 'draft',
    confidence: 'high',
    source: 'llm',
  }),
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makePartnerGroupEvent(overrides: Partial<NormalizedLineEvent> = {}): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M001',
    text: 'hello',
    mentionsBot: false,
    timestamp: 1_700_000_000_000,
    ...overrides,
  }
}

function makeOaEvent(overrides: Partial<NormalizedLineEvent> = {}): NormalizedLineEvent {
  return {
    kind: 'oa_text',
    sourceChannel: 'line_oa',
    lineUserId: 'U_customer',
    messageId: 'M002',
    text: 'I want to book a tour',
    mentionsBot: false,
    timestamp: 1_700_000_000_000,
    ...overrides,
  }
}

function makeDcCommand(overrides: Partial<OperatorCommand> = {}): OperatorCommand {
  return {
    actor: 'eric',
    sourceChannel: 'discord_private',
    commandText: 'summarise case',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// R1: Tagged partner-group message → respond action
// ---------------------------------------------------------------------------

describe('R1 — mentioned partner-group message → respond', () => {
  it('routes a mentioned group_quoted event to a respond action', async () => {
    const input: RouterInput = {
      event: makePartnerGroupEvent({
        kind: 'group_quoted',
        text: '@bot 這份報價有沒有漏？',
        quotedRef: { quotedMessageId: 'M000' },
        mentionsBot: true,
      }),
      llmClassifier: analyzeStub,
    }
    const decision: RouterDecision = await routeCommand(input)
    expect(decision.action).toBe('respond')
    expect(decision.source).toBe('line_partner_group')
    expect(decision.denied).toBeFalsy()
  })

  it('routes a mentioned group_text event to a respond action', async () => {
    const input: RouterInput = {
      event: makePartnerGroupEvent({
        kind: 'group_text',
        text: '@bot 請幫我確認',
        mentionsBot: true,
      }),
      llmClassifier: analyzeStub,
    }
    const decision = await routeCommand(input)
    expect(decision.action).toBe('respond')
    expect(decision.denied).toBeFalsy()
  })

  it('BEHAVIOR CHANGE: a group_quoted reply WITHOUT mention is silent (not respond)', async () => {
    const input: RouterInput = {
      event: makePartnerGroupEvent({
        kind: 'group_quoted',
        text: '這份報價有沒有漏？',
        quotedRef: { quotedMessageId: 'M000' },
        mentionsBot: false,
      }),
      llmClassifier: analyzeStub,
    }
    const decision = await routeCommand(input)
    expect(decision.action).toBe('silent')
  })

  it('a respond decision carries the safe stub outboundText by default', async () => {
    const input: RouterInput = {
      event: makePartnerGroupEvent({
        kind: 'group_text',
        text: '@bot 請幫我確認',
        mentionsBot: true,
      }),
      llmClassifier: analyzeStub,
    }
    const decision = await routeCommand(input)
    expect(decision.action).toBe('respond')
    expect(decision.handlerResult?.outboundText).toContain('收到，我先記下來')
  })

  it('uses an injected partnerGroupResponder when provided', async () => {
    const input: RouterInput = {
      event: makePartnerGroupEvent({
        kind: 'group_text',
        text: '@bot 請幫我確認',
        mentionsBot: true,
      }),
      llmClassifier: analyzeStub,
      partnerGroupResponder: {
        async respond() {
          return { text: 'INJECTED-ROUTER-TEXT', meta: { responder: 'llm' as const } }
        },
      },
    }
    const decision = await routeCommand(input)
    expect(decision.handlerResult?.outboundText).toBe('INJECTED-ROUTER-TEXT')
  })
})

// ---------------------------------------------------------------------------
// R2: Casual partner-group chat → silent / no-op
// ---------------------------------------------------------------------------

describe('R2 — casual partner-group chat → silent', () => {
  it('routes a plain group_text (no bot mention) to a silent action', async () => {
    const input: RouterInput = {
      event: makePartnerGroupEvent({ kind: 'group_text', text: '今天天氣很好' }),
      llmClassifier: analyzeStub,
    }
    const decision = await routeCommand(input)
    expect(decision.action).toBe('silent')
  })

  it('routes an unknown_group event to a silent action', async () => {
    const input: RouterInput = {
      event: makePartnerGroupEvent({ kind: 'unknown_group', text: undefined }),
      llmClassifier: analyzeStub,
    }
    const decision = await routeCommand(input)
    expect(decision.action).toBe('silent')
  })
})

// ---------------------------------------------------------------------------
// R3: OA customer message → NEVER customer reply
// ---------------------------------------------------------------------------

describe('R3 — OA customer message → never auto-reply to customer', () => {
  it('does NOT produce a reply action for line_oa source', async () => {
    const input: RouterInput = {
      event: makeOaEvent(),
      store: new MemoryStore(),
      llmClassifier: analyzeStub,
    }
    const decision = await routeCommand(input)
    expect(decision.action).not.toBe('reply_to_customer')
    // It should produce an internal case action, not a customer reply
    expect(['create_case', 'update_case', 'internal_case_event', 'silent']).toContain(
      decision.action
    )
  })

  it('does NOT produce a reply action for an OA image event', async () => {
    const input: RouterInput = {
      event: makeOaEvent({ kind: 'image', text: undefined }),
      store: new MemoryStore(),
      llmClassifier: analyzeStub,
    }
    const decision = await routeCommand(input)
    expect(decision.action).not.toBe('reply_to_customer')
  })
})

// ---------------------------------------------------------------------------
// R4: DC command WITHOUT sendTarget → no partner-group post (draft only)
// ---------------------------------------------------------------------------

describe('R4 — DC command without sendTarget → draft only', () => {
  it('produces a draft action (not a post) when sendTarget is absent', async () => {
    const input: RouterInput = {
      command: makeDcCommand({ sendTarget: undefined }),
      llmClassifier: draftStub,
    }
    const decision = await routeCommand(input)
    expect(decision.action).toBe('draft')
    expect(decision.denied).toBeFalsy()
    // Must NOT be "post_to_partner_group"
    expect(decision.action).not.toBe('post_to_partner_group')
  })
})

// ---------------------------------------------------------------------------
// R4b: DC list cases command → operator-only case summary
// ---------------------------------------------------------------------------

describe('R4b — DC command can list recent unprocessed OA cases', () => {
  it('returns recent active cases with the latest customer message text', async () => {
    const store = new MemoryStore()

    await routeCommand({
      event: makeOaEvent({
        lineUserId: 'U_customer_A',
        messageId: 'msg_customer_A',
        text: '測試 webhook：2026/8/21',
        timestamp: 1_700_000_000_000,
      }),
      store,
      llmClassifier: analyzeStub,
    })
    await routeCommand({
      event: makeOaEvent({
        lineUserId: 'U_customer_B',
        messageId: 'msg_customer_B',
        text: '想問清邁親子包車 2大1小',
        timestamp: 1_700_000_600_000,
      }),
      store,
      llmClassifier: analyzeStub,
    })

    const decision = await routeCommand({
      command: makeDcCommand({
        commandText: '列出最近未處理客人',
        sendTarget: undefined,
      }),
      store,
      llmClassifier: draftStub,
    })

    expect(decision.action).toBe('list_cases')
    expect(decision.handlerResult?.handler).toBe('handleListRecentCases')
    // Both active cases are listed (M2 orders within-zone by SLA urgency, not
    // pure recency, so assert membership rather than a brittle exact order —
    // ordering itself is covered by inbox-zone / inbox-enrich tests).
    const listed = decision.handlerResult?.meta?.cases as Array<{ caseId: string }>
    expect(listed).toHaveLength(2)
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          caseId: 'CW-msg_customer_B',
          status: 'new_inquiry',
          latestCustomerMessageText: '想問清邁親子包車 2大1小',
        }),
        expect.objectContaining({
          caseId: 'CW-msg_customer_A',
          status: 'new_inquiry',
          latestCustomerMessageText: '測試 webhook：2026/8/21',
        }),
      ])
    )
    expect(JSON.stringify(decision.handlerResult?.meta)).not.toContain('U_customer_')
  })

  it('summarises customer needs and derives obvious missing fields for operator triage', async () => {
    const store = new MemoryStore()

    await routeCommand({
      event: makeOaEvent({
        lineUserId: 'U_family_case',
        messageId: 'msg_family_smoke',
        text: '正式站測試 2026/6/3',
        timestamp: 1_699_999_000_000,
      }),
      store,
      llmClassifier: analyzeStub,
    })
    await routeCommand({
      event: makeOaEvent({
        lineUserId: 'U_family_case',
        messageId: 'msg_family_1',
        text: '你好，我們8/21到清邁，2大2小，想包車4天，想去大象跟夜間動物園',
        timestamp: 1_700_000_000_000,
      }),
      store,
      llmClassifier: analyzeStub,
    })
    await routeCommand({
      event: makeOaEvent({
        lineUserId: 'U_family_case',
        messageId: 'msg_family_2',
        text: '小孩一個5歲一個8歲，需要兒童座椅嗎？',
        timestamp: 1_700_000_600_000,
      }),
      store,
      llmClassifier: analyzeStub,
    })

    const decision = await routeCommand({
      command: makeDcCommand({
        commandText: 'inbox',
        sendTarget: undefined,
      }),
      store,
      llmClassifier: draftStub,
    })

    const cases = decision.handlerResult?.meta?.cases as Array<{
      triage?: {
        summaryText: string
        knownFacts: Record<string, unknown>
        missingFields: string[]
      }
      missingFields: string[]
    }>
    const familyCase = cases[0]

    expect(familyCase.triage?.summaryText).toContain('8/21')
    expect(familyCase.triage?.summaryText).toContain('2大2小')
    expect(familyCase.triage?.summaryText).toContain('包車4天')
    expect(familyCase.triage?.summaryText).toContain('大象、夜間動物園')
    expect(familyCase.triage?.knownFacts).toMatchObject({
      travelDate: '8/21',
      adults: 2,
      children: 2,
      childAges: [5, 8],
      charterDays: 4,
      interests: ['大象', '夜間動物園'],
    })
    expect(familyCase.triage?.missingFields).toEqual([
      'childSeatNeeds',
      'flightOrPickupInfo',
      'hotelOrPickupLocation',
    ])
    expect(familyCase.missingFields).toEqual(familyCase.triage?.missingFields)
  })
})

// ---------------------------------------------------------------------------
// R5: DC command WITH sendTarget → posting to partner group ALLOWED
// ---------------------------------------------------------------------------

describe('R5 — DC command with sendTarget → post to partner group allowed', () => {
  it('produces a post_to_partner_group action when sendTarget is set', async () => {
    const input: RouterInput = {
      command: makeDcCommand({
        commandText: 'cc 把這段整理後發到 LINE 夥伴群',
        sendTarget: { channel: 'line_partner_group', confirm: true },
      }),
      llmClassifier: analyzeStub,
    }
    const decision = await routeCommand(input)
    expect(decision.action).toBe('post_to_partner_group')
    expect(decision.denied).toBeFalsy()
  })
})

// ---------------------------------------------------------------------------
// R6: Partner-group dev/deploy/parser-change intent → DENIED
// ---------------------------------------------------------------------------

describe('R6 — partner-group dev actions are denied', () => {
  const devCommandTexts = [
    { text: 'deploy the site', expectedAction: 'deploy' },
    { text: 'change parser logic', expectedAction: 'parser_change' },
    { text: 'edit the code', expectedAction: 'code_edit' },
    { text: 'modify sanity schema', expectedAction: 'schema_change' },
  ]

  for (const { text, expectedAction } of devCommandTexts) {
    it(`DENIES "${text}" from partner group (intent: ${expectedAction})`, async () => {
      // Use a stub that returns the specific dev intent
      const devIntentStub: LlmIntentClassifier = {
        classify: async (): Promise<CommandIntent> => ({
          action: expectedAction as CommandIntent['action'],
          confidence: 'high',
          source: 'llm',
        }),
      }
      const input: RouterInput = {
        event: makePartnerGroupEvent({ kind: 'group_text', text }),
        llmClassifier: devIntentStub,
      }
      const decision = await routeCommand(input)
      expect(decision.denied).toBe(true)
      expect(decision.denialReason).toBeDefined()
    })
  }
})

// ---------------------------------------------------------------------------
// R7: LLM returns "deploy" for partner-group → permission DENIES it
// ---------------------------------------------------------------------------

describe('R7 — LLM cannot widen permissions', () => {
  it('DENIES deploy even when the injected LLM stub returns deploy for a partner-group tagged message', async () => {
    const input: RouterInput = {
      // Tagged message — would normally produce a respond action
      event: makePartnerGroupEvent({
        kind: 'group_quoted',
        text: '@bot 幫我 deploy',
        quotedRef: { quotedMessageId: 'M001' },
      }),
      // Adversarial stub: LLM says deploy
      llmClassifier: deployStub,
    }
    const decision = await routeCommand(input)
    expect(decision.denied).toBe(true)
    expect(decision.denialReason).toBeDefined()
    // Must never produce a deploy action for a partner-group source
    expect(decision.action).not.toBe('deploy')
  })

  it('DENIES schema_change even when LLM stub returns schema_change', async () => {
    const schemaChangeStub: LlmIntentClassifier = {
      classify: async (): Promise<CommandIntent> => ({
        action: 'schema_change',
        confidence: 'high',
        source: 'llm',
      }),
    }
    const input: RouterInput = {
      event: makePartnerGroupEvent({ kind: 'group_text', text: '@bot 改 schema' }),
      llmClassifier: schemaChangeStub,
    }
    const decision = await routeCommand(input)
    expect(decision.denied).toBe(true)
  })
})
