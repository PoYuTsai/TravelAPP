/**
 * notion-similar-search.test.ts
 *
 * Deterministic similar-case read search over fixture pages — no real Notion,
 * no LLM. Verifies: parenting-weighted ranking, 2026-only database guard,
 * partner masking survives into search output, uncertain dimensions, limit,
 * and that EXACTLY one notion_read audit entry is written via the injected
 * sink (and that CaseStore transition audit is never involved).
 */

import { describe, it, expect } from 'vitest'
import {
  searchSimilarCases,
  type NotionReadClient,
  type NotionReadAuditEntry,
  type NotionReadAuditSink,
} from '../notion/team-collaboration'
import { FIXTURE_PAGES } from '../notion/__fixtures__/pages'
import {
  TEAM_2026_FIXTURE_DATABASE_ID,
  TEAM_2026_DATABASE_LABEL,
} from '../notion/__fixtures__/team-2026-schema'
import type { NotionPageFixture } from '../notion/types'

// --- fakes -----------------------------------------------------------------

class FakeReadClient implements NotionReadClient {
  constructor(
    private readonly allowedId: string,
    private readonly pages: NotionPageFixture[]
  ) {}
  async queryTeam2026(databaseId: string): Promise<NotionPageFixture[]> {
    if (databaseId !== this.allowedId) {
      throw new Error(`refusing to read non-2026 database: ${databaseId}`)
    }
    return this.pages
  }
}

class FakeAuditSink implements NotionReadAuditSink {
  entries: NotionReadAuditEntry[] = []
  async appendNotionRead(entry: NotionReadAuditEntry): Promise<void> {
    this.entries.push(entry)
  }
}

const client = new FakeReadClient(TEAM_2026_FIXTURE_DATABASE_ID, FIXTURE_PAGES)
const DB = TEAM_2026_FIXTURE_DATABASE_ID

// --- tests -----------------------------------------------------------------

describe('searchSimilarCases — ranking', () => {
  it('ranks the family 5-day case top for a parenting query', async () => {
    const out = await searchSimilarCases(
      client,
      { children: 2, cityArea: '清邁', tripType: '親子' },
      'partner_group',
      { databaseId: DB }
    )
    expect(out.results.length).toBeGreaterThan(0)
    const top = out.results[0]
    expect(top.summary.refId).toBe('case-family-cm-5d')
    expect(top.matchedOn).toEqual(
      expect.arrayContaining(['children', 'cityArea', 'tripType'])
    )
    expect(top.score).toBeGreaterThan(0)
    // scores are sorted descending
    const scores = out.results.map((r) => r.score)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
  })
})

describe('searchSimilarCases — 2026-only guard', () => {
  it('throws when asked to read a non-2026 database', async () => {
    await expect(
      searchSimilarCases(client, { cityArea: '清邁' }, 'partner_group', {
        databaseId: 'some-other-db',
      })
    ).rejects.toThrow()
  })
})

describe('searchSimilarCases — partner masking survives', () => {
  it('never leaks exact amount, cost, or customer name', async () => {
    const out = await searchSimilarCases(
      client,
      { children: 2, cityArea: '清邁' },
      'partner_group',
      { databaseId: DB }
    )
    const blob = JSON.stringify(out)
    expect(blob).not.toContain('38000')
    expect(blob).not.toContain('22000')
    expect(blob).not.toContain('王先生')
    const family = out.results.find((r) => r.summary.refId === 'case-family-cm-5d')!
    expect(family.summary.omittedFields).toEqual(
      expect.arrayContaining(['成本', '分潤', '客人姓名'])
    )
  })
})

describe('searchSimilarCases — uncertain + limit', () => {
  it('lists queried dimensions a candidate lacks data for', async () => {
    const out = await searchSimilarCases(
      client,
      { adults: 2, childAges: [4, 7] },
      'partner_group',
      { databaseId: DB }
    )
    const photo = out.results.find((r) => r.summary.refId === 'case-photo-tour')!
    expect(photo.uncertain).toEqual(expect.arrayContaining(['childAges']))
  })

  it('honours the limit option', async () => {
    const out = await searchSimilarCases(
      client,
      { cityArea: '清邁' },
      'partner_group',
      { databaseId: DB, limit: 1 }
    )
    expect(out.results.length).toBe(1)
  })
})

describe('searchSimilarCases — read audit', () => {
  it('writes exactly one notion_read entry via the injected sink', async () => {
    const sink = new FakeAuditSink()
    const out = await searchSimilarCases(
      client,
      { children: 2, cityArea: '清邁', tripType: '親子' },
      'partner_group',
      { databaseId: DB, auditSink: sink, actor: 'eric', timestamp: 1717200000000 }
    )

    expect(sink.entries.length).toBe(1)
    const e = sink.entries[0]
    expect(e.type).toBe('notion_read')
    expect(e.actor).toBe('eric')
    expect(e.audience).toBe('partner_group')
    expect(e.resultCount).toBe(out.results.length)
    expect(e.omittedSensitiveCount).toBeGreaterThan(0)
    expect(e.timestamp).toBe(1717200000000)
    // label, never the full database id
    expect(e.databaseLabel).toBe(TEAM_2026_DATABASE_LABEL)
    expect(e.databaseLabel).not.toBe(DB)
    // querySummary must not contain any secret-like database id
    expect(e.querySummary).not.toContain(DB)
  })

  it('does not throw and writes audit even without a caseId', async () => {
    const sink = new FakeAuditSink()
    await searchSimilarCases(client, { cityArea: '清邁' }, 'operator_only', {
      databaseId: DB,
      auditSink: sink,
      timestamp: 1717200000000,
    })
    expect(sink.entries.length).toBe(1)
    expect(sink.entries[0].caseId).toBeUndefined()
  })

  it('works without an audit sink (MVP: no-op)', async () => {
    const out = await searchSimilarCases(client, { cityArea: '清邁' }, 'partner_group', {
      databaseId: DB,
    })
    expect(out.results.length).toBeGreaterThan(0)
  })
})
