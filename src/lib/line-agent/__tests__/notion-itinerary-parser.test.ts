/**
 * notion-itinerary-parser.test.ts
 *
 * Deterministic 行程框架 → area/theme parser knife (fixture-only, no network,
 * no LLM, no real db id, no customer dump).
 *
 * The real private_2026 corpus has NO explicit 城市區域 / 行程類型 column — the
 * area/theme signal is buried in the free-text 行程框架. This parser extracts it
 * with a strict whitelist alias table:
 *   - recognised Chinese place / theme tokens → canonical snake_case hints
 *   - longest-alias-first so 夜間動物園 → night_safari (never also zoo)
 *   - unrecognised text contributes NOTHING (no invented tokens)
 *
 * Contract (Eric, 2026-06-06):
 *   1. 清邁一日              → area chiangmai
 *   2. 清萊 -> 芳縣          → area chiangrai + fang
 *   3. 大象 + 夜間動物園     → theme elephant + night_safari
 *   4. 茵他儂               → area inthanon
 *   5. 湄康蓬               → area mae_kampong
 *   6. 南邦                 → area lampang
 *   7. 南奔                 → area lamphun
 *   8. unrecognised text   → no invented hints
 *   9. parsed hints feed RagIndex query/filter end-to-end
 *  10. partner-safe view exposes the hints but NEVER private context
 */

import { describe, it, expect } from 'vitest'
import { parseItineraryHints } from '../notion/itinerary-parser'
import { notionPagesToRagRecords } from '../notion/notion-rag-adapter'
import { buildRagIndex, queryRagIndex, toPartnerSafeView } from '../notion/rag-index'
import {
  REAL_2026_FIXTURE_PAGES,
  REAL_2026_FIXTURE_DATABASE_ID,
} from '../notion/__fixtures__/real-2026-schema'

// ---------------------------------------------------------------------------
// 1–2: area extraction
// ---------------------------------------------------------------------------

describe('parseItineraryHints — area tokens', () => {
  it('清邁一日 → area chiangmai (一日 noise ignored)', () => {
    const hints = parseItineraryHints('清邁一日')
    expect(hints.areaHints).toEqual(['chiangmai'])
    expect(hints.themeHints).toEqual([])
  })

  it('清萊 -> 芳縣 → area chiangrai + fang (order by appearance)', () => {
    const hints = parseItineraryHints('清萊 -> 芳縣')
    expect(hints.areaHints).toEqual(['chiangrai', 'fang'])
    expect(hints.themeHints).toEqual([])
  })

  it('茵他儂 → area inthanon', () => {
    expect(parseItineraryHints('茵他儂').areaHints).toEqual(['inthanon'])
  })

  it('湄康蓬 → area mae_kampong', () => {
    expect(parseItineraryHints('湄康蓬').areaHints).toEqual(['mae_kampong'])
  })

  it('南邦 → area lampang', () => {
    expect(parseItineraryHints('南邦').areaHints).toEqual(['lampang'])
  })

  it('南奔 → area lamphun (distinct from 南邦)', () => {
    expect(parseItineraryHints('南奔').areaHints).toEqual(['lamphun'])
  })
})

// ---------------------------------------------------------------------------
// 3: theme extraction + longest-alias-first
// ---------------------------------------------------------------------------

describe('parseItineraryHints — theme tokens', () => {
  it('大象 + 夜間動物園 → theme elephant + night_safari', () => {
    const hints = parseItineraryHints('大象 + 夜間動物園')
    expect(hints.themeHints).toEqual(['elephant', 'night_safari'])
    expect(hints.areaHints).toEqual([])
  })

  it('夜間動物園 → night_safari only, never a stray zoo token', () => {
    const hints = parseItineraryHints('夜間動物園')
    expect(hints.themeHints).toEqual(['night_safari'])
  })
})

// ---------------------------------------------------------------------------
// expanded theme vocabulary (Eric, 2026-06-06) — theme 詞庫 was too thin
// (distinct theme tokens stuck at 2). Each row below is a NEW canonical theme.
// ---------------------------------------------------------------------------

describe('parseItineraryHints — expanded theme vocabulary', () => {
  // zoo vs night_safari: longest-alias-first must keep the two distinct.
  it('清邁動物園 → area chiangmai + theme zoo', () => {
    const hints = parseItineraryHints('清邁動物園')
    expect(hints.areaHints).toEqual(['chiangmai'])
    expect(hints.themeHints).toEqual(['zoo'])
  })

  it('大象 + 夜間動物園 stays elephant + night_safari (never a stray zoo)', () => {
    const hints = parseItineraryHints('大象 + 夜間動物園')
    expect(hints.themeHints).toEqual(['elephant', 'night_safari'])
    expect(hints.themeHints).not.toContain('zoo')
  })

  it('夜間動物園 + 清邁動物園 → night_safari AND a standalone zoo (distinct activities)', () => {
    const hints = parseItineraryHints('夜間動物園 + 清邁動物園')
    expect(hints.themeHints).toEqual(['night_safari', 'zoo'])
  })

  // zipline — generic 飛索 plus named operators, all collapse to one token.
  it('飛索 / 叢林飛索 / Kingkong / Pongyang → zipline (deduped)', () => {
    expect(parseItineraryHints('飛索 / 叢林飛索 / Kingkong / Pongyang').themeHints).toEqual([
      'zipline',
    ])
  })

  it('Jungle Flight → zipline', () => {
    expect(parseItineraryHints('Jungle Flight').themeHints).toEqual(['zipline'])
  })

  // cafe — Chinese head noun + English token.
  it('咖啡廳 / cafe → cafe (deduped)', () => {
    expect(parseItineraryHints('咖啡廳 / cafe').themeHints).toEqual(['cafe'])
  })

  // market — generic 市集/夜市 head nouns + named market 瓦洛洛.
  it('真心市集 / 椰林市集 / 夜市 / 瓦洛洛 → market (deduped)', () => {
    expect(parseItineraryHints('真心市集 / 椰林市集 / 夜市 / 瓦洛洛').themeHints).toEqual(['market'])
  })

  it('massage: 按摩 → massage', () => {
    expect(parseItineraryHints('按摩').themeHints).toEqual(['massage'])
  })

  // photo — 泰服 / 拍照 / 攝影 / 網美 all collapse to photo.
  it('泰服拍照 / 攝影 → photo (deduped)', () => {
    expect(parseItineraryHints('泰服拍照 / 攝影').themeHints).toEqual(['photo'])
  })

  // temple — generic 寺/廟 head nouns cover named temples.
  it('藍廟 / 白廟 / 柴迪隆寺 / 帕辛寺 → temple (deduped)', () => {
    expect(parseItineraryHints('藍廟 / 白廟 / 柴迪隆寺 / 帕辛寺').themeHints).toEqual(['temple'])
  })

  // shopping — Big C / 採買 / 伴手禮.
  it('Big C 採買 / 伴手禮 → shopping (deduped)', () => {
    expect(parseItineraryHints('Big C 採買 / 伴手禮').themeHints).toEqual(['shopping'])
  })

  // adventure — Phoenix Adventure / ATV / 越野 / 冒險.
  it('Phoenix Adventure / ATV → adventure (deduped)', () => {
    expect(parseItineraryHints('Phoenix Adventure / ATV').themeHints).toEqual(['adventure'])
  })

  it('越野冒險 → adventure', () => {
    expect(parseItineraryHints('越野冒險').themeHints).toEqual(['adventure'])
  })

  it('still invents nothing for unrecognised activity text', () => {
    expect(parseItineraryHints('完全沒聽過的活動 qwerty').themeHints).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 8: never invent tokens for unrecognised text
// ---------------------------------------------------------------------------

describe('parseItineraryHints — strict whitelist (no invention)', () => {
  it('unrecognised text → empty hints', () => {
    const hints = parseItineraryHints('完全沒聽過的地名 xyz123')
    expect(hints.areaHints).toEqual([])
    expect(hints.themeHints).toEqual([])
  })

  it('empty / whitespace → empty hints', () => {
    expect(parseItineraryHints('   ')).toEqual({ areaHints: [], themeHints: [] })
    expect(parseItineraryHints('')).toEqual({ areaHints: [], themeHints: [] })
  })

  it('dedupes a token repeated in the text', () => {
    expect(parseItineraryHints('清邁 清邁 清邁').areaHints).toEqual(['chiangmai'])
  })
})

// ---------------------------------------------------------------------------
// 9: parsed hints flow into the adapter → index → query
// ---------------------------------------------------------------------------

describe('parsed hints feed RagIndex query/filter', () => {
  it('derives areaHints/themeHints from 行程框架 when no explicit column exists', () => {
    const records = notionPagesToRagRecords(REAL_2026_FIXTURE_PAGES, {
      sourceTable: 'private_2026',
    })
    const family = records.find((r) => r.identity.sourceRecordIds[0] === 'real-family-cm-5d')!
    // 行程框架: '清邁親子 5 天：動物園 + 叢林飛索 + 夜間動物園 + 大象保護營'
    // expanded vocab now lifts all four activities, ordered by appearance;
    // 動物園 (zoo) stays distinct from 夜間動物園 (night_safari).
    expect(family.facts.areaHints).toEqual(['chiangmai'])
    expect(family.facts.themeHints).toEqual(['zoo', 'zipline', 'night_safari', 'elephant'])
  })

  it('queryRagIndex matches the derived area token', () => {
    const index = buildRagIndex(
      notionPagesToRagRecords(REAL_2026_FIXTURE_PAGES, { sourceTable: 'private_2026' })
    )
    const hits = queryRagIndex(index, { area: 'chiangmai' })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((r) => r.facts.areaHints?.includes('chiangmai'))).toBe(true)
  })

  it('queryRagIndex matches the derived theme token', () => {
    const index = buildRagIndex(
      notionPagesToRagRecords(REAL_2026_FIXTURE_PAGES, { sourceTable: 'private_2026' })
    )
    const hits = queryRagIndex(index, { themes: ['night_safari'] })
    expect(hits.map((r) => r.identity.sourceRecordIds[0])).toContain('real-family-cm-5d')
  })
})

// ---------------------------------------------------------------------------
// 10: partner-safe view exposes hints but never private context
// ---------------------------------------------------------------------------

describe('partner-safe view keeps derived hints, drops private context', () => {
  it('exposes area/theme hints yet leaks no cost / revenue / db id / name', () => {
    const index = buildRagIndex(
      notionPagesToRagRecords(REAL_2026_FIXTURE_PAGES, { sourceTable: 'private_2026' })
    )
    const family = index.records.find(
      (r) => r.identity.sourceRecordIds[0] === 'real-family-cm-5d'
    )!
    const view = toPartnerSafeView(family)
    const serialized = JSON.stringify(view)

    expect(view.facts.areaHints).toContain('chiangmai')
    expect(view.facts.themeHints).toContain('night_safari')
    expect('privateContext' in view).toBe(false)
    expect(serialized).not.toContain('22000') // cost
    expect(serialized).not.toContain('30000') // revenue
    expect(serialized).not.toContain('8000') // profit
    expect(serialized).not.toContain('王先生') // customer name
    expect(serialized).not.toContain(REAL_2026_FIXTURE_DATABASE_ID)
  })
})
