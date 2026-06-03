/**
 * Tests for the partner-group reply gate predicate (tagged-reply plan §3).
 *
 * `shouldReplyToPartnerGroup(event, decision)` is a PURE boolean — no I/O. All
 * six conditions must be true to send; flipping any single one to false yields
 * `false`. These tests pin that truth table so the send gate (webhook runtime)
 * can rely on the predicate as the single authority for "may reply".
 */

import { describe, it, expect } from 'vitest'
import { shouldReplyToPartnerGroup } from '../line/partner-reply-gate'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { RouterDecision } from '../commands/router'

// ---------------------------------------------------------------------------
// Fixtures — a fully-passing (all six conditions true) event + decision pair.
// ---------------------------------------------------------------------------

function passingEvent(overrides?: Partial<NormalizedLineEvent>): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai_001',
    groupId: 'C_partner_group_001',
    messageId: 'msg_001',
    text: '@bot 幫我看一下',
    mentionsBot: true,
    timestamp: 1717200000000,
    replyToken: 'reply_token_abc',
    ...overrides,
  }
}

function passingDecision(overrides?: Partial<RouterDecision>): RouterDecision {
  return {
    action: 'respond',
    source: 'line_partner_group',
    denied: false,
    handlerResult: {
      handler: 'handleRespondToPartnerGroup',
      status: 'stub_ok',
      outboundText: '收到，我先記下來。',
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('shouldReplyToPartnerGroup', () => {
  it('returns true when all six conditions are satisfied', () => {
    expect(shouldReplyToPartnerGroup(passingEvent(), passingDecision())).toBe(true)
  })

  it('returns false when decision.source is not line_partner_group', () => {
    expect(
      shouldReplyToPartnerGroup(passingEvent(), passingDecision({ source: 'line_oa' }))
    ).toBe(false)
  })

  it('returns false when event.mentionsBot is false', () => {
    expect(
      shouldReplyToPartnerGroup(passingEvent({ mentionsBot: false }), passingDecision())
    ).toBe(false)
  })

  it('returns false when decision.action is not respond', () => {
    expect(
      shouldReplyToPartnerGroup(passingEvent(), passingDecision({ action: 'silent' }))
    ).toBe(false)
  })

  it('returns false when decision.denied is true', () => {
    expect(
      shouldReplyToPartnerGroup(
        passingEvent(),
        passingDecision({ action: 'denied', denied: true })
      )
    ).toBe(false)
  })

  it('returns false when outboundText is missing', () => {
    expect(
      shouldReplyToPartnerGroup(
        passingEvent(),
        passingDecision({
          handlerResult: { handler: 'h', status: 'stub_ok' },
        })
      )
    ).toBe(false)
  })

  it('returns false when outboundText is an empty/whitespace string', () => {
    expect(
      shouldReplyToPartnerGroup(
        passingEvent(),
        passingDecision({
          handlerResult: { handler: 'h', status: 'stub_ok', outboundText: '   ' },
        })
      )
    ).toBe(false)
  })

  it('returns false when handlerResult is absent', () => {
    expect(
      shouldReplyToPartnerGroup(passingEvent(), passingDecision({ handlerResult: undefined }))
    ).toBe(false)
  })

  it('returns false when event.replyToken is missing', () => {
    expect(
      shouldReplyToPartnerGroup(passingEvent({ replyToken: undefined }), passingDecision())
    ).toBe(false)
  })

  it('returns false when event.replyToken is an empty string', () => {
    expect(
      shouldReplyToPartnerGroup(passingEvent({ replyToken: '' }), passingDecision())
    ).toBe(false)
  })
})
