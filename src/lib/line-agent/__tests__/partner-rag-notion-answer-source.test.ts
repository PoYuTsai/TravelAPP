/**
 * partner-rag-notion-answer-source.test.ts — M3.2 "next knife": the REAL cached
 * Notion RAG answer source (design 2026-06-06-line-oa-m3-2-partner-rag-surfacing-design.md
 * §6 cost guard + "Next knife (still gated off)").
 *
 * This slice assembles a REAL `PartnerRagDraftSource`:
 *   - `loadNotionRagIndex({env, client})` — resolve config → build index via the
 *     existing loader port; fail-closed (THROW) on disabled/error so the wrapper
 *     never caches a failure and the rag responder gives the unavailable reply.
 *   - `composeRagAnswerFromIndex(index, input)` — cheap per-request search +
 *     existing `composeAnswer`, eating ONLY operator-safe summaries (no
 *     privateContext / PII / price / Notion url / db id can enter).
 *   - `createNotionRagAnswerSource(deps)` — wraps the two in
 *     `createCachedRagAnswerSource` (TTL + single-flight).
 *
 * It then proves the webhook installer `installPartnerRagAnswerSource` opts the
 * runtime INTO this real source on demand, while the production default stays
 * not-wired + fail-closed unless that installer is explicitly called.
 *
 * Hard boundaries held here: NO real Notion (an injected fake `NotionRagClient`),
 * NO LLM (composeAnswer is deterministic), NO LINE send, and — critically — NO env
 * gate is flipped. `AI_AGENT_NOTION_RAG_ENABLED` is set ONLY inside a test-local
 * `deps.env` record for config resolution; the partner-draft gate
 * `AI_AGENT_PARTNER_RAG_DRAFT_ENABLED` is never touched.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  createNotionRagAnswerSource,
  composeRagAnswerFromIndex,
  loadNotionRagIndex,
  NotionRagIndexUnavailableError,
} from '@/lib/line-agent/partner-group/notion-rag-answer-source'
import {
  createRagPartnerGroupResponder,
  PARTNER_RAG_UNAVAILABLE_REPLY,
} from '@/lib/line-agent/partner-group/rag-draft-surfacing'
import {
  getPartnerRagAnswerSource,
  setPartnerRagAnswerSource,
  installPartnerRagAnswerSource,
} from '@/lib/line-agent/line/webhook-runtime'
import { buildRagIndexRecord, buildRagIndex } from '@/lib/line-agent/notion/rag-index'
import type { NotionRagClient } from '@/lib/line-agent/notion/notion-rag-loader'
import type { NotionApiPage } from '@/lib/line-agent/notion/page-flattener'
import type { PartnerGroupRespondInput } from '@/lib/line-agent/partner-group/responder'

const TTL = 10 * 60 * 1000

// Test-LOCAL env: enables only RAG config resolution inside the source. It is NOT
// process.env and does NOT flip the partner-draft gate.
function ragConfigEnv(): Record<string, string | undefined> {
  return {
    AI_AGENT_NOTION_RAG_ENABLED: 'true',
    AI_AGENT_NOTION_RAG_ACTIVE_SOURCES: 'private_2026',
    NOTION_PRIVATE_2026_DATABASE_ID: 'a'.repeat(32),
  }
}

function input(text = '清邁 親子 大象'): PartnerGroupRespondInput {
  return {
    event: {
      kind: 'group_text',
      sourceChannel: 'line_partner_group',
      lineUserId: 'U_tsai',
      groupId: 'G_partner',
      messageId: 'M001',
      text,
      mentionsBot: true,
      timestamp: 1_700_000_000_000,
    },
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text,
    botDirected: true,
  }
}

/** A counting fake loader port. Returns no pages → an OK empty index by default. */
function fakeClient(opts: { pages?: NotionApiPage[]; throws?: boolean } = {}) {
  let listCount = 0
  const client: NotionRagClient = {
    async listPages() {
      listCount += 1
      if (opts.throws) throw new Error('notion sdk boom <secret_xyz>')
      return opts.pages ?? []
    },
  }
  return { client, calls: () => listCount }
}

describe('loadNotionRagIndex — fail-closed config/build guard', () => {
  it('returns a RagIndex when config is enabled and the build is OK', async () => {
    const { client } = fakeClient()
    const index = await loadNotionRagIndex({ env: ragConfigEnv(), client })
    expect(Array.isArray(index.records)).toBe(true)
  })

  it('throws (fail-closed) when RAG config is disabled — never an empty silent index', async () => {
    const { client, calls } = fakeClient()
    await expect(
      loadNotionRagIndex({ env: {}, client }),
    ).rejects.toBeInstanceOf(NotionRagIndexUnavailableError)
    expect(calls()).toBe(0) // disabled gate short-circuits before any client call
  })

  it('throws (fail-closed) when the client errors, and the error is sanitized', async () => {
    const { client } = fakeClient({ throws: true })
    await expect(
      loadNotionRagIndex({ env: ragConfigEnv(), client }),
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof NotionRagIndexUnavailableError &&
        !/secret_/.test(e.message), // raw SDK error (with token) never re-surfaces
    )
  })
})

describe('composeRagAnswerFromIndex — operator-safe, no private leak', () => {
  // A leaky record: facts carry PII (flight/pickup) and privateContext carries
  // cost/revenue/url/db id/notes. The operator-safe projection (searchRagIndex)
  // must drop ALL of it before composeAnswer ever sees the record.
  const leaky = buildRagIndexRecord({
    identity: {
      sourceRecordIds: ['11111111111111111111111111111111'],
      sourceTables: ['private_2026'],
    },
    facts: {
      days: 5,
      partySize: 4,
      areaHints: ['chiangmai'],
      themeHints: ['family', 'elephant'],
      flightInfo: 'TG633 王小明 0912345678',
      pickupInfo: '王小明 君悅酒店 1203 室',
      itinerarySnippet: '客人王小明 訂金 NT$12000 已付',
    },
    audience: 'partner_group',
    privateContext: {
      notionPageUrl: 'https://www.notion.so/abcdef0123456789abcdef0123456789',
      databaseId: 'fedcba9876543210fedcba9876543210',
      cost: 38000,
      revenue: 65000,
      profitShare: 'Eric 60 / Min 40',
      privateNotes: '客人王小明 殺價兇 利潤低',
    },
  })
  const index = buildRagIndex([leaky])

  it('produces a 夥伴群草稿 body on a hit', async () => {
    const { text } = composeRagAnswerFromIndex(index, input('清邁 親子 大象'))
    expect(text).toContain('夥伴群草稿') // M3.1 body marker
    expect(text).toContain('內部過往案例傾向') // used-internal-reference branch
  })

  it('leaks NO private field even with a hit (price/revenue/url/db id/name/phone)', async () => {
    const { text } = composeRagAnswerFromIndex(index, input('清邁 親子 大象'))
    expect(text).not.toMatch(/notion\.so/i)
    expect(text).not.toMatch(/[0-9a-f]{32}/i) // Notion page/db id shape
    expect(text).not.toMatch(/NT\$?\s?\d/) // price shape
    expect(text).not.toContain('38000')
    expect(text).not.toContain('65000')
    expect(text).not.toContain('王小明') // customer name
    expect(text).not.toContain('0912345678') // phone
    expect(text).not.toContain('TG633') // flight
    expect(text).not.toContain('利潤') // profit note
  })
})

describe('composeRagAnswerFromIndex — Chiang Mai airport SOP wiring (regression A4)', () => {
  // Empty index → low_confidence body; the airport SOP must still surface because
  // it is derived from the partner's message text, not from a retrieved case.
  const emptyIndex = buildRagIndex([])

  it('a 接機/機場 message surfaces the CNX airport SOP, never the 桃機→市區 hallucination', () => {
    const { text } = composeRagAnswerFromIndex(emptyIndex, input('幫我草稿 客人要接機'))
    expect(text).toContain('航班號')
    expect(text).toMatch(/CNX.*(抵達|起飛)/)
    expect(text).toContain('司機')
    expect(text).toMatch(/第一天.*(接機|換匯)/)
    expect(text).not.toContain('桃機')
    expect(text).not.toMatch(/市區→|→市區/)
  })

  it('a non-airport message does NOT surface the airport SOP', () => {
    const { text } = composeRagAnswerFromIndex(emptyIndex, input('幫我草稿 古城區親子四天'))
    expect(text).not.toContain('CNX')
    expect(text).not.toContain('航班號')
  })

  it('a Bangkok domestic-transfer message additionally confirms 國內線轉機時間', () => {
    const { text } = composeRagAnswerFromIndex(
      emptyIndex,
      input('客人從曼谷搭國內線轉機到清邁，幫我草稿接機'),
    )
    expect(text).toMatch(/國內線.*轉機/)
  })
})

describe('createNotionRagAnswerSource — cached real source (TTL + single-flight)', () => {
  it('point 1: first call builds the index once and returns a draft body', async () => {
    const { client, calls } = fakeClient()
    const source = createNotionRagAnswerSource({
      client,
      env: ragConfigEnv(),
      ttlMs: TTL,
      now: () => 0,
    })
    const { text } = await source(input())
    expect(calls()).toBe(1)
    expect(typeof text).toBe('string')
  })

  it('point 2: a second call within TTL reuses the cached index (no rebuild)', async () => {
    let clock = 0
    const { client, calls } = fakeClient()
    const source = createNotionRagAnswerSource({
      client,
      env: ragConfigEnv(),
      ttlMs: TTL,
      now: () => clock,
    })
    await source(input())
    clock += TTL - 1
    await source(input())
    expect(calls()).toBe(1) // built once, reused — the §6 cost guard
  })

  it('point 5: a build failure is NOT cached — the next call retries', async () => {
    const { client, calls } = fakeClient({ throws: true })
    const source = createNotionRagAnswerSource({
      client,
      env: ragConfigEnv(),
      ttlMs: TTL,
      now: () => 0,
    })
    await expect(source(input())).rejects.toBeInstanceOf(NotionRagIndexUnavailableError)
    await expect(source(input())).rejects.toBeInstanceOf(NotionRagIndexUnavailableError)
    expect(calls()).toBe(2) // failure not cached for the whole TTL
  })
})

describe('real source behind the rag responder (output contract + fail-closed)', () => {
  it('point 3: surfaced draft carries the safety banner + the 草稿 marker', async () => {
    const { client } = fakeClient({
      pages: [],
    })
    const source = createNotionRagAnswerSource({
      client,
      env: ragConfigEnv(),
      ttlMs: TTL,
      now: () => 0,
    })
    const responder = createRagPartnerGroupResponder({ source })

    const result = await responder.respond(input())

    expect(result.meta?.responder).toBe('rag')
    expect(result.text).toContain('夥伴內部草稿') // banner
    expect(result.text).toContain('不是正式報價') // banner
  })

  it('point 5 end-to-end: client error → fail-closed unavailable reply, no fabricated draft', async () => {
    const { client } = fakeClient({ throws: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const source = createNotionRagAnswerSource({
      client,
      env: ragConfigEnv(),
      ttlMs: TTL,
      now: () => 0,
    })
    const responder = createRagPartnerGroupResponder({ source })

    const result = await responder.respond(input())

    expect(result.text).toBe(PARTNER_RAG_UNAVAILABLE_REPLY)
    expect(result.text).not.toContain('內部過往案例傾向')
    expect(result.meta?.degraded).toBe(true)
  })
})

describe('installPartnerRagAnswerSource — opt-in runtime wiring', () => {
  const pristineSource = getPartnerRagAnswerSource()
  afterEach(() => {
    setPartnerRagAnswerSource(pristineSource)
    vi.restoreAllMocks()
  })

  it('point 7: production default stays not-wired (throws) until the installer runs', async () => {
    // Default (no install): the seam is the not-wired throwing stub.
    await expect(getPartnerRagAnswerSource()(input())).rejects.toThrow(
      'partner_rag_answer_source_not_wired',
    )

    // Explicit opt-in installs the REAL cached source via the seam.
    const { client, calls } = fakeClient()
    installPartnerRagAnswerSource({ client, env: ragConfigEnv(), ttlMs: TTL, now: () => 0 })

    const { text } = await getPartnerRagAnswerSource()(input())
    expect(typeof text).toBe('string')
    expect(calls()).toBe(1) // the installed real source actually ran

    // Boundary check (DRY): points 6 (gate off ⇒ source 0) and 8 (no LINE send
    // change) are locked by partner-rag-webhook-wiring.test.ts. The real source
    // sits behind the SAME gated dispatcher as the fake used there, so installing
    // it cannot change those invariants — not re-proved here.
  })
})
