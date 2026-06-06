/**
 * partner-rag-webhook-wiring.test.ts — M3.2 webhook-runtime responder wiring
 * (design 2026-06-06-line-oa-m3-2-partner-rag-surfacing-design.md §6/§7).
 *
 * This slice wires `createPartnerGroupResponderWithRagDraft` into the existing
 * `getPartnerGroupResponder()` seam, keeping BOTH gates default off and using a
 * NOOP/not-wired production `answerSource` (no real Notion this knife). Tests
 * inject a fake `answerSource` via the new `setPartnerRagAnswerSource` seam.
 *
 * Hard boundaries asserted here:
 *  - gates off ⇒ base (stub) responder; answerSource call count === 0,
 *  - partner tag + explicit intent + both gates on ⇒ rag path (fake source),
 *  - partner tag WITHOUT explicit intent ⇒ base responder, source 0,
 *  - quote-to-bot + intent + gates on ⇒ rag path end-to-end (handler send gate),
 *  - OA event with a RAG keyword ⇒ no responder, no reply, source 0 (B3 ban),
 *  - untagged group message with a RAG keyword ⇒ no reply, source 0,
 *  - source throws ⇒ fail-closed unavailable reply, NEVER a fabricated draft,
 *  - sendTarget stays `post_to_partner_group` only when the router would send.
 *
 * Zero real LINE / Notion / LLM / network / key — fakes throughout.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  getEventHandler,
  getPartnerGroupResponder,
  setPartnerGroupResponder,
  getReplyClient,
  setReplyClient,
  getPartnerRagAnswerSource,
  setPartnerRagAnswerSource,
  type ReplyClient,
} from '../line/webhook-runtime'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'
import { PARTNER_RAG_UNAVAILABLE_REPLY } from '../partner-group/rag-draft-surfacing'
import type { LineMessage } from '../line/message-client'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { PartnerGroupRespondInput } from '../partner-group/responder'

// Capture pristine lazy defaults BEFORE any injection (module singletons leak).
const pristineResponder = getPartnerGroupResponder()
const pristineReplyClient = getReplyClient()
const pristineSource = getPartnerRagAnswerSource()

afterEach(() => {
  setPartnerGroupResponder(pristineResponder)
  setReplyClient(pristineReplyClient)
  setPartnerRagAnswerSource(pristineSource)
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INTENT_TEXT = '幫我草稿 一下這團的內部參考'
const NO_INTENT_TEXT = '明天清邁天氣如何'

function partnerEvent(o: Partial<NormalizedLineEvent> = {}): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M001',
    text: INTENT_TEXT,
    mentionsBot: true,
    timestamp: 1_700_000_000_000,
    replyToken: 'rt_partner',
    ...o,
  }
}

function respondInput(o: Partial<PartnerGroupRespondInput> = {}): PartnerGroupRespondInput {
  return {
    event: partnerEvent(),
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text: INTENT_TEXT,
    ...o,
  }
}

function bothGatesOn(): void {
  vi.stubEnv('AI_AGENT_NOTION_RAG_ENABLED', 'true')
  vi.stubEnv('AI_AGENT_PARTNER_RAG_DRAFT_ENABLED', 'true')
}

/** A fake source recording call count; returns an operator-safe draft body. */
function fakeSource() {
  return vi.fn(async (_input: PartnerGroupRespondInput) => ({
    text: '【夥伴群草稿】內部過往案例傾向：區域 古城、約 6 人',
  }))
}

function recordingReplyClient(returnIds: string[] = []): {
  client: ReplyClient
  calls: Array<{ replyToken: string; messages: LineMessage[] }>
} {
  const calls: Array<{ replyToken: string; messages: LineMessage[] }> = []
  const client: ReplyClient = async (replyToken, messages) => {
    calls.push({ replyToken, messages })
    return returnIds
  }
  return { client, calls }
}

// ---------------------------------------------------------------------------
// Responder-resolution level (getPartnerGroupResponder is now a dispatcher)
// ---------------------------------------------------------------------------

describe('getPartnerGroupResponder is wired to the RAG dispatcher', () => {
  it('item 1: gates default off → base stub responder, answerSource never called', async () => {
    const source = fakeSource()
    setPartnerRagAnswerSource(source)

    const result = await getPartnerGroupResponder().respond(respondInput())

    expect(result.meta?.responder).toBe('stub')
    expect(source).toHaveBeenCalledTimes(0)
  })

  it('item 2: partner tag + explicit intent + both gates on → rag path (fake source once)', async () => {
    bothGatesOn()
    const source = fakeSource()
    setPartnerRagAnswerSource(source)

    const result = await getPartnerGroupResponder().respond(respondInput())

    expect(result.meta?.responder).toBe('rag')
    expect(result.text).toContain('夥伴內部草稿')
    expect(source).toHaveBeenCalledTimes(1)
  })

  it('item 3: partner tag but NO explicit intent → base responder, source 0', async () => {
    bothGatesOn()
    const source = fakeSource()
    setPartnerRagAnswerSource(source)

    const result = await getPartnerGroupResponder().respond(
      respondInput({ event: partnerEvent({ text: NO_INTENT_TEXT }), text: NO_INTENT_TEXT }),
    )

    expect(result.meta?.responder).toBe('stub')
    expect(source).toHaveBeenCalledTimes(0)
  })

  it('item 7: source throws → fail-closed unavailable reply, no fabricated draft', async () => {
    bothGatesOn()
    const source = vi.fn(async () => {
      throw new Error('notion timeout')
    })
    setPartnerRagAnswerSource(source)
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await getPartnerGroupResponder().respond(respondInput())

    expect(result.text).toBe(PARTNER_RAG_UNAVAILABLE_REPLY)
    expect(result.text).not.toContain('內部過往案例傾向')
    expect(result.meta?.degraded).toBe(true)
    expect(source).toHaveBeenCalledTimes(1)
  })

  it('production default source is not-wired: both gates on → fails closed, no Notion', async () => {
    bothGatesOn()
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // No source injected → the production default (throws "not wired") applies.
    const result = await getPartnerGroupResponder().respond(respondInput())

    expect(result.text).toBe(PARTNER_RAG_UNAVAILABLE_REPLY)
    expect(result.meta?.degraded).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Handler level (end-to-end send gate, OA ban, sendTarget)
// ---------------------------------------------------------------------------

describe('webhook handler with the RAG dispatcher wired', () => {
  it('item 4: quote-to-bot + intent + gates on → rag draft sent exactly once', async () => {
    bothGatesOn()
    const source = fakeSource()
    setPartnerRagAnswerSource(source)
    const { client, calls } = recordingReplyClient(['M_botNew'])
    setReplyClient(client)

    const store = new MemoryStore()
    await store.putBotAuthoredPartnerMsg('M_botPrev')
    const ev = partnerEvent({
      kind: 'group_quoted',
      mentionsBot: false,
      messageId: 'M_q',
      replyToken: 'rt_q',
      quotedRef: { quotedMessageId: 'M_botPrev' },
    })

    await getEventHandler()(ev, store)

    expect(source).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(1)
    expect(calls[0].messages[0]).toMatchObject({ type: 'text' })
    expect((calls[0].messages[0] as { text: string }).text).toContain('夥伴內部草稿')
  })

  it('item 5: OA event with a RAG keyword → no responder, no reply, source 0 (B3 ban)', async () => {
    bothGatesOn()
    const source = fakeSource()
    setPartnerRagAnswerSource(source)
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    const oa: NormalizedLineEvent = {
      kind: 'oa_text',
      sourceChannel: 'line_oa',
      lineUserId: 'U_customer',
      messageId: 'M_oa',
      text: '幫我草稿 RAG 報價',
      mentionsBot: false,
      timestamp: 1_700_000_000_000,
      replyToken: 'rt_oa',
    }
    await getEventHandler()(oa, new MemoryStore())

    expect(source).toHaveBeenCalledTimes(0)
    expect(calls).toHaveLength(0)
  })

  it('item 6: untagged group message with a RAG keyword → no reply, source 0', async () => {
    bothGatesOn()
    const source = fakeSource()
    setPartnerRagAnswerSource(source)
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    await getEventHandler()(
      partnerEvent({ mentionsBot: false, text: 'RAG 幫我草稿' }),
      new MemoryStore(),
    )

    expect(source).toHaveBeenCalledTimes(0)
    expect(calls).toHaveLength(0)
  })

  it('item 8: tagged partner + intent + gates on → exactly one post_to_partner_group reply', async () => {
    bothGatesOn()
    const source = fakeSource()
    setPartnerRagAnswerSource(source)
    const { client, calls } = recordingReplyClient(['M_new'])
    setReplyClient(client)

    await getEventHandler()(partnerEvent(), new MemoryStore())

    expect(calls).toHaveLength(1)
    expect(calls[0].replyToken).toBe('rt_partner')
    expect((calls[0].messages[0] as { text: string }).text).toContain('夥伴內部草稿')
  })

  it('item 8b: gates off → tagged partner + intent still replies via base stub, source 0', async () => {
    const source = fakeSource()
    setPartnerRagAnswerSource(source)
    const { client, calls } = recordingReplyClient()
    setReplyClient(client)

    await getEventHandler()(partnerEvent(), new MemoryStore())

    expect(source).toHaveBeenCalledTimes(0)
    expect(calls).toHaveLength(1)
    expect((calls[0].messages[0] as { text: string }).text).not.toContain('夥伴內部草稿')
  })
})
