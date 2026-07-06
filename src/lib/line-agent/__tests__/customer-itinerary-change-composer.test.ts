/**
 * customer-itinerary-change-composer.test.ts
 *
 * M3.3c — Deterministic customer-change composer.
 *
 * Customer change requests → deterministic feasibility/advice transform →
 * customer_itinerary_v1 draft + customerExplanation / operatorNotes. PURE, NO
 * LLM, NO RAG live, NO CLI. Does NOT touch LINE / Sanity / gate / live path.
 *
 * Contract pinned here (design 2026-06-09-m3.3c):
 *   - ok === (draft !== null); lint warn never fails-closed, lint error does
 *   - declined  = not written into draft, professional alternative via explanation
 *   - adjusted  = re-arranged into a more comfortable, executable version
 *   - applied   = reasonable request applied as-is
 *   - customerExplanation never leaks internal/lint/fail-closed/system wording
 *   - operatorNotes are internal-only and never appear inside the customer draft
 */

import { describe, it, expect } from 'vitest'
import { composeCustomerChange } from '../notion/customer-itinerary-change-composer'
import type { ComposeCustomerItineraryInput } from '../notion/customer-itinerary-composer'
import { LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS as REQ } from '../notion/__fixtures__/customer-itinerary-golden'

function clone(): ComposeCustomerItineraryInput {
  return JSON.parse(JSON.stringify(REQ))
}

/** Focused 2-day base for the over-full rerank tests (5 & 6). */
function rerankBase(): ComposeCustomerItineraryInput {
  return {
    constraints: {
      days: 2,
      nights: 1,
      stayArea: 'chiangmai_old_city',
      sameLodgingAllTrip: true,
      customerVersion: true,
    },
    requirements: {
      title: '測試家庭',
      headerTitle: '清邁輕鬆兩日',
      dateRange: '2025/09/01～2025/09/02',
      partyDescription: '4大',
      days: [
        {
          day: 1,
          dateLabel: '9/1 (一)',
          title: '古城慢遊',
          departureTime: '9:00',
          morningActivities: ['塔佩門拍照', '三王紀念碑'],
          lunch: '古城小吃',
          afternoonActivities: ['契迪龍寺', '帕辛寺'],
          dinner: '古城晚餐',
          lodging: '清邁古城民宿',
        },
        {
          day: 2,
          dateLabel: '9/2 (二)',
          title: '古城再訪',
          departureTime: '9:00',
          morningActivities: ['週日市集'],
          lunch: '市集午餐',
          afternoonActivities: [],
          dinner: '古城晚餐',
          lodging: '清邁古城民宿',
        },
      ],
    },
  }
}

function daySection(draft: string, day: number): string {
  const start = draft.indexOf(`Day ${day}｜`)
  const next = draft.indexOf(`Day ${day + 1}｜`)
  return draft.slice(start, next === -1 ? undefined : next)
}

describe('composeCustomerChange — feasibility & advice', () => {
  it('1. limited mobility + 加飛索類活動 → declined, not in draft, alternative suggested', () => {
    const r = composeCustomerChange({
      base: clone(),
      changes: { addActivities: [{ day: 3, activity: '叢林飛索體驗' }] },
      retrievalCases: [{ name: '茵他儂瀑布步道', mobilityFriendly: true }],
    })
    expect(r.ok).toBe(true)
    expect(r.draft).not.toBeNull()
    expect(r.draft as string).not.toContain('飛索')
    // alternative named from the retrieval whitelist
    expect(r.customerExplanation).toContain('茵他儂瀑布步道')
    // decline reason recorded for the operator
    expect(r.operatorNotes.join('\n')).toContain('叢林飛索')
  })

  it('2. final-day morning transfer + wanted lunch → adjusted, no final-day meal/lodging', () => {
    const base = clone()
    base.requirements.days[6].lunch = '機場午餐'
    base.requirements.days[6].dinner = '最後晚餐'
    base.requirements.days[6].lodging = '清邁古城民宿'
    const r = composeCustomerChange({
      base,
      changes: { finalDayMorningTransfer: { time: '09:30' } },
    })
    expect(r.ok).toBe(true)
    const day7 = daySection(r.draft as string, 7)
    expect(day7).not.toContain('午餐：')
    expect(day7).not.toContain('晚餐：')
    expect(day7).not.toContain('住宿：')
    expect(r.customerExplanation).toContain('前一天')
    expect(r.operatorNotes.join('\n')).toContain('送機')
  })

  it('3. sameLodgingAllTrip + 清萊住宿變更 → declined, lodging unchanged, day-trip advised', () => {
    const r = composeCustomerChange({
      base: clone(),
      changes: {
        sameLodgingAllTrip: { stayArea: 'chiangmai_old_city' },
        lodgingChangeRequests: [{ day: 4, lodging: '清萊夜市民宿' }],
      },
    })
    expect(r.ok).toBe(true)
    expect(r.draft as string).not.toContain('清萊')
    expect(r.customerExplanation).toContain('一日往返')
    expect(r.operatorNotes.join('\n')).toContain('清萊')
  })

  it('4. keepActivities 天使瀑布 → not falsely removed even when a remove is requested', () => {
    const r = composeCustomerChange({
      base: clone(),
      changes: {
        keepActivities: ['天使瀑布'],
        removeActivities: [{ day: 3, activity: '天使瀑布' }],
      },
    })
    expect(r.ok).toBe(true)
    expect(r.draft as string).toContain('天使瀑布')
  })

  it('5. over-full + sufficient structured signal → conservative rerank, passes lint', () => {
    const r = composeCustomerChange({
      base: rerankBase(),
      changes: {
        dayCapacities: [{ day: 1, maxStops: 3 }],
        activityAreaTags: [
          { activity: '帕辛寺', areaTag: 'old_city' },
          { activity: '週日市集', areaTag: 'old_city' },
        ],
      },
    })
    expect(r.ok).toBe(true)
    const day1 = daySection(r.draft as string, 1)
    const day2 = daySection(r.draft as string, 2)
    expect(day1).not.toContain('帕辛寺')
    expect(day2).toContain('帕辛寺')
    expect(r.operatorNotes.join('\n')).toContain('帕辛寺')
  })

  it('6. over-full but insufficient signal → no rerank, advice returned instead', () => {
    const r = composeCustomerChange({
      base: rerankBase(),
      changes: { dayCapacities: [{ day: 1, maxStops: 3 }] },
    })
    expect(r.ok).toBe(true)
    const day1 = daySection(r.draft as string, 1)
    // nothing was silently moved
    expect(day1).toContain('帕辛寺')
    expect(r.operatorNotes.length).toBeGreaterThan(0)
    expect(r.customerExplanation.length).toBeGreaterThan(0)
  })

  it('7. customerExplanation uses only customer-facing language (no internal terms)', () => {
    const r = composeCustomerChange({
      base: clone(),
      changes: { addActivities: [{ day: 3, activity: '叢林飛索體驗' }] },
    })
    const ex = r.customerExplanation.toLowerCase()
    for (const banned of ['internal', 'lint', 'fail-closed', 'system', 'operator']) {
      expect(ex).not.toContain(banned)
    }
    expect(r.customerExplanation).not.toContain('內部')
  })

  it('8. operatorNotes never leak into the draft; lint error → draft null but advice kept', () => {
    // 8a — operator notes stay out of the customer draft
    const a = composeCustomerChange({
      base: clone(),
      changes: { addActivities: [{ day: 3, activity: '叢林飛索體驗' }] },
    })
    expect(a.operatorNotes.length).toBeGreaterThan(0)
    for (const note of a.operatorNotes) {
      expect(a.draft as string).not.toContain(note)
    }

    // 8b — an unresolved hard conflict fails-closed yet still returns advice
    const base = clone()
    base.requirements.days[6].lunch = '末日午餐' // final morning-transfer day carries a meal
    const b = composeCustomerChange({ base, changes: {} })
    expect(b.ok).toBe(false)
    expect(b.draft).toBeNull()
    expect(b.issues.some((i) => i.code === 'final_day_lunch')).toBe(true)
    expect(typeof b.customerExplanation).toBe('string')
    expect(Array.isArray(b.operatorNotes)).toBe(true)
  })
})
