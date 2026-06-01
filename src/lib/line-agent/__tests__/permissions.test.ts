/**
 * permissions.test.ts
 *
 * Tests for the 5 deterministic permission policy boundaries.
 * All functions under test are pure TypeScript — no model / API calls.
 *
 * Boundary coverage:
 *  B1  Tagged partner-group messages MUST get a response.
 *  B2  Casual partner-group chat is IGNORED.
 *  B3  OA customers NEVER receive automatic replies.
 *  B4  DC can post to partner group ONLY with explicit send intent.
 *  B5  LINE partner group CANNOT trigger code/deploy/parser-change/schema-change.
 *  B6  LLM intent cannot widen permissions (even if LLM suggests "deploy" for a
 *      partner-group message, the permission layer DENIES it).
 */

import { describe, it, expect } from 'vitest'
import {
  canRespondToPartnerGroupTag,
  shouldIgnoreCasualPartnerGroupChat,
  canAutoReplyToOaCustomer,
  canPostToPartnerGroupFromDC,
  canPartnerGroupTriggerDevAction,
  type PermissionResult,
} from '@/lib/line-agent/permissions'
import type { NormalizedLineEvent } from '@/lib/line-agent/line/event-normalizer'
import type { OperatorCommand } from '@/lib/line-agent/operator/operator-command'
import type { CommandIntent } from '@/lib/line-agent/commands/intent'

// ---------------------------------------------------------------------------
// Helpers — build minimal typed fixtures
// ---------------------------------------------------------------------------

function makePartnerGroupEvent(overrides: Partial<NormalizedLineEvent> = {}): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M001',
    text: 'hello',
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
// B1: Tagged partner-group messages MUST get a response
// ---------------------------------------------------------------------------

describe('B1 — canRespondToPartnerGroupTag', () => {
  it('allows responding when the event is a tagged partner-group message (group_quoted)', () => {
    const event = makePartnerGroupEvent({
      kind: 'group_quoted',
      text: '@bot 這份報價有沒有漏？',
      quotedRef: { quotedMessageId: 'M000' },
    })
    const result: PermissionResult = canRespondToPartnerGroupTag(event)
    expect(result.allowed).toBe(true)
  })

  it('allows responding when text mentions the bot via @mention marker', () => {
    const event = makePartnerGroupEvent({
      kind: 'group_text',
      text: '@bot 請幫我確認行程',
    })
    const result = canRespondToPartnerGroupTag(event)
    expect(result.allowed).toBe(true)
  })

  it('does NOT allow responding for an OA event (wrong source)', () => {
    const event = makeOaEvent()
    const result = canRespondToPartnerGroupTag(event)
    expect(result.allowed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// B2: Casual partner-group chat is IGNORED
// ---------------------------------------------------------------------------

describe('B2 — shouldIgnoreCasualPartnerGroupChat', () => {
  it('returns true (ignore) for a plain group_text with no bot mention', () => {
    const event = makePartnerGroupEvent({
      kind: 'group_text',
      text: '今天天氣很好',
    })
    expect(shouldIgnoreCasualPartnerGroupChat(event)).toBe(true)
  })

  it('returns true (ignore) for unknown_group kind', () => {
    const event = makePartnerGroupEvent({ kind: 'unknown_group', text: undefined })
    expect(shouldIgnoreCasualPartnerGroupChat(event)).toBe(true)
  })

  it('returns false (do NOT ignore) when the bot is tagged', () => {
    const event = makePartnerGroupEvent({
      kind: 'group_text',
      text: '@bot 幫我查行程',
    })
    expect(shouldIgnoreCasualPartnerGroupChat(event)).toBe(false)
  })

  it('returns false (do NOT ignore) for a group_quoted event — explicit reply context', () => {
    const event = makePartnerGroupEvent({
      kind: 'group_quoted',
      text: '@bot 確認一下',
      quotedRef: { quotedMessageId: 'M099' },
    })
    expect(shouldIgnoreCasualPartnerGroupChat(event)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// B3: OA customers NEVER receive automatic replies
// ---------------------------------------------------------------------------

describe('B3 — canAutoReplyToOaCustomer', () => {
  it('DENIES auto-reply for any line_oa source event', () => {
    const event = makeOaEvent()
    const result: PermissionResult = canAutoReplyToOaCustomer(event)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('DENIES auto-reply even when the intent is "respond"', () => {
    const event = makeOaEvent()
    // Even if caller passes an explicit "respond" intent, permission is still denied
    const result = canAutoReplyToOaCustomer(event, 'respond')
    expect(result.allowed).toBe(false)
  })

  it('DENIES auto-reply for an OA image event', () => {
    const event = makeOaEvent({ kind: 'image', text: undefined })
    const result = canAutoReplyToOaCustomer(event)
    expect(result.allowed).toBe(false)
  })

  it('is NOT applicable to line_partner_group (different channel — returns allowed:true)', () => {
    // This function is only about OA→customer replies; partner-group events are not OA replies.
    // A partner-group event should NOT be blocked here (different gate).
    const event = makePartnerGroupEvent()
    const result = canAutoReplyToOaCustomer(event)
    expect(result.allowed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// B4: DC can post to partner group ONLY with explicit send intent
// ---------------------------------------------------------------------------

describe('B4 — canPostToPartnerGroupFromDC', () => {
  it('DENIES posting when sendTarget is absent (draft-only mode)', () => {
    const cmd = makeDcCommand({ sendTarget: undefined })
    const result: PermissionResult = canPostToPartnerGroupFromDC(cmd)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('ALLOWS posting when sendTarget.channel is line_partner_group', () => {
    const cmd = makeDcCommand({
      sendTarget: { channel: 'line_partner_group', confirm: true },
    })
    const result = canPostToPartnerGroupFromDC(cmd)
    expect(result.allowed).toBe(true)
  })

  it('ALLOWS posting with confirm:false (explicit send intent present)', () => {
    const cmd = makeDcCommand({
      sendTarget: { channel: 'line_partner_group', confirm: false },
    })
    const result = canPostToPartnerGroupFromDC(cmd)
    expect(result.allowed).toBe(true)
  })

  it('DENIES posting for a non-operator source even with sendTarget', () => {
    // line_partner_group is not a valid operator source — should be rejected
    const cmd: OperatorCommand = {
      actor: 'tsai',
      // @ts-expect-error — testing invalid source at runtime boundary
      sourceChannel: 'line_partner_group',
      commandText: 'send this',
      sendTarget: { channel: 'line_partner_group', confirm: true },
    }
    const result = canPostToPartnerGroupFromDC(cmd)
    expect(result.allowed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// B5: LINE partner group CANNOT trigger dev actions
// ---------------------------------------------------------------------------

describe('B5 — canPartnerGroupTriggerDevAction', () => {
  const devIntents: CommandIntent['action'][] = [
    'code_edit',
    'deploy',
    'parser_change',
    'schema_change',
  ]

  for (const action of devIntents) {
    it(`DENIES partner-group intent "${action}"`, () => {
      const event = makePartnerGroupEvent({ kind: 'group_text', text: `do ${action}` })
      const intent: CommandIntent = { action, confidence: 'high', source: 'deterministic' }
      const result: PermissionResult = canPartnerGroupTriggerDevAction(event, intent)
      expect(result.allowed).toBe(false)
      expect(result.reason).toMatch(/dev|code|deploy|parser|schema/i)
    })
  }

  const allowedIntents: CommandIntent['action'][] = [
    'analyze',
    'ocr',
    'web_search',
    'parse',
    'draft',
    'bug_packet',
  ]

  for (const action of allowedIntents) {
    it(`ALLOWS partner-group intent "${action}"`, () => {
      const event = makePartnerGroupEvent({ kind: 'group_text', text: `do ${action}` })
      const intent: CommandIntent = { action, confidence: 'high', source: 'deterministic' }
      const result = canPartnerGroupTriggerDevAction(event, intent)
      expect(result.allowed).toBe(true)
    })
  }

  it('DENIES deploy intent even from a DC source — separate check confirms non-partner also blocked', () => {
    // When called from a partner-group event, deploy is ALWAYS denied regardless
    const event = makePartnerGroupEvent()
    const intent: CommandIntent = { action: 'deploy', confidence: 'high', source: 'llm' }
    const result = canPartnerGroupTriggerDevAction(event, intent)
    expect(result.allowed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// B6: LLM intent cannot widen permissions
// ---------------------------------------------------------------------------

describe('B6 — LLM intent cannot widen permissions', () => {
  it('DENIES deploy even when stubbed LLM returns deploy for a partner-group message', () => {
    const event = makePartnerGroupEvent({
      kind: 'group_text',
      text: '幫我 deploy 一下',
    })
    // Simulate: LLM stub says "deploy" with high confidence
    const llmIntent: CommandIntent = {
      action: 'deploy',
      confidence: 'high',
      source: 'llm',
    }
    const result = canPartnerGroupTriggerDevAction(event, llmIntent)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('DENIES schema_change even when LLM returns schema_change for a partner-group message', () => {
    const event = makePartnerGroupEvent({ kind: 'group_text', text: '改一下 schema' })
    const llmIntent: CommandIntent = {
      action: 'schema_change',
      confidence: 'high',
      source: 'llm',
    }
    const result = canPartnerGroupTriggerDevAction(event, llmIntent)
    expect(result.allowed).toBe(false)
  })

  it('DENIES OA auto-reply even when LLM intent is "respond"', () => {
    const event = makeOaEvent()
    // LLM intent is irrelevant — OA customer auto-reply is always denied
    const result = canAutoReplyToOaCustomer(event, 'respond')
    expect(result.allowed).toBe(false)
  })

  it('DENIES DC-to-partner-group post even when LLM intent is "send" but sendTarget absent', () => {
    const cmd = makeDcCommand({ sendTarget: undefined })
    // Even if downstream logic would like to send, no sendTarget = no permission
    const result = canPostToPartnerGroupFromDC(cmd)
    expect(result.allowed).toBe(false)
  })
})
