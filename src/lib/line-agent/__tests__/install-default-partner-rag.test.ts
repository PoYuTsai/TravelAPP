/**
 * install-default-partner-rag.test.ts — M3.2 runtime installer wiring with the
 * REAL @notionhq/client adapter (design 2026-06-06-line-oa-m3-2-partner-rag-
 * surfacing-design.md §6/§7, "Next knife").
 *
 * This slice adds the bootstrap `installDefaultPartnerRagAnswerSource(deps)`: the
 * single composition root that reads env → builds a Notion SDK client →
 * `createNotionRagClient` → `installPartnerRagAnswerSource`. It is the ONLY place
 * the real SDK is wired in; the seam/adapter/source core stays SDK-free.
 *
 * Hard boundaries asserted here:
 *  - import is side-effect free: no source install, no Notion, no token read,
 *  - missing token ⇒ fail closed (no SDK constructed, nothing installed, sanitized),
 *  - valid env + injected fake SDK factory ⇒ installs the real cached source,
 *  - install is LAZY: the index builds only when the installed source is called,
 *  - gates off through the webhook dispatcher ⇒ installed source never called (0 Notion),
 *  - both gates on + explicit intent ⇒ rag path runs the real installed source,
 *  - a Notion error degrades to the unavailable reply, never a fabricated draft,
 *  - NO token / db id / Notion url leaks via any reason code or error.
 *
 * NEVER flips `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED` outside a test-local stub, hits
 * real Notion (an injected fake SDK throughout), touches the LLM, or sends LINE.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  installDefaultPartnerRagAnswerSource,
  DEFAULT_PARTNER_RAG_TTL_MS,
} from '@/lib/line-agent/line/install-default-partner-rag'
import {
  getPartnerRagAnswerSource,
  setPartnerRagAnswerSource,
  getPartnerGroupResponder,
  setPartnerGroupResponder,
} from '@/lib/line-agent/line/webhook-runtime'
import { PARTNER_RAG_UNAVAILABLE_REPLY } from '@/lib/line-agent/partner-group/rag-draft-surfacing'
import type { NotionLikeSdkClient } from '@/lib/line-agent/notion/notion-rag-client'
import type { NormalizedLineEvent } from '@/lib/line-agent/line/event-normalizer'
import type { PartnerGroupRespondInput } from '@/lib/line-agent/partner-group/responder'

// Capture pristine lazy defaults BEFORE any injection (module singletons leak).
const pristineSource = getPartnerRagAnswerSource()
const pristineResponder = getPartnerGroupResponder()

afterEach(() => {
  setPartnerRagAnswerSource(pristineSource)
  setPartnerGroupResponder(pristineResponder)
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const INTENT_TEXT = '幫我草稿 一下這團的內部參考'
const SECRET = 'secret_leaky_token_abc123'

/** Full install env: a token (to build the SDK) + RAG config (so the source builds). */
function fullEnv(): Record<string, string | undefined> {
  return {
    NOTION_TOKEN: SECRET,
    AI_AGENT_NOTION_RAG_ENABLED: 'true',
    AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2026',
    NOTION_PRIVATE_2026_DATABASE_ID: 'a'.repeat(32),
  }
}

/**
 * A counting fake of the injected Notion-like SDK. Tracks `databases.retrieve`
 * calls so we can prove lazy build + zero-Notion on the gated-off path. With
 * `throws`, `retrieve` raises a SECRET-bearing error to exercise sanitization.
 */
function countingSdk(opts: { throws?: boolean } = {}) {
  let retrieveCount = 0
  const sdk: NotionLikeSdkClient = {
    databases: {
      async retrieve() {
        retrieveCount += 1
        if (opts.throws) throw new Error(`notion boom token=${SECRET}`)
        return { data_sources: [{ id: 'ds1' }] }
      },
    },
    dataSources: {
      async query() {
        return { results: [], has_more: false, next_cursor: null }
      },
    },
  }
  return { sdk, retrieveCalls: () => retrieveCount }
}

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

describe('installDefaultPartnerRagAnswerSource — bootstrap composition root', () => {
  it('point 1: importing the module installs nothing — the seam stays not-wired', async () => {
    // pristineSource was captured at module load; if import had auto-installed,
    // it would be the real source, not the fail-closed throwing default.
    await expect(pristineSource(respondInput())).rejects.toThrow(
      'partner_rag_answer_source_not_wired',
    )
  })

  it('point 2: missing token → fail closed (no SDK built, nothing installed, sanitized)', async () => {
    const factory = vi.fn((_auth: string) => countingSdk().sdk)

    const result = installDefaultPartnerRagAnswerSource({
      env: { AI_AGENT_NOTION_RAG_ENABLED: 'true' }, // no NOTION_TOKEN
      createSdkClient: factory,
    })

    expect(result.installed).toBe(false)
    expect(result.reason).toBe('missing_notion_token')
    expect(factory).toHaveBeenCalledTimes(0) // never constructed → never hit Notion
    // Seam untouched: still the fail-closed throwing default.
    await expect(getPartnerRagAnswerSource()(respondInput())).rejects.toThrow(
      'partner_rag_answer_source_not_wired',
    )
  })

  it('point 3: valid env + injected fake SDK factory → installs the real cached source', async () => {
    const { sdk } = countingSdk()
    const factory = vi.fn((_auth: string) => sdk)

    const result = installDefaultPartnerRagAnswerSource({
      env: fullEnv(),
      createSdkClient: factory,
    })

    expect(result.installed).toBe(true)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledWith(SECRET) // the token is passed to the SDK builder

    const { text } = await getPartnerRagAnswerSource()(respondInput())
    expect(typeof text).toBe('string') // the installed real source produced a body
  })

  it('point 4: install is LAZY — the index builds only when the source is called', async () => {
    const { sdk, retrieveCalls } = countingSdk()

    installDefaultPartnerRagAnswerSource({
      env: fullEnv(),
      createSdkClient: () => sdk,
    })

    expect(retrieveCalls()).toBe(0) // install alone hits no Notion
    await getPartnerRagAnswerSource()(respondInput())
    expect(retrieveCalls()).toBe(1) // first call builds the index
  })

  it('exposes a default TTL constant (the §6 cost guard window)', () => {
    expect(DEFAULT_PARTNER_RAG_TTL_MS).toBeGreaterThan(0)
  })
})

describe('installed real source behind the gated webhook dispatcher', () => {
  it('point 5: gates off → dispatcher uses base stub, installed source never hits Notion', async () => {
    const { sdk, retrieveCalls } = countingSdk()
    installDefaultPartnerRagAnswerSource({ env: fullEnv(), createSdkClient: () => sdk })

    const result = await getPartnerGroupResponder().respond(respondInput())

    expect(result.meta?.responder).toBe('stub')
    expect(retrieveCalls()).toBe(0) // gate off ⇒ source untouched ⇒ zero Notion
  })

  it('point 6: both gates on + explicit intent → rag path runs the real installed source', async () => {
    bothGatesOn()
    const { sdk, retrieveCalls } = countingSdk()
    installDefaultPartnerRagAnswerSource({ env: fullEnv(), createSdkClient: () => sdk })

    const result = await getPartnerGroupResponder().respond(respondInput())

    expect(result.meta?.responder).toBe('rag')
    expect(result.text).toContain('夥伴內部草稿') // banner from the rag responder
    expect(retrieveCalls()).toBe(1) // the real installed source actually read
  })

  it('point 7: Notion error → fail-closed unavailable reply, no fabricated draft', async () => {
    bothGatesOn()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { sdk } = countingSdk({ throws: true })
    installDefaultPartnerRagAnswerSource({ env: fullEnv(), createSdkClient: () => sdk })

    const result = await getPartnerGroupResponder().respond(respondInput())

    expect(result.text).toBe(PARTNER_RAG_UNAVAILABLE_REPLY)
    expect(result.meta?.degraded).toBe(true)
    expect(result.text).not.toContain('內部過往案例傾向')
  })
})

describe('no secret leak via reason codes or errors', () => {
  it('point 8a: missing-token reason is a fixed code — never the (absent) token', () => {
    const result = installDefaultPartnerRagAnswerSource({ env: {} })
    expect(result.reason).toBe('missing_notion_token')
    expect(JSON.stringify(result)).not.toContain(SECRET)
  })

  it('point 8b: an SDK factory that throws a secret → sanitized reason, nothing installed', async () => {
    const result = installDefaultPartnerRagAnswerSource({
      env: fullEnv(),
      createSdkClient: () => {
        throw new Error(`bad client init token=${SECRET}`)
      },
    })

    expect(result.installed).toBe(false)
    expect(result.reason).toBe('notion_client_init_failed')
    expect(JSON.stringify(result)).not.toContain(SECRET)
    // Seam untouched: still fail-closed.
    await expect(getPartnerRagAnswerSource()(respondInput())).rejects.toThrow(
      'partner_rag_answer_source_not_wired',
    )
  })

  it('point 8c: a thrown Notion error never surfaces the token through the installed source', async () => {
    const { sdk } = countingSdk({ throws: true })
    installDefaultPartnerRagAnswerSource({ env: fullEnv(), createSdkClient: () => sdk })

    await getPartnerRagAnswerSource()(respondInput()).then(
      () => {
        throw new Error('expected the installed source to reject on a Notion error')
      },
      (err: unknown) => {
        const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        expect(message).not.toContain(SECRET)
        expect(message).not.toMatch(/[0-9a-f]{32}/i) // no db id shape
        expect(message).not.toMatch(/notion\.so/i)
      },
    )
  })
})
