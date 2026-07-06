/**
 * agent-command-notion-rag-answer.test.ts
 *
 * M3.1b — operator-only CLI preview `notion-rag-answer`. Feeds a real Notion RAG
 * search result into the deterministic `composeAnswer` so Eric can probe the
 * partner-group DRAFT tone from the CLI — masked by contract. NO LINE live path,
 * NO Sanity, NO scheduler/cache, NO LLM, NO message sent, NO secret printed.
 *
 * Mirrors the notion-rag-search seam: disabled gate → skipped (no Notion read),
 * an injectable `runSearch` + `composeAnswer` + `client`, and a runtime loader
 * default. The rendered draft reads only operator-safe + composed fields.
 *
 * Eight locked behaviors:
 *   1. disabled gate → skipped, runtime loader never called (no Notion read)
 *   2. enabled + search results → composeAnswer runs → partner-group draft
 *   3. low_confidence / empty → draft says 目前沒有強內部參考
 *   4. 6人包車 → draft gives vehicle DIRECTION only (no price / count / final commit)
 *   5. airport + many luggage → mustConfirm 行李件數與尺寸
 *   6. formatter never leaks privateContext / PII / secrets
 *   7. no LLM refine hook invoked (composeAnswer called with no refine option)
 *   8. output marked partner-group draft only — not a customer-facing reply / send
 */

import { describe, it, expect, vi } from 'vitest'
import { composeAnswer } from '../notion/notion-rag-answer-composer'
import {
  parseAgentCommandArgs,
  formatNotionRagAnswerReport,
  runNotionRagAnswerCommand,
} from '../../../../scripts/agent-command.mjs'

// --- search-report builders (already operator-safe summaries) ----------------

function okReport(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ok',
    parsedQuery: { areas: ['chiangmai'], themes: ['elephant'] },
    totalRecords: 10,
    resultCount: 1,
    results: [
      { areaHints: ['chiangmai'], themeHints: ['elephant'], days: 5, nights: 4, partySize: 4, vehicleType: 'Commuter' },
    ],
    issues: [],
    ...overrides,
  }
}

function emptyReport(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ok',
    parsedQuery: { areas: [], themes: [] },
    totalRecords: 10,
    resultCount: 0,
    results: [],
    issues: [],
    ...overrides,
  }
}

const ENABLED = { AI_AGENT_NOTION_RAG_ENABLED: 'true' }

/** Tokens that must NEVER appear in any rendered partner draft preview. */
const FORBIDDEN_TOKENS = ['notion.so', 'http', 'database', 'revenue', 'profit', '營收', '利潤', '成本', 'NT$', 'secret_ntn']

// ---------------------------------------------------------------------------
// 0. arg parsing
// ---------------------------------------------------------------------------

describe('parseAgentCommandArgs — notion-rag-answer', () => {
  it('captures the free-text query argument', () => {
    const parsed = parseAgentCommandArgs(['notion-rag-answer', '清邁 親子 大象 夜間動物園'])
    expect(parsed.commandText).toBe('notion-rag-answer')
    expect(parsed.query).toBe('清邁 親子 大象 夜間動物園')
  })
})

// ---------------------------------------------------------------------------
// 1. disabled gate → skipped, nothing loaded / no Notion read
// ---------------------------------------------------------------------------

describe('runNotionRagAnswerCommand — disabled gate', () => {
  it('returns a skipped projection and never touches the runtime loader', async () => {
    const loadRuntime = vi.fn()
    const out = await runNotionRagAnswerCommand({ env: {}, query: '清邁 親子', loadRuntime })
    expect(loadRuntime).not.toHaveBeenCalled()
    expect(out).toContain('略過')
    expect(out).not.toContain('清邁') // no corpus read, nothing surfaced
  })
})

// ---------------------------------------------------------------------------
// 2. enabled + results → composeAnswer runs → partner-group draft
// ---------------------------------------------------------------------------

describe('runNotionRagAnswerCommand — partner draft from results', () => {
  it('composes an internal-tendency partner-group draft', async () => {
    const out = await runNotionRagAnswerCommand({
      env: ENABLED,
      query: '清邁 親子 大象',
      runSearch: async () => okReport(),
      composeAnswer,
      client: {},
    })
    expect(out).toContain('夥伴群草稿')
    expect(out).toContain('內部過往案例傾向')
    expect(out).toContain('信心')
  })
})

// ---------------------------------------------------------------------------
// 3. low_confidence / empty → no strong internal reference
// ---------------------------------------------------------------------------

describe('runNotionRagAnswerCommand — low confidence', () => {
  it('draft says there is no strong internal reference', async () => {
    const out = await runNotionRagAnswerCommand({
      env: ENABLED,
      query: '東京 滑雪',
      runSearch: async () => emptyReport(),
      composeAnswer,
      client: {},
    })
    expect(out).toContain('目前沒有強內部參考')
  })
})

// ---------------------------------------------------------------------------
// 4. 6人包車 → vehicle DIRECTION only, no price / count / final commit
// ---------------------------------------------------------------------------

describe('runNotionRagAnswerCommand — party-size vehicle direction', () => {
  it('gives a big-van direction with no price or final commitment', async () => {
    const out = await runNotionRagAnswerCommand({
      env: ENABLED,
      query: '6人包車',
      runSearch: async () =>
        okReport({ parsedQuery: { areas: [], themes: [], partySize: 6 } }),
      composeAnswer,
      client: {},
    })
    expect(out).toContain('Toyota Commuter 10 人座 Van')
    expect(out).not.toMatch(/一定|保證|固定派/)
    // no concrete price/amount (the disclaimer 「未承諾…價格」 is fine; a real figure is not)
    expect(out).not.toMatch(/\$|NT\$|\d+\s*泰?銖|\d+\s*元/)
  })
})

// ---------------------------------------------------------------------------
// 5. airport + many luggage → mustConfirm 行李件數與尺寸
// ---------------------------------------------------------------------------

describe('runNotionRagAnswerCommand — airport + luggage', () => {
  it('surfaces 行李件數與尺寸 in the draft', async () => {
    const out = await runNotionRagAnswerCommand({
      env: ENABLED,
      query: '機場接送 行李 8 件',
      runSearch: async () => okReport(),
      composeAnswer,
      client: {},
    })
    expect(out).toContain('行李件數與尺寸')
    expect(out).toMatch(/行李車|第二台車/)
  })
})

// ---------------------------------------------------------------------------
// 6. formatter never leaks privateContext / PII / secrets
// ---------------------------------------------------------------------------

describe('formatNotionRagAnswerReport — no private leak', () => {
  it('renders none of the forbidden tokens', () => {
    const search = {
      status: 'ok' as const,
      parsedQuery: { areas: ['chiangmai'], themes: ['elephant'], partySize: 6 },
      totalRecords: 10,
      resultCount: 1,
      results: [{ areaHints: ['chiangmai'], themeHints: ['elephant'], days: 5, partySize: 6, vehicleType: 'Commuter' }],
    }
    const answer = composeAnswer({
      userQuestion: '清邁 親子',
      search,
      transportation: { partySize: 6, airportTransfer: true, luggageCount: 8 },
    })
    const out = formatNotionRagAnswerReport({
      status: 'ok',
      parsedQuery: search.parsedQuery,
      totalRecords: search.totalRecords,
      resultCount: search.resultCount,
      answer,
    })
    const lower = out.toLowerCase()
    for (const token of FORBIDDEN_TOKENS) {
      expect(lower).not.toContain(token.toLowerCase())
    }
  })
})

// ---------------------------------------------------------------------------
// 7. no LLM refine hook invoked
// ---------------------------------------------------------------------------

describe('runNotionRagAnswerCommand — no LLM refine', () => {
  it('calls composeAnswer with no refine option / refineHook', async () => {
    const spy = vi.fn((input) => composeAnswer(input))
    await runNotionRagAnswerCommand({
      env: ENABLED,
      query: '清邁 親子',
      runSearch: async () => okReport(),
      composeAnswer: spy,
      client: {},
    })
    expect(spy).toHaveBeenCalledTimes(1)
    const input = spy.mock.calls[0][0]
    expect(input.options).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 8. output marked partner-group draft only — not customer-facing / not sent
// ---------------------------------------------------------------------------

describe('runNotionRagAnswerCommand — partner-group draft only', () => {
  it('marks partner-group draft and is not a customer-facing auto-reply', async () => {
    const out = await runNotionRagAnswerCommand({
      env: ENABLED,
      query: '清邁 親子',
      runSearch: async () => okReport(),
      composeAnswer,
      client: {},
    })
    expect(out).toContain('夥伴群草稿')
    expect(out).toMatch(/非客人回覆|僅供內部|內部草稿/)
    expect(out).not.toMatch(/^(您好|親愛的|哈囉|Hi|Dear)/m)
    expect(out).not.toContain('感謝您的詢問')
  })
})

// ---------------------------------------------------------------------------
// 9. enabled but loader returns no composer → safe client_not_wired
// ---------------------------------------------------------------------------

describe('runNotionRagAnswerCommand — not wired', () => {
  it('projects client_not_wired when the loader returns no composeAnswer', async () => {
    const out = await runNotionRagAnswerCommand({
      env: ENABLED,
      query: '清邁 親子',
      loadRuntime: async () => ({ runSearch: async () => okReport(), composeAnswer: null, client: {} }),
    })
    expect(out).toContain('失敗')
    expect(out).toContain('client_not_wired')
  })

  it('collapses a runner throw to a secret-free error projection', async () => {
    const SECRET_DB = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'
    const out = await runNotionRagAnswerCommand({
      env: ENABLED,
      query: '清邁 親子',
      runSearch: async () => {
        throw new Error(`Notion 500 token=secret_ntn_sk-DEADBEEF db=${SECRET_DB}`)
      },
      composeAnswer,
      client: {},
    })
    expect(out).toContain('失敗')
    expect(out).not.toContain('secret_ntn_sk-DEADBEEF')
    expect(out).not.toContain(SECRET_DB)
  })
})
