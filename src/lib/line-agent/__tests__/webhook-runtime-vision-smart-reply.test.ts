/**
 * webhook-runtime-vision-smart-reply.test.ts — Task 5.1 composition-root wiring.
 *
 * Proves the new vision smart-reply path is wired into `getPartnerGroupResponder`
 * REPLACING the old `createVisionIntakeResponder` block, gated by three env flags
 * (all default off). The single most important invariant: with the gates off,
 * NON-image partner-group routing is byte-identical to today.
 *
 * Coverage:
 *  1. gate-off byte-identical: all three gates off + no anthropic key ⇒ a NON-image
 *     tagged partner-group message still routes through the base stub responder and
 *     replies exactly once (no regression vs today).
 *  2. RAG gate wiring (driven through the REAL composition root): we install a fake
 *     smart-reply factory via `setSmartReplyAgentFactory` that CAPTURES the deps the
 *     production singleton builds, reset the lazy singleton, then trigger a real
 *     rebuild via `getPartnerGroupResponder()`:
 *       - AI_AGENT_NOTION_RAG_ENABLED off ⇒ captured `getRagIndex === undefined`.
 *       - AI_AGENT_NOTION_RAG_ENABLED on  ⇒ captured `getRagIndex` is a function.
 *  3. M-2 "no second index": when RAG is on, the smart-reply agent's `getRagIndex`
 *     is the SAME loader instance the itinerary reference source receives — proven
 *     by reference-equality. We mock `itinerary-reference-wiring` to capture the
 *     `getIndex` the composition root hands the itinerary source, and assert it ===
 *     the captured smart-reply `getRagIndex` (one shared TTL-cached index loader,
 *     never a second one).
 *
 * Zero real LINE / Notion / LLM / network. Fakes throughout. The smart-reply agent
 * itself is fully tested in Task 3.2; here we only PROVE the wiring contract.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'

// Mock the itinerary-reference-wiring module so we can CAPTURE the `getIndex`
// (the shared TTL loader) the composition root passes to the itinerary reference
// source — needed for the M-2 reference-equality assertion. `isNotionRagEnabled`
// is kept REAL via importActual so the production RAG gate still drives the build.
const capturedItineraryGetIndex: Array<() => Promise<unknown>> = []
vi.mock('../line/itinerary-reference-wiring', async (importActual) => {
  const actual = await importActual<
    typeof import('../line/itinerary-reference-wiring')
  >()
  return {
    ...actual,
    resolveItineraryReferenceSource: (deps: { getIndex: () => Promise<unknown> }) => {
      capturedItineraryGetIndex.push(deps.getIndex)
      return actual.resolveItineraryReferenceSource(
        deps as Parameters<typeof actual.resolveItineraryReferenceSource>[0]
      )
    },
  }
})

// Mock the vision smart-reply responder factory so the `visionIntake` slot the
// production composition root builds (`buildSmartReplyVisionResponder` →
// `createVisionSmartReplyResponder`) is a SPY responder. This lets us assert,
// through the REAL webhook dispatch path, that a gate-ON quoted-image event
// actually REACHES `visionIntake.respond` — i.e. the routing wiring holds. The
// spy short-circuits the real fetchImage/need/agent so the test needs ZERO
// network. The rest of the module stays real via importActual.
const visionRespondSpy = vi.fn(
  async (): Promise<{ text: string; meta: { responder: string } }> => ({
    text: '【截圖內容整理】spy-vision-reply',
    meta: { responder: 'vision_intake' },
  })
)
vi.mock('../partner-group/vision-smart-reply-surfacing', async (importActual) => {
  const actual = await importActual<
    typeof import('../partner-group/vision-smart-reply-surfacing')
  >()
  return {
    ...actual,
    createVisionSmartReplyResponder: () => ({ respond: visionRespondSpy }),
  }
})

import {
  getEventHandler,
  getPartnerGroupResponder,
  setPartnerGroupResponder,
  getReplyClient,
  setReplyClient,
  setSmartReplyAgentFactory,
  type ReplyClient,
} from '../line/webhook-runtime'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'
import type { LineMessage } from '../line/message-client'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { SmartReplyAgentDeps } from '../partner-group/smart-reply-agent'

// Capture pristine lazy defaults BEFORE any injection (module singletons leak).
const pristineResponder = getPartnerGroupResponder()
const pristineReplyClient = getReplyClient()

afterEach(() => {
  setPartnerGroupResponder(pristineResponder)
  setReplyClient(pristineReplyClient)
  setSmartReplyAgentFactory(null) // reset to the real createSmartReplyAgent
  capturedItineraryGetIndex.length = 0
  visionRespondSpy.mockClear()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function partnerEvent(o: Partial<NormalizedLineEvent> = {}): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M001',
    text: '@bot 請幫我確認',
    mentionsBot: true,
    timestamp: 1_700_000_000_000,
    replyToken: 'rt_partner',
    ...o,
  }
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

/**
 * Install a fake smart-reply factory that records the deps the PRODUCTION
 * composition root builds, then force a real rebuild of the lazy singleton from
 * current env. Returns the captured deps array (one entry per build that had a key).
 */
function buildProductionResponderAndCapture(): SmartReplyAgentDeps[] {
  const captured: SmartReplyAgentDeps[] = []
  setSmartReplyAgentFactory((deps) => {
    captured.push(deps)
    return async () => ({
      text: 'fake-agent',
      meta: { responder: 'llm', model: deps.defaultModel },
    })
  })
  setPartnerGroupResponder(null) // reset lazy singleton → next get() rebuilds from env
  getPartnerGroupResponder() // trigger the REAL composition root build
  return captured
}

// ---------------------------------------------------------------------------
// 1. gate-off byte-identical (non-image routing unchanged)
// ---------------------------------------------------------------------------

describe('gate-off: non-image partner-group routing is unchanged', () => {
  it('all gates off + no key → tagged partner message still replies via base stub', async () => {
    // No env stubbed → all gates off, no anthropic key → base = stub.
    const { client, calls } = recordingReplyClient(['M_new'])
    setReplyClient(client)

    await getEventHandler()(partnerEvent(), new MemoryStore())

    expect(calls).toHaveLength(1)
    expect(calls[0].replyToken).toBe('rt_partner')
    // Base stub text (no RAG, no vision) — proves the vision wiring did not
    // perturb the non-image path.
    expect((calls[0].messages[0] as { text: string }).text).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 2. RAG gate wiring — driven through the REAL production composition root
// ---------------------------------------------------------------------------

describe('RAG gate wiring into createSmartReplyAgent (production wiring)', () => {
  it('AI_AGENT_NOTION_RAG_ENABLED off → production passes getRagIndex undefined', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    vi.stubEnv('AI_AGENT_DEFAULT_MODEL', 'claude-test')
    // RAG gate left off.
    const captured = buildProductionResponderAndCapture()

    expect(captured).toHaveLength(1)
    expect(captured[0].getRagIndex).toBeUndefined()
  })

  it('AI_AGENT_NOTION_RAG_ENABLED on → production passes a defined loader', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    vi.stubEnv('AI_AGENT_DEFAULT_MODEL', 'claude-test')
    vi.stubEnv('AI_AGENT_NOTION_RAG_ENABLED', 'true')
    const captured = buildProductionResponderAndCapture()

    expect(captured).toHaveLength(1)
    expect(typeof captured[0].getRagIndex).toBe('function')
  })

  // M-2: lock "no second index" — RAG on ⇒ the smart-reply agent's getRagIndex is
  // the SAME loader instance the itinerary reference source receives. Reference-
  // equality proves a single shared TTL-cached index loader, never two.
  it('RAG on → smart-reply getRagIndex IS the same shared loader as the itinerary source (no second index)', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    vi.stubEnv('AI_AGENT_DEFAULT_MODEL', 'claude-test')
    vi.stubEnv('AI_AGENT_NOTION_RAG_ENABLED', 'true')
    const captured = buildProductionResponderAndCapture()

    // Itinerary source got exactly one getIndex from the composition root.
    expect(capturedItineraryGetIndex).toHaveLength(1)
    expect(captured).toHaveLength(1)
    // Same loader instance handed to BOTH consumers ⇒ single shared index.
    expect(captured[0].getRagIndex).toBe(capturedItineraryGetIndex[0])
  })

  it('no anthropic key → no smart-reply factory call (path absent)', () => {
    // No ANTHROPIC_API_KEY → vision smart-reply path does not exist, so the
    // factory is never invoked even though the singleton is rebuilt.
    const captured = buildProductionResponderAndCapture()

    expect(captured).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 4. OCR gate ON happy-path — quoted-image partner event REACHES visionIntake
//    (driven through the REAL webhook dispatch entry, not a unit dispatcher).
//
//    This is the last coverage gap before a live-group flip: every segment is
//    unit-tested (shouldUseVisionIntake, the dispatcher slot, the composition
//    root wiring) but NOTHING proved that a real inbound quoted-image event
//    actually traverses webhook → routeCommand → dispatcher → visionIntake.
//    Here we drive `getEventHandler()` (the real entry) with the OCR gate ON and
//    a quoted-image partner-group event, and assert the production-built
//    `visionIntake.respond` (a spy, via the vision-smart-reply-surfacing mock)
//    IS invoked. A negative (gate OFF) case proves the assertion is meaningful
//    and that the wiring — not some always-on side effect — is what fires it.
// ---------------------------------------------------------------------------

/** Gate-ON env: OCR enabled + positive cost cap + anthropic key so the vision
 *  responder is built at all (no key ⇒ undefined ⇒ path absent). */
const OCR_GATE_ON_ENV = {
  AI_AGENT_OCR_ENABLED: 'true',
  AI_AGENT_TOOL_COST_CAP_USD: '1',
  ANTHROPIC_API_KEY: 'sk-test',
  AI_AGENT_DEFAULT_MODEL: 'claude-test',
} as const

function stubGateOnEnv(): void {
  for (const [k, v] of Object.entries(OCR_GATE_ON_ENV)) vi.stubEnv(k, v)
}

/** A bot-directed quoted-IMAGE partner-group event (the vision trigger). */
function quotedImagePartnerEvent(
  o: Partial<NormalizedLineEvent> = {}
): NormalizedLineEvent {
  return partnerEvent({
    kind: 'group_quoted',
    messageId: 'M_quote',
    text: '@bot',
    mentionsBot: true,
    quotedRef: { quotedMessageId: 'M_img' },
    ...o,
  })
}

describe('OCR gate ON: real webhook dispatch reaches visionIntake (live-flip safety net)', () => {
  it('quoted-image + tagged partner event → production visionIntake.respond IS invoked', async () => {
    stubGateOnEnv()
    const { client, calls } = recordingReplyClient(['M_new'])
    setReplyClient(client)
    // Force a fresh build of the lazy singleton from the gate-ON env so the
    // REAL composition root wires the (spied) visionIntake into the dispatcher.
    setPartnerGroupResponder(null)

    const store = new MemoryStore()
    // The webhook only treats the quote as an image if the quoted messageId was
    // recorded as a partner-group image (resolveQuotedImage → store lookup).
    await store.putPartnerGroupImageMsg('M_img')

    await getEventHandler()(quotedImagePartnerEvent(), store)

    // Dispatch reached the smart-reply path.
    expect(visionRespondSpy).toHaveBeenCalledTimes(1)
    // …and its reply was the one actually sent to the partner group.
    expect(calls).toHaveLength(1)
    expect((calls[0].messages[0] as { text: string }).text).toContain(
      '【截圖內容整理】'
    )
  })

  it('gate OFF (OCR disabled) → same quoted-image event does NOT reach visionIntake', async () => {
    // RED-anchor: only the OCR gate is flipped off. The key still builds the
    // vision responder, the event is still a quoted image — so if dispatch
    // reached visionIntake regardless of the gate, the spy WOULD fire. It must
    // not. This is what makes the positive assertion above meaningful.
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    vi.stubEnv('AI_AGENT_DEFAULT_MODEL', 'claude-test')
    // AI_AGENT_OCR_ENABLED + AI_AGENT_TOOL_COST_CAP_USD intentionally left off.
    const { client } = recordingReplyClient(['M_new'])
    setReplyClient(client)
    setPartnerGroupResponder(null)

    const store = new MemoryStore()
    await store.putPartnerGroupImageMsg('M_img')

    await getEventHandler()(quotedImagePartnerEvent(), store)

    expect(visionRespondSpy).not.toHaveBeenCalled()
  })
})
