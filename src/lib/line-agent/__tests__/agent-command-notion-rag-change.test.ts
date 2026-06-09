/**
 * agent-command-notion-rag-change.test.ts
 *
 * M3.4a Cut 2 — operator-only CLI `notion-rag-change-dry-run`. Feeds a REAL
 * Notion RAG search result through the live-masked retrieval mapper into the
 * deterministic customer-change composer + operator preview, so Eric can probe —
 * from the CLI, masked — how a LIVE retrieval would (and would NOT) influence a
 * change draft. Theme-signal only: a live_masked case can be SUGGESTED but is
 * policy-barred from the draft (Cut 1 guard).
 *
 * Hard boundary (design 2026-06-09-m3.4a §Cut 2): operator CLI / masked smoke
 * ONLY. NO LINE webhook, NO partner/customer gate flip, NO LLM, NO Sanity, and
 * the report prints NO raw Notion payload / URL / db id / token / customer PII /
 * cost / revenue / profit / concrete live attraction name. The draft is built
 * from a FIXTURE scenario and must pass lint; a lint error fails closed.
 *
 * Five locked behaviors (task spec) + arg parse + loader shape:
 *   1. disabled gate → skipped (runtime loader never called, no Notion read)
 *   2. enabled but loader not wired → client_not_wired
 *   3. search throws → sanitized client_error (no secret survives)
 *   4. success path leaks no raw Notion / URL / db id / PII / live attraction name
 *   5. live_masked cases can only be named_only / none — NEVER substituted
 */

import { describe, it, expect, vi } from 'vitest'
import {
  parseAgentCommandArgs,
  runNotionRagChangeDryRunCommand,
} from '../../../../scripts/agent-command.mjs'
import { loadNotionRagChangeRuntime } from '../../../../scripts/notion-rag-dry-runner.mjs'
import { toLiveMaskedRetrievalCases } from '../notion/live-masked-retrieval-cases'
import { composeCustomerChange } from '../notion/customer-itinerary-change-composer'
import { buildOperatorRetrievalPreview } from '../notion/customer-change-operator-preview'
import { scenarioAddThrillActivity } from '../notion/__fixtures__/customer-change-scenarios'

const ENABLED = { AI_AGENT_NOTION_RAG_ENABLED: 'true' }

/** The real pure pieces — injected directly since they are deterministic. */
const KIT = {
  toLiveMaskedRetrievalCases,
  composeCustomerChange,
  buildOperatorRetrievalPreview,
  buildScenario: scenarioAddThrillActivity,
}

/** Secrets / private strings that must NEVER reach the operator output. */
const SECRET_TOKEN = 'secret_ntn_sk-DEADBEEF'
const SECRET_DB = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
const NOTION_LINK = 'https://www.notion.so/secret-page-deadbeef'
/** A concrete attraction name a real Notion summary might smuggle — must be masked. */
const LIVE_ATTRACTION = '茵他儂國家公園祕境步道'

/** Operator-safe search report whose summaries carry a friendly theme. */
function okSearchReport(themeHints: string[] = ['cafe'], overrides: Record<string, unknown> = {}) {
  return {
    status: 'ok',
    parsedQuery: { areas: ['chiangmai'], themes: themeHints },
    totalRecords: 12,
    resultCount: 1,
    results: [
      {
        // Plant a concrete attraction name in non-whitelisted fields: the mapper
        // reads ONLY themeHints, so this must never surface in the output.
        areaHints: [LIVE_ATTRACTION],
        themeHints,
        days: 7,
        nights: 6,
        partySize: 6,
        vehicleType: 'Commuter',
      },
    ],
    issues: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 0. arg parsing
// ---------------------------------------------------------------------------

describe('parseAgentCommandArgs — notion-rag-change-dry-run', () => {
  it('captures the optional free-text query argument', () => {
    const parsed = parseAgentCommandArgs(['notion-rag-change-dry-run', '清邁 親子 咖啡'])
    expect(parsed.commandText).toBe('notion-rag-change-dry-run')
    expect(parsed.query).toBe('清邁 親子 咖啡')
  })
})

// ---------------------------------------------------------------------------
// 1. disabled gate → skipped, nothing loaded / no Notion read
// ---------------------------------------------------------------------------

describe('runNotionRagChangeDryRunCommand — disabled gate', () => {
  it('returns a skipped projection and never touches the runtime loader', async () => {
    const loadRuntime = vi.fn()
    const out = await runNotionRagChangeDryRunCommand({ env: {}, query: '清邁 咖啡', loadRuntime })
    expect(loadRuntime).not.toHaveBeenCalled()
    expect(out).toContain('略過')
  })
})

// ---------------------------------------------------------------------------
// 2. enabled but loader not wired → client_not_wired
// ---------------------------------------------------------------------------

describe('runNotionRagChangeDryRunCommand — not wired', () => {
  it('projects client_not_wired when the loader returns no changeKit', async () => {
    const out = await runNotionRagChangeDryRunCommand({
      env: ENABLED,
      query: '清邁 咖啡',
      loadRuntime: async () => ({ runSearch: async () => okSearchReport(), changeKit: null, client: {} }),
    })
    expect(out).toContain('失敗')
    expect(out).toContain('client_not_wired')
  })
})

// ---------------------------------------------------------------------------
// 3. search throws → sanitized client_error, no secret survives
// ---------------------------------------------------------------------------

describe('runNotionRagChangeDryRunCommand — sanitized client_error', () => {
  it('collapses a runner throw to a secret-free error projection', async () => {
    const out = await runNotionRagChangeDryRunCommand({
      env: ENABLED,
      query: '清邁 咖啡',
      runSearch: async () => {
        throw new Error(`Notion 500 token=${SECRET_TOKEN} db=${SECRET_DB} at ${NOTION_LINK}`)
      },
      changeKit: KIT,
      client: {},
    })
    expect(out).toContain('失敗')
    expect(out).toContain('client_error')
    expect(out).not.toContain(SECRET_TOKEN)
    expect(out).not.toContain(SECRET_DB)
    expect(out).not.toContain(NOTION_LINK)
    expect(out).not.toContain('notion.so')
  })
})

// ---------------------------------------------------------------------------
// 4. success path → masked summary, no raw Notion / URL / db / PII / live name
// ---------------------------------------------------------------------------

describe('runNotionRagChangeDryRunCommand — masked success path', () => {
  it('renders a live theme signal + named_only outcome with the draft passing lint', async () => {
    const out = await runNotionRagChangeDryRunCommand({
      env: ENABLED,
      query: '清邁 咖啡',
      runSearch: async () => okSearchReport(['cafe']),
      changeKit: KIT,
      client: {},
    })
    expect(out).toContain('完成')
    // theme-signal only: the generic label is shown, the concrete live name is not.
    expect(out).toContain('cafe')
    expect(out).toContain('named_only')
    expect(out).toContain('過 lint')
  })

  it('leaks none of the forbidden tokens nor the concrete live attraction name', async () => {
    const out = await runNotionRagChangeDryRunCommand({
      env: ENABLED,
      query: '清邁 咖啡',
      runSearch: async () => okSearchReport(['cafe']),
      changeKit: KIT,
      client: {},
    })
    const forbidden = [
      LIVE_ATTRACTION,
      SECRET_TOKEN,
      SECRET_DB,
      NOTION_LINK,
      'notion.so',
      'http',
      'database',
      '營收',
      '利潤',
      '成本',
      'NT$',
    ]
    for (const token of forbidden) {
      expect(out).not.toContain(token)
    }
  })
})

// ---------------------------------------------------------------------------
// 5. live_masked cases can only be named_only / none — never substituted
// ---------------------------------------------------------------------------

describe('runNotionRagChangeDryRunCommand — live_masked never substituted', () => {
  it('keeps a theme-aligned live_masked candidate at named_only (not substituted)', async () => {
    // A scenario whose declined add asks for the SAME theme the live case carries:
    // a fixture case would substitute, but a live_masked case must not.
    const cafeAlignedScenario = () => {
      const s = scenarioAddThrillActivity()
      return {
        base: s.base,
        changes: { addActivities: [{ day: 3, activity: '叢林飛索體驗', themeTag: 'cafe' }] },
      }
    }
    const out = await runNotionRagChangeDryRunCommand({
      env: ENABLED,
      query: '清邁 咖啡',
      runSearch: async () => okSearchReport(['cafe']),
      changeKit: KIT,
      client: {},
      buildScenario: cafeAlignedScenario,
    })
    expect(out).toContain('named_only')
    expect(out).not.toContain('substituted')
    expect(out).not.toContain('已代入')
  })

  it('yields none when the live search has no mobility-friendly theme', async () => {
    const out = await runNotionRagChangeDryRunCommand({
      env: ENABLED,
      query: '清邁 飛索',
      runSearch: async () => okSearchReport(['zipline', 'adventure']),
      changeKit: KIT,
      client: {},
    })
    // adventure/zipline are excluded from the friendly whitelist → no live case.
    expect(out).toContain('none')
    expect(out).not.toContain('substituted')
  })
})

// ---------------------------------------------------------------------------
// 6. loader shape — mirrors the dry-run / search / answer loaders
// ---------------------------------------------------------------------------

describe('loadNotionRagChangeRuntime', () => {
  const realEnv = (overrides = {}) => ({
    AI_AGENT_NOTION_RAG_ENABLED: 'true',
    AI_AGENT_NOTION_RAG_RUNTIME: 'real',
    NOTION_TOKEN: SECRET_TOKEN,
    ...overrides,
  })

  it('default env (no real gate) → all pieces null', async () => {
    const runtime = await loadNotionRagChangeRuntime({ env: {} })
    expect(runtime).toEqual({ runSearch: null, changeKit: null, client: null })
  })

  it('non-real gate → injectable factories never called', async () => {
    const importSearch = vi.fn()
    const importChangeKit = vi.fn()
    const createClient = vi.fn()
    const runtime = await loadNotionRagChangeRuntime({
      env: { AI_AGENT_NOTION_RAG_RUNTIME: 'mock' },
      importSearch,
      importChangeKit,
      createClient,
    })
    expect(runtime).toEqual({ runSearch: null, changeKit: null, client: null })
    expect(importSearch).not.toHaveBeenCalled()
    expect(importChangeKit).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('real gate + missing token → not wired, client factory not called', async () => {
    const createClient = vi.fn()
    const runtime = await loadNotionRagChangeRuntime({
      env: realEnv({ NOTION_TOKEN: undefined }),
      importSearch: async () => async () => okSearchReport(),
      importChangeKit: async () => KIT,
      createClient,
    })
    expect(runtime).toEqual({ runSearch: null, changeKit: null, client: null })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('real gate + fake factories → assembles all three pieces', async () => {
    const runSearch = async () => okSearchReport()
    const client = { listPages: async () => [] }
    const runtime = await loadNotionRagChangeRuntime({
      env: realEnv(),
      importSearch: async () => runSearch,
      importChangeKit: async () => KIT,
      createClient: async () => client,
    })
    expect(runtime.runSearch).toBe(runSearch)
    expect(runtime.changeKit).toBe(KIT)
    expect(runtime.client).toBe(client)
  })

  it('factory throw with secrets → loader re-throws sanitized, no leak', async () => {
    let thrown: unknown
    try {
      await loadNotionRagChangeRuntime({
        env: realEnv(),
        importSearch: async () => async () => okSearchReport(),
        importChangeKit: async () => KIT,
        createClient: async () => {
          throw new Error(`boom token=${SECRET_TOKEN} db=${SECRET_DB} at ${NOTION_LINK}`)
        },
      })
    } catch (err) {
      thrown = err
    }
    const blob = `${(thrown as Error)?.message ?? ''}\n${(thrown as Error)?.stack ?? ''}`
    expect(thrown).toBeTruthy()
    expect(blob).not.toContain(SECRET_TOKEN)
    expect(blob).not.toContain(SECRET_DB)
    expect(blob).not.toContain(NOTION_LINK)
  })
})
