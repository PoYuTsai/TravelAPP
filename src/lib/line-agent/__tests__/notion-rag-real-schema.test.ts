/**
 * notion-rag-real-schema.test.ts
 *
 * Alias-alignment knife: prove the adapter maps Eric's REAL 2026 private Notion
 * column names → RagCaseFacts / privateContext, fixture-only (no network, no
 * real db id, no customer-data dump).
 *
 * Contract (per Eric's schema decisions, 2026-06-06):
 *   - 旅遊人數 → facts.partySize; 成人/小朋友/大/小 breakdown also fills
 *     adults/children, but an un-splittable total fills partySize ONLY (no
 *     invented adults/children).
 *   - 飛行班次 → facts.flightInfo (raw text, partner-safe).
 *   - 包車車型 → facts.vehicleType (raw text, partner-safe) — NOT pickupInfo.
 *   - 行程框架 → facts.itinerarySnippet (searchable text).
 *   - 總成本 → privateContext.cost; 總收入 → privateContext.revenue;
 *     利潤 → privateContext.profitShare. NONE may reach facts or partner view.
 *   - No explicit area/theme column → the deterministic itinerary-parser
 *     (notion/itinerary-parser.ts) derives area/theme hints from 行程框架 text;
 *     unrecognised text still yields nothing (never invented).
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
  type RagCaseFacts,
} from '../notion/rag-index'
import { normalizeField } from '../notion/field-policy'
import type { NotionPageFixture } from '../notion/types'
import {
  REAL_2026_FIXTURE_PAGES,
  REAL_2026_FIXTURE_DATABASE_ID,
} from '../notion/__fixtures__/real-2026-schema'

const familyPage = REAL_2026_FIXTURE_PAGES[0]

function realPage(properties: Record<string, unknown>): NotionPageFixture {
  return { id: 'real-case', databaseId: REAL_2026_FIXTURE_DATABASE_ID, properties }
}

function factsOf(properties: Record<string, unknown>): RagCaseFacts {
  return notionPageToRagRecord(realPage(properties), { sourceTable: 'private_2026' }).facts
}

// ---------------------------------------------------------------------------
// alias resolution — the real column names must resolve through FIELD_ALIASES
// ---------------------------------------------------------------------------

describe('real 2026 column aliases resolve through field-policy', () => {
  it.each([
    ['旅遊日期', 'dates'],
    ['旅遊人數', 'partySize'],
    ['飛行班次', 'flightInfo'],
    ['包車車型', 'vehicleType'],
    ['行程框架', 'itinerarySummary'],
    ['總成本', 'cost'],
    ['總收入', 'revenue'],
    ['利潤', 'profitShare'],
  ])('%s → %s', (raw, canonical) => {
    expect(normalizeField(raw)).toBe(canonical)
  })
})

// ---------------------------------------------------------------------------
// 旅遊人數 → partySize (+ optional adults/children breakdown)
// ---------------------------------------------------------------------------

describe('旅遊人數 → partySize', () => {
  it('成人2 小朋友2 → partySize 4, adults 2, children 2', () => {
    const f = factsOf({ 旅遊人數: '成人2 小朋友2' })
    expect(f.partySize).toBe(4)
    expect(f.adults).toBe(2)
    expect(f.children).toBe(2)
  })

  it('成人9 → partySize 9, adults 9, children undefined', () => {
    const f = factsOf({ 旅遊人數: '成人9' })
    expect(f.partySize).toBe(9)
    expect(f.adults).toBe(9)
    expect(f.children).toBeUndefined()
  })

  it('7大2小 → partySize 9, adults 7, children 2', () => {
    const f = factsOf({ 旅遊人數: '7大2小' })
    expect(f.partySize).toBe(9)
    expect(f.adults).toBe(7)
    expect(f.children).toBe(2)
  })

  it('9人 → partySize 9, adults/children undefined (no invented split)', () => {
    const f = factsOf({ 旅遊人數: '9人' })
    expect(f.partySize).toBe(9)
    expect(f.adults).toBeUndefined()
    expect(f.children).toBeUndefined()
  })

  it('a plain numeric 旅遊人數 → partySize, no split', () => {
    const f = factsOf({ 旅遊人數: 8 })
    expect(f.partySize).toBe(8)
    expect(f.adults).toBeUndefined()
    expect(f.children).toBeUndefined()
  })

  it('un-splittable text → no partySize, no invented facts', () => {
    const f = factsOf({ 旅遊人數: '一家人' })
    expect(f.partySize).toBeUndefined()
    expect(f.adults).toBeUndefined()
    expect(f.children).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 飛行班次 / 包車車型 / 行程框架 → searchable facts
// ---------------------------------------------------------------------------

describe('flight / vehicle / itinerary facts', () => {
  it('飛行班次 → facts.flightInfo (raw text preserved)', () => {
    expect(factsOf({ 飛行班次: 'TG635 抵 0815' }).flightInfo).toBe('TG635 抵 0815')
  })

  it('包車車型 → facts.vehicleType, never pickupInfo', () => {
    const f = factsOf({ 包車車型: 'Alphard 大車 *1' })
    expect(f.vehicleType).toBe('Alphard 大車 *1')
    expect(f.pickupInfo).toBeUndefined()
  })

  it('行程框架 → facts.itinerarySnippet (searchable text)', () => {
    const f = factsOf({ 行程框架: '清邁親子 5 天：動物園 + 叢林飛索' })
    expect(f.itinerarySnippet).toBe('清邁親子 5 天：動物園 + 叢林飛索')
  })
})

// ---------------------------------------------------------------------------
// 總成本 / 總收入 / 利潤 → privateContext only, NEVER facts
// ---------------------------------------------------------------------------

describe('cost / revenue / profit are private only', () => {
  it('總成本 → privateContext.cost; 總收入 → privateContext.revenue', () => {
    const record = notionPageToRagRecord(familyPage, { sourceTable: 'private_2026' })
    expect(record.privateContext?.cost).toBe(22000)
    expect(record.privateContext?.revenue).toBe(30000)
  })

  it('利潤 → privateContext.profitShare', () => {
    const record = notionPageToRagRecord(familyPage, { sourceTable: 'private_2026' })
    expect(record.privateContext?.profitShare).toBe('8000')
  })

  it('no money value ever lands in facts', () => {
    const record = notionPageToRagRecord(familyPage, { sourceTable: 'private_2026' })
    const factsJson = JSON.stringify(record.facts)
    expect(factsJson).not.toContain('22000') // cost
    expect(factsJson).not.toContain('30000') // revenue
    expect(factsJson).not.toContain('8000') // profit
  })
})

// ---------------------------------------------------------------------------
// area/theme are DERIVED from 行程框架 by the deterministic parser (no explicit
// column), but unrecognised text is still never invented.
// ---------------------------------------------------------------------------

describe('area/theme derived from 行程框架 (deterministic parser)', () => {
  it('derives recognised area/theme tokens from the real-schema corpus', () => {
    // 行程框架: '清邁親子 5 天：動物園 + 叢林飛索 + 夜間動物園 + 大象保護營'
    // 親子 → family leads (GAP-2); zoo/zipline lift too, ordered by appearance.
    const f = factsOf(familyPage.properties)
    expect(f.areaHints).toEqual(['chiangmai'])
    expect(f.themeHints).toEqual(['family', 'zoo', 'zipline', 'night_safari', 'elephant'])
  })

  it('still invents nothing for unrecognised itinerary text', () => {
    const f = factsOf({ 行程框架: '完全沒聽過的地名 xyz' })
    expect(f.areaHints).toBeUndefined()
    expect(f.themeHints).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// partySize is queryable (exact match) and fingerprints stay distinct
// ---------------------------------------------------------------------------

describe('partySize is an exact-match query dimension', () => {
  it('queryRagIndex filters by partySize', () => {
    const records = notionPagesToRagRecords(REAL_2026_FIXTURE_PAGES, {
      sourceTable: 'private_2026',
    })
    const index = buildRagIndex(records)
    const four = queryRagIndex(index, { partySize: 4 })
    expect(four.map((r) => r.identity.sourceRecordIds[0])).toEqual(['real-family-cm-5d'])
  })

  it('distinct real cases keep distinct fingerprints (no collapse/merge)', () => {
    const records = notionPagesToRagRecords(REAL_2026_FIXTURE_PAGES, {
      sourceTable: 'private_2026',
    })
    const index = buildRagIndex(records)
    expect(index.records).toHaveLength(REAL_2026_FIXTURE_PAGES.length)
    const fingerprints = new Set(index.records.map((r) => r.fingerprint))
    expect(fingerprints.size).toBe(REAL_2026_FIXTURE_PAGES.length)
  })
})

// ---------------------------------------------------------------------------
// end-to-end partner-safe projection never leaks money / id / customer name
// ---------------------------------------------------------------------------

describe('partner-safe view stays clean for the real corpus', () => {
  it('keeps flightInfo/vehicleType but drops every private field', () => {
    const records = notionPagesToRagRecords(REAL_2026_FIXTURE_PAGES, {
      sourceTable: 'private_2026',
    })
    const view = toPartnerSafeView(buildRagIndex(records).records[0])
    const serialized = JSON.stringify(view)

    expect(view.facts.flightInfo).toBeTruthy()
    expect(view.facts.vehicleType).toBeTruthy()
    expect('privateContext' in view).toBe(false)
    expect(serialized).not.toContain('22000') // cost
    expect(serialized).not.toContain('30000') // revenue
    expect(serialized).not.toContain('8000') // profit
    expect(serialized).not.toContain('王先生') // customer name
    expect(serialized).not.toContain(REAL_2026_FIXTURE_DATABASE_ID)
  })
})
