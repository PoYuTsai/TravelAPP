/**
 * notion-rag-family-theme.test.ts  (GAP-2)
 *
 * Fixture-first, NO real Notion, NO network, NO env, NO LLM, NO scheduler/cache,
 * NO Sanity, NO LINE live path.
 *
 * GAP-2 reverses a v1 decision: "family/kids" used to be a STRUCTURAL-only fact
 * (children / partySize) that retrieval never lifted as a theme, so a 親子 query
 * could only hit family cases via their activity themes. That was unstable.
 *
 * This suite locks the new contract: family/kids is a canonical THEME signal that
 * lines up on BOTH sides:
 *   - query parser:   親子 / 小孩 / 小朋友 / 兒童 / family / kids → theme `family`
 *   - ingestion:      a 行程框架 with a family/child word, OR a 旅遊人數 with an
 *                     explicit child count / family word → record themeHints
 *                     gains `family`
 *   - NEVER from partySize alone: an adults-only / bare-headcount party is not
 *     family.
 *   - partner/operator projection still exposes only structured facts and drops
 *     every private field.
 */

import { describe, it, expect } from 'vitest'
import { parseRagQuery, retrieveRagCases } from '../notion/rag-query'
import { buildRagIndex, toPartnerSafeView } from '../notion/rag-index'
import { notionPageToRagRecord, notionPagesToRagRecords } from '../notion/notion-rag-adapter'
import type { NotionPageFixture } from '../notion/types'

const DB = 'fixture-db-gap2'
const page = (id: string, properties: Record<string, unknown>): NotionPageFixture => ({
  id,
  databaseId: DB,
  properties,
})
const idsOf = <T extends { identity: { sourceRecordIds: string[] } }>(records: T[]) =>
  records.map((r) => r.identity.sourceRecordIds[0])

// ---------------------------------------------------------------------------
// 1–3. query parser: family/kids words become the canonical `family` theme
// ---------------------------------------------------------------------------

describe('parseRagQuery — family/kids is a theme signal', () => {
  it('1. 清邁 親子 5天 大象 → themes include family (alongside elephant)', () => {
    const q = parseRagQuery('清邁 親子 5天 大象')
    expect(q.areas).toEqual(['chiangmai'])
    expect(q.themes).toContain('family')
    expect(q.themes).toContain('elephant')
  })

  it('2. 小朋友 夜間動物園 → family + night_safari', () => {
    const q = parseRagQuery('小朋友 夜間動物園')
    expect(q.themes).toEqual(['family', 'night_safari'])
  })

  it('3. family kids chiangmai → family (deduped) + area chiangmai', () => {
    const q = parseRagQuery('family kids chiangmai')
    expect(q.themes).toEqual(['family'])
    expect(q.areas).toEqual(['chiangmai'])
  })
})

// ---------------------------------------------------------------------------
// 4. ingestion: itinerary OR party free-text with a child/family signal → family
// 6. adults-only / bare headcount → NEVER family
// ---------------------------------------------------------------------------

describe('ingestion — family theme from explicit child/family signal only', () => {
  it('4a. 行程框架 含 親子 (no explicit column) → themeHints include family', () => {
    const record = notionPageToRagRecord(
      page('fam-itinerary', { 行程框架: '清邁親子 5 天：大象', 旅遊人數: '3人' }),
      { sourceTable: 'private_2026' }
    )
    expect(record.facts.themeHints).toContain('family')
  })

  it('4b. 旅遊人數 含 小朋友 (itinerary has no family word) → themeHints include family', () => {
    const record = notionPageToRagRecord(
      page('fam-party', {
        行程框架: '清邁 5 天：大象 + 夜間動物園',
        旅遊人數: '成人2 小朋友2',
      }),
      { sourceTable: 'private_2026' }
    )
    expect(record.facts.themeHints).toContain('family')
    // existing activity themes are preserved, not replaced
    expect(record.facts.themeHints).toEqual(expect.arrayContaining(['elephant', 'night_safari']))
    expect(record.facts.children).toBe(2)
  })

  it('6a. 純 6人 (bare headcount, adults-only itinerary) → NOT family', () => {
    const record = notionPageToRagRecord(
      page('adults-bigparty', { 行程框架: '清邁包車 5 天：咖啡 + 按摩', 旅遊人數: '6人' }),
      { sourceTable: 'private_2026' }
    )
    expect(record.facts.partySize).toBe(6)
    expect(record.facts.themeHints ?? []).not.toContain('family')
  })

  it('6b. 成人9 (adults only, no child word) → NOT family', () => {
    const record = notionPageToRagRecord(
      page('adults-only', { 行程框架: '清邁 大象', 旅遊人數: '成人9' }),
      { sourceTable: 'private_2026' }
    )
    expect(record.facts.adults).toBe(9)
    expect(record.facts.themeHints ?? []).not.toContain('family')
  })
})

// ---------------------------------------------------------------------------
// 5. retrieval: a family query prioritises a family-ish case over a plain
//    same-area distractor
// ---------------------------------------------------------------------------

describe('retrieveRagCases — family query prioritises family-ish case', () => {
  const famParty = page('cm-family', {
    行程框架: '清邁 5 天：大象 + 夜間動物園',
    旅遊人數: '成人2 小朋友2',
  })
  const honeymoon = page('cm-honeymoon', {
    行程框架: '清邁蜜月 3 天：咖啡廳 + 按摩',
    旅遊人數: '成人2',
  })
  const index = buildRagIndex(
    notionPagesToRagRecords([honeymoon, famParty], { sourceTable: 'private_2026' })
  )

  it('5. 清邁 親子 → family-ish CM case ranks first, honeymoon distractor below', () => {
    const out = retrieveRagCases(index, '清邁 親子')
    expect(idsOf(out)[0]).toBe('cm-family')
    // the family case matches area + family theme (2 dims); honeymoon only area (1)
    expect(out[0].facts.themeHints).toContain('family')
  })
})

// ---------------------------------------------------------------------------
// 7. partner-safe projection still drops private context after family is added
// ---------------------------------------------------------------------------

describe('partner-safe view — family theme adds no privacy leak', () => {
  it('7. exposes family theme as a structured fact, drops cost / private context', () => {
    const record = notionPageToRagRecord(
      page('fam-private', {
        行程框架: '清邁 5 天：大象',
        旅遊人數: '成人2 小朋友2',
        總成本: 22000,
        客人姓名: '王先生',
      }),
      { sourceTable: 'private_2026' }
    )
    const view = toPartnerSafeView(record)
    const serialized = JSON.stringify(view)

    expect(view.facts.themeHints).toContain('family')
    expect('privateContext' in view).toBe(false)
    expect(serialized).not.toContain('22000') // cost
    expect(serialized).not.toContain('王先生') // guest name never enters facts at all
  })
})
