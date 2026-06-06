/**
 * notion-rag-answer-composer.test.ts
 *
 * M3.1 — RAG-assisted answer composer (pure, deterministic).
 *
 * Pins the answer CONTRACT before any trigger wiring, CLI preview, or LLM
 * phrasing. The composer turns an already-operator-safe `NotionRagSearchResult`
 * into a **partner-group draft** an operator can review and (later, separately)
 * send. No LLM, no CLI, no LINE live path, no Sanity, no Notion API.
 *
 * Eight locked behaviors (design: docs/plans/2026-06-06-line-oa-m3-1-answer-composer-design.md):
 *   1. high confidence + results → text 含「內部過往案例傾向」; usedInternalReferences true
 *   2. empty / low_confidence → text 含「目前沒有強內部參考」; usedInternalReferences false; confidence 'low'
 *   3. output never leaks customer name / cost / revenue / profit / db id / Notion URL
 *   4. partySize >= 6 → vehicleHint 含 Toyota Commuter 10 人座 Van 方向; mustConfirm 含行李/導遊/兒童座椅/上車地點; no price; no final commit
 *   5. airport transfer + many luggage → mustConfirm 含行李件數與尺寸; safetyNotes 提及行李車 / 第二台車
 *   6. base mustConfirm 一律涵蓋: 日期、人數、小孩年齡/身高、航班、住宿/上車地點
 *   7. options.refine defaults false → injected refine hook is never invoked (spy call count 0)
 *   8. output target is a partner-group draft (phrasing marker), NOT a customer-facing reply (no auto-reply opener)
 */

import { describe, it, expect, vi } from 'vitest'
import {
  composeAnswer,
  transportationAssessment,
} from '../notion/notion-rag-answer-composer'
import type { NotionRagSearchResult } from '../notion/notion-rag-search'

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function okSearch(
  overrides: Partial<NotionRagSearchResult> = {}
): NotionRagSearchResult {
  return {
    status: 'ok',
    parsedQuery: { areas: ['古城區'], themes: ['親子'] },
    totalRecords: 20,
    resultCount: 2,
    results: [
      { areaHints: ['古城區'], themeHints: ['親子'], days: 4, nights: 3, partySize: 4, vehicleType: 'Toyota Commuter' },
      { areaHints: ['古城區'], themeHints: ['親子'], days: 3, nights: 2, partySize: 5 },
    ],
    ...overrides,
  }
}

function lowSearch(
  overrides: Partial<NotionRagSearchResult> = {}
): NotionRagSearchResult {
  return {
    status: 'low_confidence',
    parsedQuery: { areas: [], themes: [] },
    totalRecords: 20,
    resultCount: 0,
    results: [],
    ...overrides,
  }
}

/** Tokens that must NEVER appear in any composed partner draft. */
const FORBIDDEN_TOKENS = [
  'notion.so',
  'http',
  'database',
  'revenue',
  'profit',
  '營收',
  '利潤',
  '成本',
  '$',
  'NT$',
  '元', // any concrete currency amount marker
]

// ---------------------------------------------------------------------------
// composeAnswer — confidence + tone
// ---------------------------------------------------------------------------

describe('composeAnswer — confidence & internal-reference framing', () => {
  it('high confidence + results → uses internal-tendency framing', () => {
    const out = composeAnswer({ userQuestion: '古城區親子4天', search: okSearch() })

    expect(out.usedInternalReferences).toBe(true)
    expect(out.confidence).toBe('high')
    expect(out.text).toContain('內部過往案例傾向')
  })

  it('empty / low_confidence → no-strong-reference framing', () => {
    const out = composeAnswer({ userQuestion: '冷門需求', search: lowSearch() })

    expect(out.usedInternalReferences).toBe(false)
    expect(out.confidence).toBe('low')
    expect(out.text).toContain('目前沒有強內部參考')
  })

  it('ok status but only partySize signal (no area/theme) → medium confidence', () => {
    const search = okSearch({
      parsedQuery: { areas: [], themes: [], partySize: 6 },
    })
    const out = composeAnswer({ userQuestion: '6人', search })

    expect(out.usedInternalReferences).toBe(true)
    expect(out.confidence).toBe('medium')
  })
})

// ---------------------------------------------------------------------------
// composeAnswer — privacy
// ---------------------------------------------------------------------------

describe('composeAnswer — privacy', () => {
  it('never leaks customer name / cost / revenue / profit / db id / Notion URL', () => {
    const out = composeAnswer({
      userQuestion: '古城區親子',
      search: okSearch(),
      transportation: { partySize: 6, airportTransfer: true, luggageCount: 8 },
    })

    const haystack = [out.text, ...out.mustConfirm, ...(out.safetyNotes ?? [])]
      .join('\n')
      .toLowerCase()
    for (const token of FORBIDDEN_TOKENS) {
      expect(haystack).not.toContain(token.toLowerCase())
    }
  })
})

// ---------------------------------------------------------------------------
// composeAnswer — base mustConfirm (contract 6)
// ---------------------------------------------------------------------------

describe('composeAnswer — base mustConfirm', () => {
  it('always covers 日期 / 人數 / 小孩年齡身高 / 航班 / 住宿上車地點', () => {
    const out = composeAnswer({ userQuestion: '隨便問', search: lowSearch() })
    const joined = out.mustConfirm.join('|')

    expect(joined).toContain('日期')
    expect(joined).toContain('人數')
    expect(joined).toMatch(/小孩.*(年齡|身高)/)
    expect(joined).toContain('航班')
    expect(joined).toMatch(/(住宿|上車地點)/)
  })
})

// ---------------------------------------------------------------------------
// composeAnswer — refine hook never invoked (contract 7)
// ---------------------------------------------------------------------------

describe('composeAnswer — refine hook', () => {
  it('defaults refine false and never invokes the injected LLM hook', () => {
    const spy = vi.fn((draft: string) => draft + ' [refined]')

    const out = composeAnswer({
      userQuestion: '古城區親子',
      search: okSearch(),
      options: { refineHook: spy },
    })

    expect(spy).toHaveBeenCalledTimes(0)
    expect(out.text).not.toContain('[refined]')
  })
})

// ---------------------------------------------------------------------------
// composeAnswer — partner-group draft target (contract 8)
// ---------------------------------------------------------------------------

describe('composeAnswer — output target is a partner-group draft', () => {
  it('carries a partner-group draft marker', () => {
    const out = composeAnswer({ userQuestion: '古城區親子', search: okSearch() })
    expect(out.text).toContain('夥伴群草稿')
  })

  it('does NOT open like a customer-facing auto-reply', () => {
    const out = composeAnswer({ userQuestion: '古城區親子', search: okSearch() })
    // no direct customer salutation / auto-reply opener
    expect(out.text).not.toMatch(/^(您好|親愛的|哈囉|Hi|Dear)/m)
    expect(out.text).not.toContain('感謝您的詢問')
  })
})

// ---------------------------------------------------------------------------
// transportationAssessment helper
// ---------------------------------------------------------------------------

describe('transportationAssessment — party size direction (contract 4)', () => {
  it('partySize >= 6 → big-van direction + luggage/guide/childseat/pickup mustConfirm, no price, no final commit', () => {
    const ta = transportationAssessment({ partySize: 6 })

    expect(ta.vehicleHint).toBeDefined()
    expect(ta.vehicleHint).toContain('Toyota Commuter 10 人座 Van')
    // direction only — never a commitment
    expect(ta.vehicleHint).not.toMatch(/一定|保證|確定派|固定派/)

    const mc = ta.mustConfirm.join('|')
    expect(mc).toContain('行李件數與尺寸')
    expect(mc).toMatch(/兒童座椅/)
    expect(mc).toMatch(/導遊/)
    expect(mc).toMatch(/上車地點|住宿/)

    // no price anywhere
    const blob = [ta.vehicleHint ?? '', ...ta.mustConfirm, ...ta.safetyNotes].join('\n')
    expect(blob).not.toMatch(/\$|NT\$|元|報價|價格/)
  })

  it('vehicleTypeFromCases → frames as internal similar-case direction, never a fixed dispatch', () => {
    const ta = transportationAssessment({ vehicleTypeFromCases: ['Toyota Commuter'] })
    expect(ta.vehicleHint).toContain('內部相似案例')
    expect(ta.vehicleHint).not.toMatch(/一定派|保證/)
  })
})

describe('transportationAssessment — airport + luggage (contract 5)', () => {
  it('airport transfer + many luggage → mustConfirm 行李件數與尺寸; safetyNotes 行李車/第二台車', () => {
    const ta = transportationAssessment({
      partySize: 4,
      airportTransfer: true,
      luggageCount: 8,
    })

    expect(ta.mustConfirm.join('|')).toContain('行李件數與尺寸')
    expect(ta.safetyNotes.join('|')).toMatch(/行李車|第二台車/)
  })
})

describe('transportationAssessment — guardrails', () => {
  it('does NOT treat partySize > 1 as family', () => {
    const ta = transportationAssessment({ partySize: 3 })
    const blob = [ta.vehicleHint ?? '', ...ta.mustConfirm, ...ta.safetyNotes].join('\n')
    expect(blob).not.toContain('親子')
    expect(blob).not.toContain('家庭')
  })

  it('insufficient data (no partySize / no cases) → only asks to confirm headcount & luggage first', () => {
    const ta = transportationAssessment({})
    expect(ta.vehicleHint).toBeUndefined()
    const blob = [...ta.mustConfirm, ...ta.safetyNotes].join('|')
    expect(blob).toMatch(/人數|行李/)
  })
})
