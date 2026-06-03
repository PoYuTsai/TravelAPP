/**
 * partner-group-responder.test.ts
 *
 * The PartnerGroupResponder seam (design 2026-06-03 §B).  The responder ONLY
 * produces text — it never decides whether to send, never imports a LINE client,
 * and never reads a token/model key.  Swapping in a real LLM later is a new impl
 * of this interface; the handler/router/permission boundaries do not move.
 */

import { describe, it, expect } from 'vitest'
import {
  stubPartnerGroupResponder,
  type PartnerGroupRespondInput,
  type PartnerGroupResponder,
} from '@/lib/line-agent/partner-group/responder'
import { handleRespondToPartnerGroup } from '@/lib/line-agent/commands/handlers'
import type { NormalizedLineEvent } from '@/lib/line-agent/line/event-normalizer'
import type { CommandIntent } from '@/lib/line-agent/commands/intent'

function makeInput(overrides: Partial<PartnerGroupRespondInput> = {}): PartnerGroupRespondInput {
  const event: NormalizedLineEvent = {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M001',
    text: '@bot 幫我看一下',
    mentionsBot: true,
    timestamp: 1_700_000_000_000,
  }
  const intent: CommandIntent = { action: 'analyze', confidence: 'high', source: 'llm' }
  return { event, intent, text: '@bot 幫我看一下', ...overrides }
}

describe('stubPartnerGroupResponder', () => {
  it('returns the fixed safe stub text', async () => {
    const result = await stubPartnerGroupResponder.respond(makeInput())
    expect(result.text).toContain('收到，我先記下來')
    expect(result.text).toContain('請 Eric 再拍板')
  })

  it('tags the result meta as the stub responder (no model)', async () => {
    const result = await stubPartnerGroupResponder.respond(makeInput())
    expect(result.meta?.responder).toBe('stub')
    expect(result.meta?.model).toBeUndefined()
  })

  it('produces text with no emoji (design §B 文字定稿)', async () => {
    const result = await stubPartnerGroupResponder.respond(makeInput())
    // Emoji live in the astral planes → encoded as UTF-16 surrogate pairs.
    // No high-surrogate code unit ⇒ no emoji (avoids the /u unicode-property
    // regex flag, which this tsconfig target does not allow).
    expect(/[\uD800-\uDBFF]/.test(result.text)).toBe(false)
  })

  it('GUARDRAIL: the responder object exposes NO send/push/reply method', () => {
    for (const forbidden of ['send', 'push', 'reply', 'pushMessage', 'replyMessage', 'post']) {
      expect(
        (stubPartnerGroupResponder as unknown as Record<string, unknown>)[forbidden]
      ).toBeUndefined()
    }
    // The ONLY method on the seam is respond().
    expect(typeof stubPartnerGroupResponder.respond).toBe('function')
  })
})

describe('handleRespondToPartnerGroup — responder seam wiring (§C)', () => {
  function makeEvent(): NormalizedLineEvent {
    return {
      kind: 'group_text',
      sourceChannel: 'line_partner_group',
      lineUserId: 'U_tsai',
      groupId: 'G_partner',
      messageId: 'M001',
      text: '@bot 幫我看一下',
      mentionsBot: true,
      timestamp: 1_700_000_000_000,
    }
  }
  const intent: CommandIntent = { action: 'analyze', confidence: 'high', source: 'llm' }

  it('calls the injected responder and returns its text as outboundText', async () => {
    let called = 0
    let receivedInput: PartnerGroupRespondInput | undefined
    const fakeResponder: PartnerGroupResponder = {
      async respond(input) {
        called += 1
        receivedInput = input
        return { text: 'FAKE-RESPONDER-TEXT', meta: { responder: 'llm', model: 'fake-1' } }
      },
    }

    const result = await handleRespondToPartnerGroup(makeEvent(), intent, fakeResponder)

    expect(called).toBe(1)
    expect(receivedInput?.event.mentionsBot).toBe(true)
    expect(result.status).toBe('stub_ok')
    // outboundText is the FIXED field where the would-be reply lives (§C).
    expect(result.outboundText).toBe('FAKE-RESPONDER-TEXT')
    expect(result.meta?.responder).toEqual({ responder: 'llm', model: 'fake-1' })
  })

  it('defaults to the safe stub responder when none is injected', async () => {
    const result = await handleRespondToPartnerGroup(makeEvent(), intent)
    expect(result.outboundText).toContain('收到，我先記下來')
  })
})
