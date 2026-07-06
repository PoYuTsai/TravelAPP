/**
 * notion-rag-retrieval-quality.test.ts
 *
 * Retrieval-quality contract for the Notion RAG index (v1). Fixture-first, NO
 * real Notion, NO network, NO env, NO LLM, NO weighted scorer. Proves that a
 * free-text customer-style query is parsed into the SAME canonical area/theme
 * vocabulary the corpus was ingested with (parseItineraryHints), then retrieves
 * and ranks the right CASE TYPE — never a report, never a vehicle commitment.
 *
 * Design rules under test (locked):
 *   - The query parser only emits tokens that exist in the area/theme vocab.
 *     Out-of-vocab words (5天 / 金三角 / 包車 / 東京 / 滑雪) contribute NOTHING —
 *     area/theme stay empty rather than being invented. As of GAP-2,
 *     "family/kids" (親子 / 小孩 / 小朋友 / 兒童 / family / kids) IS in the theme
 *     vocab → it lifts the canonical `family` theme, so a 親子 query and a 親子 /
 *     小朋友 corpus record line up on the same token (children / partySize stay a
 *     further structural fact on top).
 *   - Multiple areas are OR-gated and each hit counts as a matched dimension, so
 *     a case covering more of the asked areas ranks above a partial match.
 *   - partySize is a usable structural retrieval signal, but retrieval NEVER
 *     asserts a vehicle type or a quote.
 *   - A query that parses to zero usable signal returns EMPTY (low confidence),
 *     never the whole corpus.
 */

import { describe, it, expect } from 'vitest'
import {
  buildRagIndexRecord,
  buildRagIndex,
  queryRagIndex,
  type RagCaseFacts,
  type RagIndexRecord,
} from '../notion/rag-index'
import { parseRagQuery, retrieveRagCases } from '../notion/rag-query'

// ---------------------------------------------------------------------------
// Fixture corpus — canonical snake_case hints, exactly as the real private_2026
// corpus carries them after parseItineraryHints. All private_2026 so ranking is
// decided by matched dimensions, not source priority (mirrors reality).
// ---------------------------------------------------------------------------

function rec(id: string, facts: RagCaseFacts): RagIndexRecord {
  return buildRagIndexRecord({
    identity: { sourceRecordIds: [id], sourceTables: ['private_2026'] },
    facts,
    audience: 'partner_group',
  })
}

// A — Chiang Mai family: elephant + night safari (the scenario-1 target)
const cmFamilyElephant = rec('cm-fam-elephant', {
  days: 5,
  nights: 4,
  partySize: 4,
  adults: 2,
  children: 2,
  childAges: [5, 8],
  areaHints: ['chiangmai'],
  themeHints: ['elephant', 'night_safari'],
})

// B — Chiang Mai honeymoon: cafe + massage (a chiangmai distractor)
const cmHoneymoon = rec('cm-honeymoon', {
  days: 3,
  nights: 2,
  partySize: 2,
  adults: 2,
  children: 0,
  areaHints: ['chiangmai'],
  themeHints: ['cafe', 'massage'],
})

// C — Chiang Rai + Fang golden-triangle temple run (covers BOTH asked areas)
const chiangraiFangTemple = rec('cr-fang-temple', {
  days: 2,
  nights: 1,
  partySize: 4,
  areaHints: ['chiangrai', 'fang'],
  themeHints: ['temple'],
})

// D — Chiang Rai only: white-temple photo (partial match for scenario 2)
const chiangraiPhoto = rec('cr-photo', {
  days: 1,
  partySize: 2,
  areaHints: ['chiangrai'],
  themeHints: ['temple', 'photo'],
})

// E — Mae Kampong zipline + cafe (the scenario-3 target)
const maeKampongZipline = rec('mk-zipline', {
  days: 1,
  partySize: 3,
  areaHints: ['mae_kampong'],
  themeHints: ['zipline', 'cafe'],
})

// F — Lampang one-day temple (the scenario-4 target)
const lampangOneDay = rec('lampang-1d', {
  days: 1,
  partySize: 2,
  areaHints: ['lampang'],
  themeHints: ['temple'],
})

// G — Inthanon family adventure (the scenario-5 target)
const inthanonFamily = rec('inthanon-fam', {
  days: 2,
  nights: 1,
  partySize: 4,
  adults: 2,
  children: 2,
  childAges: [6, 9],
  areaHints: ['inthanon'],
  themeHints: ['adventure'],
})

// H — Big-party Chiang Mai shopping run on a Commuter (the scenario-6 target).
// Also a chiangmai case, so scenario 1 must NOT mis-rank it above A.
const bigPartyCommuter = rec('cm-bigparty', {
  days: 4,
  partySize: 6,
  areaHints: ['chiangmai'],
  themeHints: ['shopping'],
  vehicleType: 'Commuter',
})

const index = buildRagIndex([
  cmFamilyElephant,
  cmHoneymoon,
  chiangraiFangTemple,
  chiangraiPhoto,
  maeKampongZipline,
  lampangOneDay,
  inthanonFamily,
  bigPartyCommuter,
])

const idsOf = (records: RagIndexRecord[]) =>
  records.map((r) => r.identity.sourceRecordIds[0])

// ---------------------------------------------------------------------------
// Query parser — only vocab tokens survive; out-of-vocab words drop out.
// ---------------------------------------------------------------------------

describe('parseRagQuery — vocab-bounded, never invents', () => {
  it('lifts only in-vocab area/theme tokens; 親子 → family theme, 5天 drops out', () => {
    const q = parseRagQuery('清邁 親子 5天 大象 夜間動物園')
    expect(q.areas).toEqual(['chiangmai'])
    // 親子 → family (GAP-2): family/kids is a canonical theme, not structural-only.
    expect(q.themes).toEqual(['family', 'elephant', 'night_safari'])
    expect(q.partySize).toBeUndefined()
  })

  it('parses a party size but leaves 包車 unmapped (no vehicle commitment)', () => {
    const q = parseRagQuery('6人 包車')
    expect(q.partySize).toBe(6)
    expect(q.areas).toEqual([])
    expect(q.themes).toEqual([])
  })

  it('returns no usable signal for a wholly out-of-vocab query', () => {
    const q = parseRagQuery('東京 滑雪')
    expect(q.areas).toEqual([])
    expect(q.themes).toEqual([])
    expect(q.partySize).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// queryRagIndex — multi-area OR gate + matched-dimension ranking
// ---------------------------------------------------------------------------

describe('queryRagIndex — multiple areas', () => {
  it('OR-gates areas and ranks a case covering more asked areas first', () => {
    const out = queryRagIndex(index, { areas: ['chiangrai', 'fang'] })
    expect(idsOf(out)).toEqual(['cr-fang-temple', 'cr-photo'])
  })
})

// ---------------------------------------------------------------------------
// Retrieval-quality scenarios (free-text → ranked case types)
// ---------------------------------------------------------------------------

describe('retrieveRagCases — scenario retrieval quality', () => {
  it('1. 清邁 親子 5天 大象 夜間動物園 → CM family elephant/night-safari first', () => {
    const out = retrieveRagCases(index, '清邁 親子 5天 大象 夜間動物園')
    expect(out[0].identity.sourceRecordIds[0]).toBe('cm-fam-elephant')
    // these fixtures carry no `family` theme, so ranking here is decided purely by
    // the activity-theme match; the family-theme retrieval contract lives in
    // notion-rag-family-theme.test.ts. The matched case still IS a family one.
    expect(out[0].facts.children).toBeGreaterThan(0)
    // the big-party chiangmai case must not outrank the activity match
    expect(out[0].identity.sourceRecordIds[0]).not.toBe('cm-bigparty')
  })

  it('2. 清萊 芳縣 金三角 → chiangrai/fang cases, golden-triangle combo first', () => {
    const out = retrieveRagCases(index, '清萊 芳縣 金三角')
    expect(out[0].identity.sourceRecordIds[0]).toBe('cr-fang-temple')
    expect(idsOf(out)).toContain('cr-photo')
    // never bleeds into an unrelated area
    expect(idsOf(out)).not.toContain('mk-zipline')
  })

  it('3. 湄康蓬 飛索 咖啡 → mae_kampong zipline+cafe first', () => {
    const out = retrieveRagCases(index, '湄康蓬 飛索 咖啡')
    expect(out[0].identity.sourceRecordIds[0]).toBe('mk-zipline')
  })

  it('4. 南邦 一日 → lampang case (一日 ignored, not over-constrained)', () => {
    const out = retrieveRagCases(index, '南邦 一日')
    expect(idsOf(out)).toContain('lampang-1d')
    expect(idsOf(out)).not.toContain('cm-honeymoon')
  })

  it('5. 茵他儂 親子 → inthanon family case', () => {
    const out = retrieveRagCases(index, '茵他儂 親子')
    expect(out[0].identity.sourceRecordIds[0]).toBe('inthanon-fam')
    expect(out[0].facts.children).toBeGreaterThan(0)
  })

  it('6. 6人 包車 → surfaces the large-party case via partySize, no vehicle promise', () => {
    const out = retrieveRagCases(index, '6人 包車')
    expect(idsOf(out)).toEqual(['cm-bigparty'])
    // retrieval returns the case but does NOT itself commit to a vehicle type:
    // the assertion is purely on which case surfaced, not on any vehicle claim.
  })

  it('7. unknown query does not bleed into unrelated cases (empty / low confidence)', () => {
    expect(retrieveRagCases(index, '東京 滑雪')).toEqual([])
    // a lone out-of-vocab place name (金三角) is also not enough signal on its own
    expect(retrieveRagCases(index, '金三角')).toEqual([])
  })
})
