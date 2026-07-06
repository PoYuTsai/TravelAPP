/**
 * Tests for the partner-group reply gate predicate (tagged-reply plan §3).
 *
 * `shouldReplyToPartnerGroup(event, decision, botDirected)` is a PURE boolean —
 * no I/O. All seven conditions must be true to send; flipping any single one to
 * false yields `false`. Condition 3 now reads the runtime-derived `botDirected`
 * (tag OR quote-to-bot), not `event.mentionsBot`. These tests pin that truth
 * table so the send gate (webhook runtime) can rely on the predicate as the
 * single authority for "may reply".
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
  it('returns true when all seven conditions are satisfied', () => {
    expect(shouldReplyToPartnerGroup(passingEvent(), passingDecision(), true)).toBe(true)
  })

  it('condition 3 now reads botDirected, not mentionsBot', () => {
    // mentionsBot:false but botDirected=true (quote-to-bot) → reply; the same
    // event with botDirected=false → no reply. The gate no longer consults
    // event.mentionsBot for condition 3.
    const ev = passingEvent({ mentionsBot: false })
    expect(shouldReplyToPartnerGroup(ev, passingDecision(), true)).toBe(true)
    expect(shouldReplyToPartnerGroup(ev, passingDecision(), false)).toBe(false)
  })

  it('returns false when decision.source is not line_partner_group', () => {
    expect(
      shouldReplyToPartnerGroup(passingEvent(), passingDecision({ source: 'line_oa' }), true)
    ).toBe(false)
  })

  it('returns false when event.sourceChannel is line_oa even if mentionsBot is wrongly true (defense in depth)', () => {
    // Simulate an UPSTREAM bug: an OA event arrives with mentionsBot:true and a
    // partner-group decision. The pure gate is the last send line of defense and
    // must NOT rely on the normalizer alone — it independently checks the event
    // source. This must never reach a customer.
    expect(
      shouldReplyToPartnerGroup(
        passingEvent({ sourceChannel: 'line_oa', mentionsBot: true }),
        passingDecision(),
        true
      )
    ).toBe(false)
  })

  it('returns false when botDirected is false', () => {
    expect(
      shouldReplyToPartnerGroup(passingEvent(), passingDecision(), false)
    ).toBe(false)
  })

  it('returns false when decision.action is not respond', () => {
    expect(
      shouldReplyToPartnerGroup(passingEvent(), passingDecision({ action: 'silent' }), true)
    ).toBe(false)
  })

  it('returns false when decision.denied is true', () => {
    expect(
      shouldReplyToPartnerGroup(
        passingEvent(),
        passingDecision({ action: 'denied', denied: true }),
        true
      )
    ).toBe(false)
  })

  it('returns false when outboundText is missing', () => {
    expect(
      shouldReplyToPartnerGroup(
        passingEvent(),
        passingDecision({
          handlerResult: { handler: 'h', status: 'stub_ok' },
        }),
        true
      )
    ).toBe(false)
  })

  it('returns false when outboundText is an empty/whitespace string', () => {
    expect(
      shouldReplyToPartnerGroup(
        passingEvent(),
        passingDecision({
          handlerResult: { handler: 'h', status: 'stub_ok', outboundText: '   ' },
        }),
        true
      )
    ).toBe(false)
  })

  it('returns false when handlerResult is absent', () => {
    expect(
      shouldReplyToPartnerGroup(passingEvent(), passingDecision({ handlerResult: undefined }), true)
    ).toBe(false)
  })

  it('returns false when event.replyToken is missing', () => {
    expect(
      shouldReplyToPartnerGroup(passingEvent({ replyToken: undefined }), passingDecision(), true)
    ).toBe(false)
  })

  it('returns false when event.replyToken is an empty string', () => {
    expect(
      shouldReplyToPartnerGroup(passingEvent({ replyToken: '' }), passingDecision(), true)
    ).toBe(false)
  })
})
