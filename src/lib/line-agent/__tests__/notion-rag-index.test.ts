/**
 * notion-rag-index.test.ts
 *
 * Pure-function contract for the Notion RAG index identity + dedupe primitives
 * (v1). NO real Notion, NO network, NO env, NO fuzzy matching. Crystallizes
 * docs/ai-agent-knowledge/rules/notion-rag-sources.md into executable types and
 * deterministic functions:
 *
 *   1. explicit stable key (canonicalCaseId) beats natural fingerprint
 *   2. deterministic natural-key fingerprint fallback (normalize-then-hash)
 *   3. source priority: private_2026 > team_2026; private_2025 + markdown are
 *      independent corpora that never strong-merge with 2026
 *   4. privacy shape: partner-safe view never carries raw private fields
 *   5. no fuzzy matching: fingerprint mismatch → no merge
 */

import { describe, it, expect } from 'vitest'
import {
  computeNaturalFingerprint,
  buildRagIndexRecord,
  resolveCaseKey,
  mergeCaseRecords,
  dedupeCaseRecords,
  toPartnerSafeView,
  buildRagIndex,
  queryRagIndex,
  type RagCaseFacts,
  type RagIndexRecord,
} from '../notion/rag-index'

// --- helpers ---------------------------------------------------------------

const baseFacts: RagCaseFacts = {
  travelDateRange: '2026-01-10 ~ 2026-01-14',
  nights: 4,
  days: 5,
  adults: 2,
  children: 1,
  childAges: [5],
  flightInfo: 'TG635 抵達 18:30',
  pickupInfo: '機場接送',
  itinerarySnippet: 'Day 1｜清邁古城　午餐：咖啡廳',
  areaHints: ['清邁'],
  themeHints: ['親子'],
}

function rec(
  partial: {
    facts?: Partial<RagCaseFacts>
    canonicalCaseId?: string
    sourceRecordId: string
    sourceTable: RagIndexRecord['identity']['sourceTables'][number]
    privateContext?: RagIndexRecord['privateContext']
  }
): RagIndexRecord {
  return buildRagIndexRecord({
    identity: {
      canonicalCaseId: partial.canonicalCaseId,
      sourceRecordIds: [partial.sourceRecordId],
      sourceTables: [partial.sourceTable],
    },
    facts: { ...baseFacts, ...partial.facts },
    audience: 'partner_group',
    privateContext: partial.privateContext,
  })
}

// ---------------------------------------------------------------------------
// 1. explicit stable key (canonicalCaseId) beats fingerprint
// ---------------------------------------------------------------------------

describe('explicit stable key priority', () => {
  it('treats two records with the same canonicalCaseId as one case even when fingerprints differ', () => {
    const a = rec({
      canonicalCaseId: 'CW-2026-001',
      sourceRecordId: 'priv-1',
      sourceTable: 'private_2026',
      facts: { itinerarySnippet: 'Day 1｜清邁古城（完整私人版）' },
    })
    const b = rec({
      canonicalCaseId: 'CW-2026-001',
      sourceRecordId: 'team-1',
      sourceTable: 'team_2026',
      facts: { itinerarySnippet: 'Day 1｜清邁古城（團隊精簡版）' },
    })

    // sanity: the natural fingerprints genuinely differ — so only the explicit
    // key can be responsible for the merge.
    expect(a.fingerprint).not.toBe(b.fingerprint)

    const deduped = dedupeCaseRecords([a, b])
    expect(deduped).toHaveLength(1)
    expect(deduped[0].identity.canonicalCaseId).toBe('CW-2026-001')
    expect(deduped[0].identity.sourceRecordIds.sort()).toEqual(['priv-1', 'team-1'])
    expect(deduped[0].identity.sourceTables.sort()).toEqual(['private_2026', 'team_2026'])
  })

  it('resolveCaseKey returns canonicalCaseId when present', () => {
    const a = rec({ canonicalCaseId: 'CW-2026-009', sourceRecordId: 'p9', sourceTable: 'private_2026' })
    expect(resolveCaseKey(a)).toBe('CW-2026-009')
  })
})

// ---------------------------------------------------------------------------
// 2. deterministic natural-key fingerprint fallback
// ---------------------------------------------------------------------------

describe('natural fingerprint fallback', () => {
  it('resolveCaseKey falls back to the fingerprint when no canonicalCaseId', () => {
    const a = rec({ sourceRecordId: 'p1', sourceTable: 'private_2026' })
    expect(a.identity.canonicalCaseId).toBeUndefined()
    expect(resolveCaseKey(a)).toBe(a.fingerprint)
    expect(a.fingerprint).toBe(computeNaturalFingerprint(a.facts))
  })

  it('is stable under whitespace / punctuation / full-width differences', () => {
    const clean: RagCaseFacts = {
      travelDateRange: '2026-01-10 ~ 2026-01-14',
      nights: 4,
      days: 5,
      adults: 2,
      children: 1,
      childAges: [5],
      flightInfo: 'TG635 抵達 18:30',
      pickupInfo: '機場接送',
      itinerarySnippet: 'Day 1｜清邁古城　午餐：咖啡廳',
      areaHints: ['清邁'],
      themeHints: ['親子'],
    }
    const messy: RagCaseFacts = {
      travelDateRange: '2026-01-10~2026-01-14',          // no spaces around ~
      nights: 4,
      days: 5,
      adults: 2,
      children: 1,
      childAges: [5],
      flightInfo: ' TG635  抵達  18：30 ',                // full-width colon, extra spaces
      pickupInfo: '機場接送　',                            // trailing ideographic space
      itinerarySnippet: 'Day 1 | 清邁古城  午餐: 咖啡廳',  // half-width pipe/colon, extra spaces
      areaHints: [' 清邁 '],
      themeHints: ['親子'],
    }
    expect(computeNaturalFingerprint(messy)).toBe(computeNaturalFingerprint(clean))
  })

  it('is order-independent for hint/age arrays (same data → same fingerprint)', () => {
    const f1: RagCaseFacts = { ...baseFacts, childAges: [3, 5], areaHints: ['清邁', '清萊'] }
    const f2: RagCaseFacts = { ...baseFacts, childAges: [5, 3], areaHints: ['清萊', '清邁'] }
    expect(computeNaturalFingerprint(f1)).toBe(computeNaturalFingerprint(f2))
  })

  it('produces different fingerprints for genuinely different data', () => {
    const other: RagCaseFacts = { ...baseFacts, nights: 6 }
    expect(computeNaturalFingerprint(other)).not.toBe(computeNaturalFingerprint(baseFacts))
  })
})

// ---------------------------------------------------------------------------
// 3. source priority
// ---------------------------------------------------------------------------

describe('source priority', () => {
  it('merges private_2026 + team_2026 and keeps private_2026 as the canonical facts source', () => {
    const priv = rec({
      canonicalCaseId: 'CW-2026-100',
      sourceRecordId: 'priv-100',
      sourceTable: 'private_2026',
      facts: { itinerarySnippet: 'Day 1｜清邁古城（完整私人行程，含私人脈絡）' },
      privateContext: { cost: 42000, profitShare: 'eric60/tsai40' },
    })
    const team = rec({
      canonicalCaseId: 'CW-2026-100',
      sourceRecordId: 'team-100',
      sourceTable: 'team_2026',
      facts: { itinerarySnippet: 'Day 1｜清邁古城（精簡）' },
    })

    const merged = mergeCaseRecords(team, priv) // pass team first to prove rank, not arg order, decides
    expect(merged.facts.itinerarySnippet).toBe('Day 1｜清邁古城（完整私人行程，含私人脈絡）')
    expect(merged.fingerprint).toBe(priv.fingerprint)
    expect(merged.identity.sourceTables.sort()).toEqual(['private_2026', 'team_2026'])
    expect(merged.identity.sourceRecordIds.sort()).toEqual(['priv-100', 'team-100'])
  })

  it('merges private_2027 + team_2027 and keeps private_2027 as the canonical facts source（2027 同 2026 家族規則）', () => {
    const priv = rec({
      canonicalCaseId: 'CW-2027-001',
      sourceRecordId: 'priv27-1',
      sourceTable: 'private_2027',
      facts: {
        travelDateRange: '2027-02-10 ~ 2027-02-14',
        itinerarySnippet: 'Day 1｜清邁古城（2027 完整私人行程）',
      },
      privateContext: { cost: 45000 },
    })
    const team = rec({
      canonicalCaseId: 'CW-2027-001',
      sourceRecordId: 'team27-1',
      sourceTable: 'team_2027',
      facts: {
        travelDateRange: '2027-02-10 ~ 2027-02-14',
        itinerarySnippet: 'Day 1｜清邁古城（2027 精簡）',
      },
    })

    const merged = mergeCaseRecords(team, priv)
    expect(merged.facts.itinerarySnippet).toBe('Day 1｜清邁古城（2027 完整私人行程）')
    expect(merged.identity.sourceTables.sort()).toEqual(['private_2027', 'team_2027'])
  })

  it('queryRagIndex orders by the locked source priority: private_2026 > private_2025 > private_2027 > team_2026 > team_2027', () => {
    // 同一查詢命中五個來源各一筆（descriptive match 數相同）→ 排序只由
    // source rank 決定（Eric 2026-06-11 拍板：2025 實績 > 2027 未發生）。
    const mk = (sourceTable: RagIndexRecord['identity']['sourceTables'][number], id: string) =>
      rec({
        sourceRecordId: id,
        sourceTable,
        // travelDateRange 各自不同 → fingerprint 不同 → 不會被 dedupe 合併
        facts: { travelDateRange: `range-${id}` },
      })
    const index = buildRagIndex([
      mk('team_2027', 't27'),
      mk('private_2025', 'p25'),
      mk('team_2026', 't26'),
      mk('private_2027', 'p27'),
      mk('private_2026', 'p26'),
    ])

    const ordered = queryRagIndex(index, { themes: ['親子'] }).map(
      (r) => r.identity.sourceTables[0]
    )
    expect(ordered).toEqual([
      'private_2026',
      'private_2025',
      'private_2027',
      'team_2026',
      'team_2027',
    ])
  })

  it('does NOT merge private_2025 with a 2026 record even when the fingerprint is identical', () => {
    const hist = rec({ sourceRecordId: 'h25-1', sourceTable: 'private_2025' })
    const cur = rec({ sourceRecordId: 'p26-1', sourceTable: 'private_2026' })
    // identical fingerprint-relevant facts — the ONLY thing stopping a merge is
    // the source-corpus rule.
    expect(hist.fingerprint).toBe(cur.fingerprint)

    const deduped = dedupeCaseRecords([hist, cur])
    expect(deduped).toHaveLength(2)
  })

  it('does NOT merge a markdown_template with a Notion case even when the fingerprint is identical', () => {
    const tpl = rec({ sourceRecordId: 'tpl-classic-5d', sourceTable: 'markdown_template' })
    const cur = rec({ sourceRecordId: 'p26-2', sourceTable: 'private_2026' })
    expect(tpl.fingerprint).toBe(cur.fingerprint)

    const deduped = dedupeCaseRecords([tpl, cur])
    expect(deduped).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 4. privacy shape
// ---------------------------------------------------------------------------

describe('privacy shape', () => {
  it('partner-safe view drops all raw private fields', () => {
    const r = rec({
      canonicalCaseId: 'CW-2026-200',
      sourceRecordId: 'priv-200',
      sourceTable: 'private_2026',
      privateContext: {
        notionPageUrl: 'https://notion.so/secret-page-id',
        databaseId: 'db_super_secret_id',
        cost: 42000,
        profitShare: 'eric60/tsai40',
        privateNotes: '客人是 Eric 的高中同學，給優惠',
      },
    })

    const view = toPartnerSafeView(r)

    expect('privateContext' in view).toBe(false)
    const serialized = JSON.stringify(view)
    expect(serialized).not.toContain('notion.so')
    expect(serialized).not.toContain('db_super_secret_id')
    expect(serialized).not.toContain('42000')
    expect(serialized).not.toContain('profitShare')
    expect(serialized).not.toContain('高中同學')

    // but it still carries de-identified, partner-usable reference data
    expect(view.caseKey).toBe('CW-2026-200')
    expect(view.sourceTables).toContain('private_2026')
    expect(view.facts.areaHints).toEqual(['清邁'])
  })
})

// ---------------------------------------------------------------------------
// 5. no fuzzy matching
// ---------------------------------------------------------------------------

describe('no fuzzy matching (v1)', () => {
  it('keeps near-but-not-identical 2026 records separate (date off by one day)', () => {
    const a = rec({
      sourceRecordId: 'p-a',
      sourceTable: 'private_2026',
      facts: { travelDateRange: '2026-01-10 ~ 2026-01-14' },
    })
    const b = rec({
      sourceRecordId: 'p-b',
      sourceTable: 'private_2026',
      facts: { travelDateRange: '2026-01-11 ~ 2026-01-15' },
    })
    expect(a.fingerprint).not.toBe(b.fingerprint)

    const deduped = dedupeCaseRecords([a, b])
    expect(deduped).toHaveLength(2)
  })

  it('keeps records with a one-year-off child age separate', () => {
    const a = rec({ sourceRecordId: 'p-c', sourceTable: 'private_2026', facts: { childAges: [5] } })
    const b = rec({ sourceRecordId: 'p-d', sourceTable: 'private_2026', facts: { childAges: [6] } })
    expect(a.fingerprint).not.toBe(b.fingerprint)
    expect(dedupeCaseRecords([a, b])).toHaveLength(2)
  })
})
