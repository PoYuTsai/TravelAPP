/**
 * notion-rag-index-builder.test.ts
 *
 * Fixture-backed RAG index builder (v1). NO real Notion, NO network, NO env,
 * NO fuzzy matching, NO weighted scorer. Drives the pipeline
 *
 *   RagIndexRecord[]  →  buildRagIndex (dedupe/merge)  →  queryRagIndex
 *
 * entirely from in-memory fixture records. The next cut wires a Notion read
 * adapter that produces these RagIndexRecord[]; this cut proves the index
 * contract is correct without it.
 *
 * Contract (per the locked spec):
 *   1. build merges a private_2026 + team_2026 duplicate of the same case
 *   2. keeps private_2025 separate (independent historical corpus)
 *   3. keeps markdown_template separate (curated seed)
 *   4. deterministic filters (area / theme) return the expected records
 *   5. partner projection still drops all private fields
 *   6. no fuzzy: similar-but-not-identical fingerprint does NOT merge
 */

import { describe, it, expect } from 'vitest'
import {
  buildRagIndexRecord,
  buildRagIndex,
  queryRagIndex,
  toPartnerSafeView,
  type RagCaseFacts,
  type RagIndexRecord,
  type RagSourceTable,
} from '../notion/rag-index'

// --- fixture helpers -------------------------------------------------------

const familyCmFacts: RagCaseFacts = {
  travelDateRange: '2026-04-12 ~ 2026-04-16',
  nights: 4,
  days: 5,
  adults: 2,
  children: 2,
  childAges: [4, 7],
  itinerarySnippet: 'Day 1｜清邁古城　Day 2｜叢林飛索',
  areaHints: ['清邁'],
  themeHints: ['親子'],
}

const honeymoonFacts: RagCaseFacts = {
  travelDateRange: '2026-05-01 ~ 2026-05-03',
  nights: 2,
  days: 3,
  adults: 2,
  children: 0,
  itinerarySnippet: 'Day 1｜寧曼路咖啡　Day 2｜按摩',
  areaHints: ['清邁'],
  themeHints: ['蜜月'],
}

const chiangraiFacts: RagCaseFacts = {
  travelDateRange: '2026-06-10 ~ 2026-06-12',
  nights: 2,
  days: 3,
  adults: 3,
  children: 0,
  itinerarySnippet: 'Day 1｜藍廟　Day 2｜茵他儂',
  areaHints: ['清萊'],
  themeHints: ['拍攝'],
}

function rec(partial: {
  facts: RagCaseFacts
  canonicalCaseId?: string
  sourceRecordId: string
  sourceTable: RagSourceTable
  privateContext?: RagIndexRecord['privateContext']
}): RagIndexRecord {
  return buildRagIndexRecord({
    identity: {
      canonicalCaseId: partial.canonicalCaseId,
      sourceRecordIds: [partial.sourceRecordId],
      sourceTables: [partial.sourceTable],
    },
    facts: partial.facts,
    audience: 'partner_group',
    privateContext: partial.privateContext,
  })
}

// ---------------------------------------------------------------------------
// 1. build merges private_2026 + team_2026 duplicate of the same case
// ---------------------------------------------------------------------------

describe('buildRagIndex — dedupe/merge', () => {
  it('merges a private_2026 + team_2026 duplicate into one indexed case', () => {
    const priv = rec({
      canonicalCaseId: 'CW-2026-001',
      sourceRecordId: 'priv-1',
      sourceTable: 'private_2026',
      facts: { ...familyCmFacts, itinerarySnippet: 'Day 1｜清邁古城（完整私人版）' },
      privateContext: { cost: 42000, profitShare: 'eric60/tsai40' },
    })
    const team = rec({
      canonicalCaseId: 'CW-2026-001',
      sourceRecordId: 'team-1',
      sourceTable: 'team_2026',
      facts: { ...familyCmFacts, itinerarySnippet: 'Day 1｜清邁古城（團隊精簡版）' },
    })

    const index = buildRagIndex([priv, team])

    expect(index.records).toHaveLength(1)
    const merged = index.records[0]
    expect(merged.identity.canonicalCaseId).toBe('CW-2026-001')
    expect(merged.identity.sourceRecordIds.sort()).toEqual(['priv-1', 'team-1'])
    expect(merged.identity.sourceTables.sort()).toEqual(['private_2026', 'team_2026'])
    // private_2026 wins as the canonical facts source
    expect(merged.facts.itinerarySnippet).toBe('Day 1｜清邁古城（完整私人版）')

    // byCaseKey indexes the merged case under its stable key
    expect(index.byCaseKey.get('CW-2026-001')).toEqual([merged])
  })

  // -------------------------------------------------------------------------
  // 2. keeps private_2025 separate even on an identical fingerprint
  // -------------------------------------------------------------------------

  it('keeps a private_2025 case separate from an identical-fingerprint 2026 case', () => {
    const hist = rec({ sourceRecordId: 'h25', sourceTable: 'private_2025', facts: familyCmFacts })
    const cur = rec({ sourceRecordId: 'p26', sourceTable: 'private_2026', facts: familyCmFacts })
    expect(hist.fingerprint).toBe(cur.fingerprint) // only the corpus rule blocks a merge

    const index = buildRagIndex([hist, cur])

    expect(index.records).toHaveLength(2)
    expect(index.bySourceTable.get('private_2025')).toHaveLength(1)
    expect(index.bySourceTable.get('private_2026')).toHaveLength(1)
  })

  // -------------------------------------------------------------------------
  // 3. keeps markdown_template separate even on an identical fingerprint
  // -------------------------------------------------------------------------

  it('keeps a markdown_template seed separate from an identical-fingerprint Notion case', () => {
    const tpl = rec({ sourceRecordId: 'tpl-5d', sourceTable: 'markdown_template', facts: familyCmFacts })
    const cur = rec({ sourceRecordId: 'p26', sourceTable: 'private_2026', facts: familyCmFacts })
    expect(tpl.fingerprint).toBe(cur.fingerprint)

    const index = buildRagIndex([tpl, cur])

    expect(index.records).toHaveLength(2)
    expect(index.bySourceTable.get('markdown_template')).toHaveLength(1)
    expect(index.bySourceTable.get('private_2026')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 4. deterministic filters (area / theme) return the expected records
// ---------------------------------------------------------------------------

describe('queryRagIndex — deterministic filters', () => {
  const family = rec({ sourceRecordId: 'p-fam', sourceTable: 'private_2026', facts: familyCmFacts })
  const honeymoon = rec({ sourceRecordId: 'p-hon', sourceTable: 'private_2026', facts: honeymoonFacts })
  const chiangrai = rec({ sourceRecordId: 'p-cr', sourceTable: 'private_2026', facts: chiangraiFacts })
  const index = buildRagIndex([family, honeymoon, chiangrai])

  it('filters by area (normalized, whitespace/full-width tolerant)', () => {
    const out = queryRagIndex(index, { area: ' 清邁 ' })
    const ids = out.map((r) => r.identity.sourceRecordIds[0]).sort()
    expect(ids).toEqual(['p-fam', 'p-hon'])
  })

  it('filters by theme', () => {
    const out = queryRagIndex(index, { themes: ['親子'] })
    expect(out).toHaveLength(1)
    expect(out[0].identity.sourceRecordIds[0]).toBe('p-fam')
  })

  it('ranks the case matching more dimensions first, then by source priority', () => {
    // area 清邁 matches family + honeymoon; only family also matches the theme.
    const out = queryRagIndex(index, { area: '清邁', themes: ['親子'] })
    expect(out[0].identity.sourceRecordIds[0]).toBe('p-fam')
  })

  it('returns nothing for an area with no indexed case', () => {
    expect(queryRagIndex(index, { area: '曼谷' })).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 5. partner projection still drops all private fields
// ---------------------------------------------------------------------------

describe('queryRagIndex — partner-safe projection', () => {
  it('partner projection of a query result carries no private context', () => {
    const priv = rec({
      canonicalCaseId: 'CW-2026-200',
      sourceRecordId: 'priv-200',
      sourceTable: 'private_2026',
      facts: familyCmFacts,
      privateContext: {
        notionPageUrl: 'https://notion.so/secret-page-id',
        databaseId: 'db_super_secret_id',
        cost: 42000,
        profitShare: 'eric60/tsai40',
        privateNotes: '客人是 Eric 的高中同學',
      },
    })
    const index = buildRagIndex([priv])

    const results = queryRagIndex(index, { area: '清邁' })
    expect(results).toHaveLength(1)

    const view = toPartnerSafeView(results[0])
    const serialized = JSON.stringify(view)
    expect('privateContext' in view).toBe(false)
    expect(serialized).not.toContain('notion.so')
    expect(serialized).not.toContain('db_super_secret_id')
    expect(serialized).not.toContain('42000')
    expect(serialized).not.toContain('profitShare')
    expect(serialized).not.toContain('高中同學')
    expect(view.caseKey).toBe('CW-2026-200')
  })
})

// ---------------------------------------------------------------------------
// 6. no fuzzy matching: similar-but-not-identical fingerprint does not merge
// ---------------------------------------------------------------------------

describe('buildRagIndex — no fuzzy matching (v1)', () => {
  it('keeps two 2026 cases whose dates differ by one day as separate index entries', () => {
    const a = rec({
      sourceRecordId: 'p-a',
      sourceTable: 'private_2026',
      facts: { ...familyCmFacts, travelDateRange: '2026-04-12 ~ 2026-04-16' },
    })
    const b = rec({
      sourceRecordId: 'p-b',
      sourceTable: 'private_2026',
      facts: { ...familyCmFacts, travelDateRange: '2026-04-13 ~ 2026-04-17' },
    })
    expect(a.fingerprint).not.toBe(b.fingerprint)

    const index = buildRagIndex([a, b])
    expect(index.records).toHaveLength(2)
  })
})
