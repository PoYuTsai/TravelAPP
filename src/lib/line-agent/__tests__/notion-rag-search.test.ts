/**
 * notion-rag-search.test.ts
 *
 * Operator-only RAG retrieval PREVIEW (smoke) command. Lets Eric probe the real
 * Notion corpus query quality from the CLI — masked by contract. NO LINE live
 * path, NO Sanity, NO scheduler/cache, NO LLM, NO real secret printed.
 *
 * Two layers, mirroring the notion-rag-dry-run seam:
 *   - TS (`notion/notion-rag-search.ts`): pure search + operator-safe projection.
 *     searchRagIndex(index, query) parses the free text, retrieves top-N, and
 *     projects each case to an operator-safe summary that structurally CANNOT
 *     carry privateContext (cost/revenue/profit/notes/url/db-id) or PII.
 *   - CLI (`scripts/agent-command.mjs`): disabled gate → skipped (no Notion read),
 *     runtime loader, and a sanitized client_error projection.
 *
 * Six locked behaviors:
 *   1. disabled gate → skipped, nothing loaded / no Notion read
 *   2. enabled + query → build index → retrieve top results
 *   3. unknown query → empty / low confidence (never the whole corpus)
 *   4. output projection / formatter never leaks privateContext
 *   5. query tokens surface as canonical area/theme
 *   6. Notion client error → sanitized (no token / db id / notion.so url)
 */

import { describe, it, expect, vi } from 'vitest'
import {
  buildRagIndexRecord,
  buildRagIndex,
  type RagCaseFacts,
  type RagIndexRecord,
} from '../notion/rag-index'
import {
  searchRagIndex,
  toOperatorSafeCaseSummary,
} from '../notion/notion-rag-search'
import {
  parseAgentCommandArgs,
  formatNotionRagSearchReport,
  runNotionRagSearchCommand,
} from '../../../../scripts/agent-command.mjs'

// --- fixture corpus (canonical snake_case hints, as the real corpus carries) --

function rec(id: string, facts: RagCaseFacts, privateContext?: RagIndexRecord['privateContext']): RagIndexRecord {
  return buildRagIndexRecord({
    identity: { sourceRecordIds: [id], sourceTables: ['private_2026'] },
    facts,
    audience: 'partner_group',
    privateContext,
  })
}

const cmFamilyElephant = rec('cm-fam', {
  days: 5,
  nights: 4,
  partySize: 4,
  adults: 2,
  children: 2,
  childAges: [5, 8],
  itinerarySnippet: 'Day 1｜清邁古城　Day 2｜大象保護營　Day 3｜夜間動物園',
  areaHints: ['chiangmai'],
  themeHints: ['elephant', 'night_safari'],
})

const cmHoneymoon = rec('cm-hon', {
  days: 3,
  nights: 2,
  partySize: 2,
  itinerarySnippet: 'Day 1｜寧曼路咖啡',
  areaHints: ['chiangmai'],
  themeHints: ['cafe', 'massage'],
})

const bigPartyCommuter = rec('cm-big', {
  days: 4,
  partySize: 6,
  vehicleType: 'Commuter',
  itinerarySnippet: 'Day 1｜Big C 採買',
  areaHints: ['chiangmai'],
  themeHints: ['shopping'],
})

const index = buildRagIndex([cmFamilyElephant, cmHoneymoon, bigPartyCommuter])

// A record carrying maximal private context — used to prove the projection and
// the formatter never leak any of it.
const SECRET_URL = 'https://www.notion.so/secret-page-deadbeef'
const SECRET_DB = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
const leakyRecord = rec(
  'leak-1',
  {
    days: 5,
    nights: 4,
    partySize: 4,
    itinerarySnippet: 'Day 1｜清邁古城',
    areaHints: ['chiangmai'],
    themeHints: ['elephant'],
  },
  {
    notionPageUrl: SECRET_URL,
    databaseId: SECRET_DB,
    cost: 42000,
    revenue: 88000,
    profitShare: 'eric60/tsai40',
    privateNotes: '客戶王小明是 Eric 高中同學',
  }
)
const leakyIndex = buildRagIndex([leakyRecord])

// ---------------------------------------------------------------------------
// 0. arg parsing — the command takes a free-text query
// ---------------------------------------------------------------------------

describe('parseAgentCommandArgs — notion-rag-search', () => {
  it('captures the free-text query argument', () => {
    const parsed = parseAgentCommandArgs(['notion-rag-search', '清邁 親子 5天 大象 夜間動物園'])
    expect(parsed.commandText).toBe('notion-rag-search')
    expect(parsed.query).toBe('清邁 親子 5天 大象 夜間動物園')
  })
})

// ---------------------------------------------------------------------------
// 1. disabled gate → skipped, nothing loaded / no Notion read
// ---------------------------------------------------------------------------

describe('runNotionRagSearchCommand — disabled gate', () => {
  it('returns a skipped projection and never touches the runtime loader', async () => {
    const loadRuntime = vi.fn()
    const out = await runNotionRagSearchCommand({
      env: {}, // AI_AGENT_NOTION_RAG_ENABLED unset
      query: '清邁 親子',
      loadRuntime,
    })
    expect(loadRuntime).not.toHaveBeenCalled()
    expect(out).toContain('略過')
    expect(out).not.toContain('清邁') // no corpus read, nothing surfaced
  })
})

// ---------------------------------------------------------------------------
// 2. enabled + query → build index → retrieve top results
// ---------------------------------------------------------------------------

describe('searchRagIndex — retrieval', () => {
  it('retrieves and ranks the family elephant/night-safari case first', () => {
    const result = searchRagIndex(index, '清邁 親子 5天 大象 夜間動物園')
    expect(result.status).toBe('ok')
    expect(result.totalRecords).toBe(3)
    expect(result.resultCount).toBeGreaterThan(0)
    const top = result.results[0]
    expect(top.areaHints).toContain('chiangmai')
    expect(top.themeHints).toEqual(expect.arrayContaining(['elephant', 'night_safari']))
    expect(top.days).toBe(5)
    expect(top.partySize).toBe(4)
  })

  it('honors topN', () => {
    const result = searchRagIndex(index, '清邁', { topN: 1 })
    expect(result.results).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 3. unknown query → empty / low confidence
// ---------------------------------------------------------------------------

describe('searchRagIndex — unknown query', () => {
  it('returns low confidence with no results, never the whole corpus', () => {
    const result = searchRagIndex(index, '東京 滑雪')
    expect(result.status).toBe('low_confidence')
    expect(result.resultCount).toBe(0)
    expect(result.results).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 4. projection + formatter never leak privateContext
// ---------------------------------------------------------------------------

describe('operator-safe projection — no private leak', () => {
  it('toOperatorSafeCaseSummary drops all private context and identity ids', () => {
    const summary = toOperatorSafeCaseSummary(leakyRecord)
    const serialized = JSON.stringify(summary)
    expect(serialized).not.toContain('notion.so')
    expect(serialized).not.toContain(SECRET_DB)
    expect(serialized).not.toContain('42000')
    expect(serialized).not.toContain('88000')
    expect(serialized).not.toContain('profitShare')
    expect(serialized).not.toContain('王小明')
    expect(serialized).not.toContain('leak-1') // raw record id stays internal
    // but it keeps the operator-usable safe facts
    expect(summary.areaHints).toEqual(['chiangmai'])
    expect(summary.partySize).toBe(4)
    expect(summary.itinerarySnippetPreview).toContain('清邁古城')
  })

  it('the rendered report carries none of the private fields', () => {
    const result = searchRagIndex(leakyIndex, '清邁 大象')
    const out = formatNotionRagSearchReport({
      status: 'ok',
      parsedQuery: result.parsedQuery,
      totalRecords: result.totalRecords,
      resultCount: result.resultCount,
      results: result.results,
      issues: [],
    })
    expect(out).not.toContain('notion.so')
    expect(out).not.toContain(SECRET_DB)
    expect(out).not.toContain('42000')
    expect(out).not.toContain('88000')
    expect(out).not.toContain('profitShare')
    expect(out).not.toContain('王小明')
  })
})

// ---------------------------------------------------------------------------
// 5. query tokens surface as canonical area/theme
// ---------------------------------------------------------------------------

describe('formatNotionRagSearchReport — parsed tokens', () => {
  it('shows canonical area/theme tokens for the query', () => {
    const result = searchRagIndex(index, '清邁 大象 夜間動物園')
    const out = formatNotionRagSearchReport({
      status: 'ok',
      parsedQuery: result.parsedQuery,
      totalRecords: result.totalRecords,
      resultCount: result.resultCount,
      results: result.results,
      issues: [],
    })
    expect(out).toContain('chiangmai')
    expect(out).toContain('elephant')
    expect(out).toContain('night_safari')
  })
})

// ---------------------------------------------------------------------------
// 6. Notion client error → sanitized
// ---------------------------------------------------------------------------

describe('runNotionRagSearchCommand — sanitized client error', () => {
  it('collapses a runner throw to a secret-free error projection', async () => {
    const out = await runNotionRagSearchCommand({
      env: { AI_AGENT_NOTION_RAG_ENABLED: 'true' },
      query: '清邁 大象',
      // injected runner that throws a leaky error
      runSearch: async () => {
        throw new Error(`Notion 500 token=secret_ntn_sk-DEADBEEF db=${SECRET_DB} url=${SECRET_URL}`)
      },
      client: {},
    })
    expect(out).toContain('失敗')
    expect(out).not.toContain('secret_ntn_sk-DEADBEEF')
    expect(out).not.toContain(SECRET_DB)
    expect(out).not.toContain('notion.so')
  })

  it('projects client_not_wired when the loader returns no runner', async () => {
    const out = await runNotionRagSearchCommand({
      env: { AI_AGENT_NOTION_RAG_ENABLED: 'true' },
      query: '清邁 大象',
      loadRuntime: async () => ({ runSearch: null, client: null }),
    })
    expect(out).toContain('失敗')
    expect(out).toContain('client_not_wired')
  })
})
