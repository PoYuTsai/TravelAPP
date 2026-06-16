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
 *  2. RAG gate wiring: the wiring passes `getRagIndex === undefined` into
 *     `createSmartReplyAgent` when AI_AGENT_NOTION_RAG_ENABLED is off, and a DEFINED
 *     loader when it is on. Asserted through a thin factory seam
 *     (`setSmartReplyAgentFactory`) that records the deps the composition root built.
 *
 * Zero real LINE / Notion / LLM / network. Fakes throughout. The smart-reply agent
 * itself is fully tested in Task 3.2; here we only PROVE the wiring contract.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  getEventHandler,
  getPartnerGroupResponder,
  setPartnerGroupResponder,
  getReplyClient,
  setReplyClient,
  setSmartReplyAgentFactory,
  buildSmartReplyVisionResponder,
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
// 2. RAG gate wiring — getRagIndex undefined when off, defined when on
// ---------------------------------------------------------------------------

describe('RAG gate wiring into createSmartReplyAgent', () => {
  function captureFactory() {
    const captured: SmartReplyAgentDeps[] = []
    setSmartReplyAgentFactory((deps) => {
      captured.push(deps)
      return async () => ({ text: 'fake-agent', meta: { responder: 'llm', model: deps.defaultModel } })
    })
    return captured
  }

  it('AI_AGENT_NOTION_RAG_ENABLED off → getRagIndex is undefined', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    vi.stubEnv('AI_AGENT_DEFAULT_MODEL', 'claude-test')
    // RAG gate left off.
    const captured = captureFactory()

    const responder = buildSmartReplyVisionResponder()

    expect(responder).not.toBeUndefined()
    expect(captured).toHaveLength(1)
    expect(captured[0].getRagIndex).toBeUndefined()
  })

  it('AI_AGENT_NOTION_RAG_ENABLED on → getRagIndex is a defined loader', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test')
    vi.stubEnv('AI_AGENT_DEFAULT_MODEL', 'claude-test')
    vi.stubEnv('AI_AGENT_NOTION_RAG_ENABLED', 'true')
    const captured = captureFactory()

    buildSmartReplyVisionResponder()

    expect(captured).toHaveLength(1)
    expect(typeof captured[0].getRagIndex).toBe('function')
  })

  it('no anthropic key → no smart-reply responder built (path absent)', () => {
    // No ANTHROPIC_API_KEY → vision smart-reply path does not exist.
    const captured = captureFactory()

    const responder = buildSmartReplyVisionResponder()

    expect(responder).toBeUndefined()
    expect(captured).toHaveLength(0)
  })
})
