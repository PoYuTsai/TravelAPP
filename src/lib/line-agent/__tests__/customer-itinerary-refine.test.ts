/**
 * customer-itinerary-refine.test.ts
 *
 * M3.4b — LLM refine offline harness. The LLM is an UNTRUSTED polisher: it may
 * warm up customer-facing wording, but it must never alter an itinerary fact.
 * Its output is re-gated by three deterministic guards — lint, structuralDiff,
 * leak — and any failure fail-closes to the deterministic draft.
 *
 * PURE / fixture-only: no real LLM, no LINE, no Sanity, no gate flip.
 */

import { describe, it, expect } from 'vitest'
import {
  extractDraftStructure,
  structuralDiffGuard,
  scanCustomerForbiddenTerms,
  refineCustomerItineraryDraft,
} from '../notion/customer-itinerary-refine'
import {
  DETERMINISTIC_DRAFT,
  REFINE_CONSTRAINTS,
  goodPolishSource,
  structureBreakSource,
  leakySource,
  lintBreakSource,
  throwingSource,
  emptySource,
} from '../notion/__fixtures__/customer-refine-scenarios'

// ---------------------------------------------------------------------------
// extractDraftStructure
// ---------------------------------------------------------------------------

describe('extractDraftStructure', () => {
  it('lifts date/party lines and per-day activities/meals/lodging', () => {
    const s = extractDraftStructure(DETERMINISTIC_DRAFT)
    expect(s.dateLine).toBe('📅 日期：2025/08/04～2025/08/10')
    expect(s.partyLine.startsWith('👨‍👩‍👧‍👦 人數：8大')).toBe(true)
    expect(s.days).toHaveLength(7)

    const day3 = s.days.find((d) => d.day === 3)!
    expect(day3.dateLabel).toBe('8/6 (四)')
    expect(day3.heading).toBe('Day 3｜大象友善保護營・景點咖啡・清邁市區')
    expect(day3.activities).toEqual([
      '大象友善保護營（以不騎象、餵食、互動、觀察為主；需確認長輩是否方便行走與營區動線）',
      '天使瀑布',
      '清邁藍廟',
      '水果市場',
    ])
    expect(day3.lunch).toBe('營區或附近餐廳')
    expect(day3.dinner).toBe('清邁康托克帝王餐晚宴＆文化表演秀')
    expect(day3.lodging).toBe('清邁古城民宿')
  })

  it('excludes the 住宿 line from activities and reads it as lodging', () => {
    const s = extractDraftStructure(DETERMINISTIC_DRAFT)
    const day1 = s.days.find((d) => d.day === 1)!
    expect(day1.activities).not.toContain('住宿：清邁古城民宿')
    expect(day1.lodging).toBe('清邁古城民宿')
  })
})

// ---------------------------------------------------------------------------
// structuralDiffGuard
// ---------------------------------------------------------------------------

describe('structuralDiffGuard', () => {
  const guard = (ref: string) =>
    structuralDiffGuard(DETERMINISTIC_DRAFT, ref, REFINE_CONSTRAINTS)

  it('reports no issues when refined equals deterministic', () => {
    expect(guard(DETERMINISTIC_DRAFT)).toEqual([])
  })

  it('allows a header/greeting change outside day blocks', () => {
    const ref =
      DETERMINISTIC_DRAFT.replace('<李先生一家套餐訂製> ', '<李先生一家 ✦ 訂製> ') + '\n\n祝旅途愉快～'
    expect(guard(ref)).toEqual([])
  })

  it('allows punctuation/whitespace micro-adjust in a Day title', () => {
    const ref = DETERMINISTIC_DRAFT.replace(
      'Day 1｜抵達清邁・換匯入住・古城慢遊',
      'Day 1｜抵達清邁 ・ 換匯入住、古城慢遊'
    )
    expect(guard(ref)).toEqual([])
  })

  it('flags a景點名 added/removed in a Day title → day_title_fact_changed', () => {
    const ref = DETERMINISTIC_DRAFT.replace(
      'Day 1｜抵達清邁・換匯入住・古城慢遊',
      'Day 1｜抵達清邁・換匯入住・夜市慢遊'
    )
    expect(guard(ref).map((i) => i.code)).toContain('day_title_fact_changed')
  })

  it('flags a renamed activity → activity_line_changed', () => {
    expect(guard(DETERMINISTIC_DRAFT.replace('・水果市場', '・夜市')).map((i) => i.code)).toContain(
      'activity_line_changed'
    )
  })

  it('flags an added activity → activity_line_changed', () => {
    const ref = DETERMINISTIC_DRAFT.replace('・水果市場\n', '・水果市場\n・夜市\n')
    expect(guard(ref).map((i) => i.code)).toContain('activity_line_changed')
  })

  it('flags a changed lunch → lunch_changed', () => {
    const ref = DETERMINISTIC_DRAFT.replace('午餐：營區或附近餐廳', '午餐：別家餐廳')
    expect(guard(ref).map((i) => i.code)).toContain('lunch_changed')
  })

  it('flags a changed dinner → dinner_changed', () => {
    const ref = DETERMINISTIC_DRAFT.replace('晚餐：Samsen Villa', '晚餐：別家晚餐')
    expect(guard(ref).map((i) => i.code)).toContain('dinner_changed')
  })

  it('flags a changed lodging → lodging_changed', () => {
    const ref = DETERMINISTIC_DRAFT.replace('・住宿：清邁古城民宿', '・住宿：別間民宿')
    expect(guard(ref).map((i) => i.code)).toContain('lodging_changed')
  })

  it('flags a changed date line → date_changed', () => {
    const ref = DETERMINISTIC_DRAFT.replace('2025/08/04', '2025/09/04')
    expect(guard(ref).map((i) => i.code)).toContain('date_changed')
  })

  it('flags a changed party line → people_changed', () => {
    const ref = DETERMINISTIC_DRAFT.replace('👨‍👩‍👧‍👦 人數：8大', '👨‍👩‍👧‍👦 人數：6大')
    expect(guard(ref).map((i) => i.code)).toContain('people_changed')
  })

  it('flags a dropped day → day_count_changed', () => {
    const ref = DETERMINISTIC_DRAFT.replace('Day 7｜收心慢遊・送機\n', '')
    expect(guard(ref).map((i) => i.code)).toContain('day_count_changed')
  })

  it('flags a renumbered day (same count, different sequence) → day_order_changed', () => {
    // Renumber Day 6 → Day 99: count stays 7 but the day sequence diverges.
    const ref = DETERMINISTIC_DRAFT.replace('Day 6｜', 'Day 99｜')
    const codes = guard(ref).map((i) => i.code)
    expect(codes).toContain('day_order_changed')
    expect(codes).not.toContain('day_count_changed')
  })

  it('flags a changed per-day date label → day_date_label_changed', () => {
    const ref = DETERMINISTIC_DRAFT.replace('8/5 (三)', '8/6 (三)')
    expect(guard(ref).map((i) => i.code)).toContain('day_date_label_changed')
  })

  it('flags lunch/dinner/lodging on the morning-transfer final day → final_day_meal_added', () => {
    const ref = DETERMINISTIC_DRAFT.replace(
      '・9:30 送機，平安返家',
      '午餐：機場餐廳\n・9:30 送機，平安返家'
    )
    const codes = guard(ref).map((i) => i.code)
    expect(codes).toContain('final_day_meal_added')
  })

  it('attributes EACH drift to its own reason when several coincide', () => {
    // Two independent facts move in one refined candidate: an activity rename and
    // a lunch change. Each must surface as its own distinct sub-reason so the
    // smoke report can break the fallback down per fact.
    const ref = DETERMINISTIC_DRAFT.replace('・水果市場', '・夜市').replace(
      '午餐：營區或附近餐廳',
      '午餐：別家餐廳'
    )
    const codes = guard(ref).map((i) => i.code)
    expect(codes).toContain('activity_line_changed')
    expect(codes).toContain('lunch_changed')
  })
})

// ---------------------------------------------------------------------------
// scanCustomerForbiddenTerms
// ---------------------------------------------------------------------------

describe('scanCustomerForbiddenTerms', () => {
  it('returns empty for clean customer text', () => {
    expect(scanCustomerForbiddenTerms(DETERMINISTIC_DRAFT)).toEqual([])
  })

  it('catches latin internal vocabulary case-insensitively', () => {
    expect(scanCustomerForbiddenTerms('see operator note').length).toBeGreaterThan(0)
    expect(scanCustomerForbiddenTerms('THEMETAG=cafe').length).toBeGreaterThan(0)
  })

  it('catches CJK internal vocabulary', () => {
    expect(scanCustomerForbiddenTerms('（內部備註：成本）').length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// refineCustomerItineraryDraft — the harness
// ---------------------------------------------------------------------------

describe('refineCustomerItineraryDraft', () => {
  const run = (source: Parameters<typeof refineCustomerItineraryDraft>[0]['source']) =>
    refineCustomerItineraryDraft({
      deterministicDraft: DETERMINISTIC_DRAFT,
      constraints: REFINE_CONSTRAINTS,
      source,
    })

  it('adopts a faithful tone polish that passes all guards', async () => {
    const r = await run(goodPolishSource)
    expect(r.used).toBe('refined')
    expect(r.refinedDraft).not.toBeNull()
    expect(r.draft).toBe(r.refinedDraft)
    expect(r.rejectionReasons).toEqual([])
    expect(r.draft).toContain('✦ 專屬訂製')
  })

  it('fail-closes to deterministic on structural drift', async () => {
    const r = await run(structureBreakSource)
    expect(r.used).toBe('deterministic')
    expect(r.refinedDraft).toBeNull()
    expect(r.draft).toBe(DETERMINISTIC_DRAFT)
    expect(r.structuralIssues.length).toBeGreaterThan(0)
    expect(r.rejectionReasons.length).toBeGreaterThan(0)
  })

  it('fail-closes to deterministic on an internal-data leak', async () => {
    const r = await run(leakySource)
    expect(r.used).toBe('deterministic')
    expect(r.refinedDraft).toBeNull()
    expect(r.draft).toBe(DETERMINISTIC_DRAFT)
    expect(r.leakHits.length).toBeGreaterThan(0)
  })

  it('fail-closes to deterministic on a lint error', async () => {
    const r = await run(lintBreakSource)
    expect(r.used).toBe('deterministic')
    expect(r.refinedDraft).toBeNull()
    expect(r.draft).toBe(DETERMINISTIC_DRAFT)
    expect(r.lintIssues.some((i) => i.severity === 'error')).toBe(true)
  })

  it('fail-closes to deterministic when the source throws', async () => {
    const r = await run(throwingSource)
    expect(r.used).toBe('deterministic')
    expect(r.refinedDraft).toBeNull()
    expect(r.draft).toBe(DETERMINISTIC_DRAFT)
    expect(r.rejectionReasons).toContain('source_error')
  })

  it('fail-closes to deterministic on empty source output', async () => {
    const r = await run(emptySource)
    expect(r.used).toBe('deterministic')
    expect(r.refinedDraft).toBeNull()
    expect(r.draft).toBe(DETERMINISTIC_DRAFT)
    expect(r.rejectionReasons).toContain('empty_output')
  })

  it('pins the accepted refined draft tone', async () => {
    const r = await run(goodPolishSource)
    expect(r.draft).toMatchSnapshot()
  })
})
