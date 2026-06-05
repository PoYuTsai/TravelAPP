/**
 * notion-rag-adapter.test.ts
 *
 * Fixture-first Notion read adapter. Converts the minimal NotionPageFixture
 * shape into RagIndexRecord[] so the already-green index pipeline
 *
 *   NotionPageFixture[]  →  notionPagesToRagRecords  →  buildRagIndex  →  query
 *
 * runs end-to-end with NO real Notion API, NO real database id, NO network,
 * NO Sanity / webhook / send gate.
 *
 * Contract:
 *   1. one page → one RagIndexRecord with shareable facts (Eric's duration rule:
 *      天數 → days; nights stays undefined — never auto-derived).
 *   2. private raw fields (成本/分潤/db id) land ONLY in privateContext.
 *   3. unknown / sensitive-name fields (客人姓名) are never read (whitelist).
 *   4. provenance: sourceRecordIds = [page.id], sourceTables = [opts.sourceTable].
 *   5. canonicalCaseId is read from a 案例ID-style property when present.
 *   6. raw property aliases (出發日期) resolve through the shared FIELD_ALIASES.
 *   7. end-to-end: records feed buildRagIndex and partner projection drops
 *      every private field.
 */

import { describe, it, expect } from 'vitest'
import {
  notionPageToRagRecord,
  notionPagesToRagRecords,
} from '../notion/notion-rag-adapter'
import {
  buildRagIndex,
  queryRagIndex,
  toPartnerSafeView,
} from '../notion/rag-index'
import type { NotionPageFixture } from '../notion/types'
import { FIXTURE_PAGES } from '../notion/__fixtures__/pages'
import { TEAM_2026_FIXTURE_DATABASE_ID } from '../notion/__fixtures__/team-2026-schema'

// case-family-cm-5d — the rich family case with the full sensitive set.
const familyPage = FIXTURE_PAGES[0]

// ---------------------------------------------------------------------------
// 1. one page → one record with shareable facts (天數 → days, no nights)
// ---------------------------------------------------------------------------

describe('notionPageToRagRecord — facts mapping', () => {
  it('maps a Notion page into shareable RagCaseFacts', () => {
    const record = notionPageToRagRecord(familyPage, { sourceTable: 'team_2026' })

    expect(record.facts).toMatchObject({
      travelDateRange: '4/12-4/16',
      days: 5,
      adults: 2,
      children: 2,
      childAges: [4, 7],
      areaHints: ['清邁'],
      themeHints: ['親子'],
      itinerarySnippet: '清邁親子 5 天，動物園 + 叢林飛索 + 夜間動物園',
    })
  })

  it('keeps nights undefined when the page only carries 天數 (no invented facts)', () => {
    const record = notionPageToRagRecord(familyPage, { sourceTable: 'team_2026' })
    expect(record.facts.days).toBe(5)
    expect(record.facts.nights).toBeUndefined()
  })

  it('maps an explicit 夜數 property into nights', () => {
    const page: NotionPageFixture = {
      id: 'case-5d4n',
      databaseId: TEAM_2026_FIXTURE_DATABASE_ID,
      properties: { 日期: '4/12-4/16', 天數: 5, 夜數: 4, 城市區域: '清邁' },
    }
    const record = notionPageToRagRecord(page, { sourceTable: 'team_2026' })
    expect(record.facts.days).toBe(5)
    expect(record.facts.nights).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// 2. private raw fields land only in privateContext, never in facts
// ---------------------------------------------------------------------------

describe('notionPageToRagRecord — private context', () => {
  it('routes 成本 / 分潤 / databaseId into privateContext, not facts', () => {
    const record = notionPageToRagRecord(familyPage, { sourceTable: 'team_2026' })

    expect(record.privateContext).toMatchObject({
      cost: 22000,
      profitShare: '8000',
      databaseId: TEAM_2026_FIXTURE_DATABASE_ID,
    })
    // facts must never carry a private amount
    const factKeys = Object.keys(record.facts)
    expect(factKeys).not.toContain('cost')
    expect(factKeys).not.toContain('profitShare')
  })

  // -------------------------------------------------------------------------
  // 3. unknown / sensitive-name fields are never read (whitelist)
  // -------------------------------------------------------------------------

  it('never reads 客人姓名 into any part of the record', () => {
    const record = notionPageToRagRecord(familyPage, { sourceTable: 'team_2026' })
    expect(JSON.stringify(record)).not.toContain('王先生')
  })
})

// ---------------------------------------------------------------------------
// 4. provenance: sourceRecordIds + sourceTables come from id / opts
// ---------------------------------------------------------------------------

describe('notionPageToRagRecord — provenance & identity', () => {
  it('tags the record with the page id and the supplied source table', () => {
    const record = notionPageToRagRecord(familyPage, { sourceTable: 'private_2026' })
    expect(record.identity.sourceRecordIds).toEqual(['case-family-cm-5d'])
    expect(record.identity.sourceTables).toEqual(['private_2026'])
  })

  it('leaves canonicalCaseId undefined when no case-id property exists', () => {
    const record = notionPageToRagRecord(familyPage, { sourceTable: 'team_2026' })
    expect(record.identity.canonicalCaseId).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 5. canonicalCaseId is read from a 案例ID-style property when present
  // -------------------------------------------------------------------------

  it('reads canonicalCaseId from a 清微案例ID property', () => {
    const page: NotionPageFixture = {
      id: 'case-with-id',
      databaseId: TEAM_2026_FIXTURE_DATABASE_ID,
      properties: { 清微案例ID: 'CW-2026-001', 日期: '4/12-4/16', 天數: 5 },
    }
    const record = notionPageToRagRecord(page, { sourceTable: 'private_2026' })
    expect(record.identity.canonicalCaseId).toBe('CW-2026-001')
  })
})

// ---------------------------------------------------------------------------
// 6. raw aliases resolve through the shared FIELD_ALIASES
// ---------------------------------------------------------------------------

describe('notionPageToRagRecord — alias tolerance', () => {
  it('resolves 出發日期 to travelDateRange via FIELD_ALIASES', () => {
    const page: NotionPageFixture = {
      id: 'case-alias',
      databaseId: TEAM_2026_FIXTURE_DATABASE_ID,
      properties: { 出發日期: '8/1-8/4', 天數: 4, 城市區域: '清邁' },
    }
    const record = notionPageToRagRecord(page, { sourceTable: 'team_2026' })
    expect(record.facts.travelDateRange).toBe('8/1-8/4')
  })
})

// ---------------------------------------------------------------------------
// 7. end-to-end: pages → buildRagIndex → query, partner projection is clean
// ---------------------------------------------------------------------------

describe('notionPagesToRagRecords — end to end with buildRagIndex', () => {
  it('produces a queryable index whose partner view drops every private field', () => {
    const records = notionPagesToRagRecords(FIXTURE_PAGES, { sourceTable: 'team_2026' })
    expect(records).toHaveLength(FIXTURE_PAGES.length)

    const index = buildRagIndex(records)
    const results = queryRagIndex(index, { area: '清邁', themes: ['親子'] })
    expect(results.length).toBeGreaterThan(0)
    // the family case (most matched dimensions) ranks first
    expect(results[0].identity.sourceRecordIds).toContain('case-family-cm-5d')

    const view = toPartnerSafeView(results[0])
    const serialized = JSON.stringify(view)
    expect('privateContext' in view).toBe(false)
    expect(serialized).not.toContain('22000') // cost
    expect(serialized).not.toContain('8000') // profitShare amount
    expect(serialized).not.toContain(TEAM_2026_FIXTURE_DATABASE_ID)
    expect(serialized).not.toContain('王先生') // customer name
  })
})
