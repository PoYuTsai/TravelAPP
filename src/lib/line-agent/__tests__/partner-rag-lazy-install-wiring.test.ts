/**
 * partner-rag-lazy-install-wiring.test.ts — M3.2 decision C: the dispatcher
 * thunk lazily installs the real cached Notion source on the FIRST rag-eligible
 * request (design 2026-06-07-line-oa-m3-2-rag-call-site-wiring-design.md §3).
 *
 * Asserts the call-site contract through `getPartnerGroupResponder()` / the
 * webhook handler, using a module-level FAKE installer (`setPartnerRagInstaller`)
 * so no real `@notionhq/client` / Notion / network is touched:
 *
 *  - gate off / no intent / OA / untagged ⇒ thunk never runs ⇒ installer 0 (the
 *    structural gate guards the install; no Notion read, no SDK import),
 *  - partner tag + explicit intent + both gates on ⇒ installer runs once, the
 *    installed source is used, a re-fire does NOT re-install (idempotent),
 *  - installer error ⇒ fail-closed unavailable reply, NEVER a fabricated draft.
 *
 * Zero real LINE / Notion / LLM / SDK / key — fakes throughout.
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
import {
  setPartnerRagInstaller,
  resetPartnerRagInstallStateForTests,
} from '../line/ensure-partner-rag-installed'
import { MemoryStore } from '@/lib/line-agent/storage/memory-store'
import { PARTNER_RAG_UNAVAILABLE_REPLY } from '../partner-group/rag-draft-surfacing'
import type { LineMessage } from '../line/message-client'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { PartnerGroupRespondInput } from '../partner-group/responder'

const pristineResponder = getPartnerGroupResponder()
const pristineReplyClient = getReplyClient()
const pristineSource = getPartnerRagAnswerSource()

afterEach(() => {
  setPartnerGroupResponder(pristineResponder)
  setReplyClient(pristineReplyClient)
  setPartnerRagAnswerSource(pristineSource)
  resetPartnerRagInstallStateForTests()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

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

/** Silence the code-only install logs so the test output stays pristine. */
function silenceInstallLogs(): void {
  vi.spyOn(console, 'info').mockImplementation(() => {})
}

/** Installer that records calls and (on success) installs a fake source. */
function installerInstallingFakeSource() {
  return vi.fn(async () => {
    setPartnerRagAnswerSource(async () => ({
      text: '【夥伴群草稿】內部過往案例傾向：區域 古城、約 6 人',
    }))
    return { installed: true as const }
  })
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

describe('dispatcher lazily installs the partner RAG source (decision C)', () => {
  it('gate off → thunk never runs → installer 0', async () => {
    const installer = vi.fn(async () => ({ installed: true as const }))
    setPartnerRagInstaller(installer)

    await getPartnerGroupResponder().respond(respondInput())

    expect(installer).toHaveBeenCalledTimes(0)
  })

  it('no explicit intent → installer 0', async () => {
    bothGatesOn()
    const installer = vi.fn(async () => ({ installed: true as const }))
    setPartnerRagInstaller(installer)

    await getPartnerGroupResponder().respond(
      respondInput({ event: partnerEvent({ text: NO_INTENT_TEXT }), text: NO_INTENT_TEXT }),
    )

    expect(installer).toHaveBeenCalledTimes(0)
  })

  it('OA event with a RAG keyword → installer 0 (B3 ban path)', async () => {
    bothGatesOn()
    const installer = vi.fn(async () => ({ installed: true as const }))
    setPartnerRagInstaller(installer)
    const { client } = recordingReplyClient()
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

    expect(installer).toHaveBeenCalledTimes(0)
  })

  it('untagged group message with a RAG keyword → installer 0', async () => {
    bothGatesOn()
    const installer = vi.fn(async () => ({ installed: true as const }))
    setPartnerRagInstaller(installer)
    const { client } = recordingReplyClient()
    setReplyClient(client)

    await getEventHandler()(
      partnerEvent({ mentionsBot: false, text: 'RAG 幫我草稿' }),
      new MemoryStore(),
    )

    expect(installer).toHaveBeenCalledTimes(0)
  })

  it('success path: gates on + intent → installer runs once, installed source used', async () => {
    bothGatesOn()
    silenceInstallLogs()
    const installer = installerInstallingFakeSource()
    setPartnerRagInstaller(installer)

    const result = await getPartnerGroupResponder().respond(respondInput())

    expect(installer).toHaveBeenCalledTimes(1)
    expect(result.meta?.responder).toBe('rag')
    expect(result.text).toContain('夥伴內部草稿')
  })

  it('idempotent: a second rag-eligible respond does NOT re-install', async () => {
    bothGatesOn()
    silenceInstallLogs()
    const installer = installerInstallingFakeSource()
    setPartnerRagInstaller(installer)

    await getPartnerGroupResponder().respond(respondInput())
    await getPartnerGroupResponder().respond(respondInput())

    expect(installer).toHaveBeenCalledTimes(1)
  })

  it('failure path: installer error → fail-closed unavailable reply, no fabricated draft', async () => {
    bothGatesOn()
    const installer = vi.fn(async () => {
      throw new Error('boom')
    })
    setPartnerRagInstaller(installer)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})

    const result = await getPartnerGroupResponder().respond(respondInput())

    expect(installer).toHaveBeenCalledTimes(1)
    expect(result.text).toBe(PARTNER_RAG_UNAVAILABLE_REPLY)
    expect(result.text).not.toContain('內部過往案例傾向')
    expect(result.meta?.degraded).toBe(true)
  })

  it('end-to-end: success path sends exactly one tagged reply with the draft', async () => {
    bothGatesOn()
    silenceInstallLogs()
    const installer = installerInstallingFakeSource()
    setPartnerRagInstaller(installer)
    const { client, calls } = recordingReplyClient(['M_new'])
    setReplyClient(client)

    await getEventHandler()(partnerEvent(), new MemoryStore())

    expect(installer).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(1)
    expect((calls[0].messages[0] as { text: string }).text).toContain('夥伴內部草稿')
  })
})
