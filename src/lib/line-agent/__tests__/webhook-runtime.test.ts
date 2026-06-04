/**
 * Tests for the webhook runtime seams (tagged-reply plan Task 3 + Task 4).
 *
 * Task 3 — partner-group responder seam:
 *   - setPartnerGroupResponder injects a fake the default handler then uses
 *     when routing a partner-group tagged event through routeCommand.
 *   - the un-injected resolver lazily defaults to the safe stub (no API call).
 *
 * Task 4 — reply client seam + send gate (the core cut):
 *   The default handler keeps the RouterDecision and, ONLY when the pure reply
 *   gate (shouldReplyToPartnerGroup) is satisfied, sends via an injected reply
 *   client. Every assertion below uses a fake reply client + fake responder, so
 *   there is zero real LINE / LLM / network I/O and zero real key.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  getEventHandler,
  getPartnerGroupResponder,
  setPartnerGroupResponder,
  getReplyClient,
  setReplyClient,
  type ReplyClient,
} from '../line/webhook-runtime'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'
import { LineApiError, type LineMessage } from '../line/message-client'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { PartnerGroupResponder } from '../partner-group/responder'

// Capture the pristine lazy defaults BEFORE any injection so afterEach can
// restore them — the seams are module singletons and would otherwise leak.
const pristineResponder = getPartnerGroupResponder()
const pristineReplyClient = getReplyClient()

afterEach(() => {
  setPartnerGroupResponder(pristineResponder)
  setReplyClient(pristineReplyClient)
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function taggedPartnerGroupEvent(
  overrides: Partial<NormalizedLineEvent> = {}
): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M001',
    text: '@bot 請幫我確認',
    mentionsBot: true,
    timestamp: 1_700_000_000_000,
    replyToken: 'reply_token_xyz',
    ...overrides,
  }
}

function oaEvent(overrides: Partial<NormalizedLineEvent> = {}): NormalizedLineEvent {
  return {
    kind: 'oa_text',
    sourceChannel: 'line_oa',
    lineUserId: 'U_customer',
    messageId: 'M_oa_001',
    text: 'hi',
    mentionsBot: false,
    timestamp: 1_700_000_000_000,
    replyToken: 'oa_reply_token',
    ...overrides,
  }
}

/** A reply client that records every call instead of hitting LINE. */
function recordingReplyClient(): {
  client: ReplyClient
  calls: Array<{ replyToken: string; messages: LineMessage[] }>
} {
  const calls: Array<{ replyToken: string; messages: LineMessage[] }> = []
  const client: ReplyClient = async (replyToken, messages) => {
    calls.push({ replyToken, messages })
  }
  return { client, calls }
}

/** A responder that always returns the given text (no API call). */
function fixedResponder(text: string): PartnerGroupResponder {
  return {
    async respond() {
      return { text, meta: { responder: 'llm' as const } }
    },
  }
}

// ---------------------------------------------------------------------------
// Task 3 — responder seam
// ---------------------------------------------------------------------------

describe('webhook-runtime partner-group responder seam', () => {
  it('routes a partner-group tagged event through the injected responder', async () => {
    let calls = 0
    const fake: PartnerGroupResponder = {
      async respond() {
        calls += 1
        return { text: 'FAKE-RESPONDER-TEXT', meta: { responder: 'llm' as const } }
      },
    }
    setPartnerGroupResponder(fake)
    setReplyClient(recordingReplyClient().client)

    await getEventHandler()(taggedPartnerGroupEvent(), new MemoryStore())

    expect(calls).toBe(1)
  })

  it('lazily defaults to the safe stub responder when none is injected', async () => {
    const result = await getPartnerGroupResponder().respond({
      event: taggedPartnerGroupEvent(),
      intent: { action: 'analyze', confidence: 'high', source: 'deterministic' },
      text: '@bot 請幫我確認',
    })
    expect(result.meta?.responder).toBe('stub')
  })
})

// ---------------------------------------------------------------------------
// Task 4 — reply client seam + send gate
// ---------------------------------------------------------------------------

describe('webhook-runtime partner-group send gate', () => {
  it('replies exactly once to a partner-group tagged event with the responder text', async () => {
    setPartnerGroupResponder(fixedResponder('FAKE-REPLY'))
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    await getEventHandler()(taggedPartnerGroupEvent(), new MemoryStore())

    expect(calls).toHaveLength(1)
    expect(calls[0].replyToken).toBe('reply_token_xyz')
    expect(calls[0].messages).toEqual([{ type: 'text', text: 'FAKE-REPLY' }])
  })

  it('does not reply to a partner-group message that does not mention the bot', async () => {
    setPartnerGroupResponder(fixedResponder('FAKE-REPLY'))
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    await getEventHandler()(
      taggedPartnerGroupEvent({ mentionsBot: false, text: '今天天氣不錯' }),
      new MemoryStore()
    )

    expect(calls).toHaveLength(0)
  })

  it('never replies to an OA customer event, even one containing a literal "@bot"', async () => {
    let responderCalls = 0
    setPartnerGroupResponder({
      async respond() {
        responderCalls += 1
        return { text: 'SHOULD-NOT-SEND', meta: { responder: 'llm' as const } }
      },
    })
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    await getEventHandler()(oaEvent({ text: '@bot 在嗎' }), new MemoryStore())

    expect(responderCalls).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it('does not reply to a denied dev command from the partner group', async () => {
    setPartnerGroupResponder(fixedResponder('FAKE-REPLY'))
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    // "deploy" matches the deterministic dev-action pattern → router denies it
    // BEFORE the tag gate, regardless of the @bot mention.
    await getEventHandler()(
      taggedPartnerGroupEvent({ text: '@bot deploy the site' }),
      new MemoryStore()
    )

    expect(calls).toHaveLength(0)
  })

  it('skips the reply (with a warning) when a respond decision has no replyToken', async () => {
    setPartnerGroupResponder(fixedResponder('FAKE-REPLY'))
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await getEventHandler()(
      taggedPartnerGroupEvent({ replyToken: undefined }),
      new MemoryStore()
    )

    expect(calls).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalled()
  })

  it('does not invoke the real responder for a tagged event with no replyToken (no wasted model call)', async () => {
    // An event with no live reply token can NEVER be answered on LINE, so the
    // (potentially billed) responder must not run just to be discarded by the
    // gate. The handler still routes + warns, but with the stub — not this fake.
    let responderCalls = 0
    setPartnerGroupResponder({
      async respond() {
        responderCalls += 1
        return { text: 'SHOULD-NOT-RUN', meta: { responder: 'llm' as const } }
      },
    })
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await getEventHandler()(
      taggedPartnerGroupEvent({ replyToken: undefined }),
      new MemoryStore()
    )

    expect(responderCalls).toBe(0)
    expect(calls).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalled()
  })

  it('suppresses a reply failure: no throw, keeps the webhook ack, logs a readable error', async () => {
    setPartnerGroupResponder(fixedResponder('FAKE-REPLY'))
    setReplyClient(async () => {
      throw new LineApiError(
        429,
        'rate limited',
        'replyMessage failed with status 429: rate limited'
      )
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      getEventHandler()(taggedPartnerGroupEvent(), new MemoryStore())
    ).resolves.toBeUndefined()

    expect(errSpy).toHaveBeenCalled()
    // Non-minified: the readable status/message must reach the log.
    const logged = errSpy.mock.calls.flat().map(String).join(' ')
    expect(logged).toContain('429')
  })
})

// ---------------------------------------------------------------------------
// Task 5 — messageId send-once secondary guard
// ---------------------------------------------------------------------------

describe('webhook-runtime partner-group reply dedupe (messageId send-once)', () => {
  it('replies only once when the same partner-group messageId is redelivered', async () => {
    setPartnerGroupResponder(fixedResponder('FAKE-REPLY'))
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    // The SAME store must back both deliveries — the claim is store-backed so
    // it survives across the at-least-once redelivery (and, on KV, across
    // serverless instances).
    const store = new MemoryStore()
    const event = taggedPartnerGroupEvent({ messageId: 'M-dupe' })

    await getEventHandler()(event, store)
    await getEventHandler()(event, store) // LINE redelivers the identical event

    expect(calls).toHaveLength(1)
  })

  it('does not re-invoke the responder on a redelivered messageId (no re-bill)', async () => {
    let responderCalls = 0
    setPartnerGroupResponder({
      async respond() {
        responderCalls += 1
        return { text: 'FAKE-REPLY', meta: { responder: 'llm' as const } }
      },
    })
    setReplyClient(recordingReplyClient().client)

    const store = new MemoryStore()
    const event = taggedPartnerGroupEvent({ messageId: 'M-dupe-2' })

    await getEventHandler()(event, store)
    await getEventHandler()(event, store)

    // The claim is taken BEFORE the (billed) responder runs, so the second
    // delivery never reaches the model.
    expect(responderCalls).toBe(1)
  })

  it('never dedupes an empty messageId (each delivery is sent)', async () => {
    setPartnerGroupResponder(fixedResponder('FAKE-REPLY'))
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    const store = new MemoryStore()
    const event = taggedPartnerGroupEvent({ messageId: '' })

    await getEventHandler()(event, store)
    await getEventHandler()(event, store)

    // Mirrors the OA rule (handlers.ts:246): collapsing all id-less messages
    // into one claim would silently drop real replies.
    expect(calls).toHaveLength(2)
  })
})
