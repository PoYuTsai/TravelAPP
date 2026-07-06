/**
 * customer-itinerary-change-retrieval.test.ts
 *
 * M3.3d — Deterministic retrieval-case application + operator preview.
 *
 * retrievalCases stop being a passive whitelist field and become usable
 * alternative attractions: when a mobility-unsuitable activity is declined and
 * the request carries a themeTag, a same-theme mobility-friendly retrieval case
 * is deterministically SUBSTITUTED into the draft. PURE, NO Notion live, NO LLM,
 * NO LINE, NO gate flip. retrieval cases are simulated via fixtures only.
 *
 * Contract pinned here:
 *   - themeTag match + mobilityFriendly → substituted into draft (adjusted)
 *   - no themeTag / no theme match → named_only (declined, suggested not applied)
 *   - no usable candidate → none (generic phrase, never an invented name)
 *   - customerExplanation stays clean (no operator-only retrieval wording)
 *   - operatorNotes + retrievalApplications record the alternative SOURCE
 *   - lint error still fail-closed; applications still recorded
 */

import { describe, it, expect } from 'vitest'
import {
  composeCustomerChange,
  type ChangeComposerInput,
} from '../notion/customer-itinerary-change-composer'
import { buildOperatorRetrievalPreview } from '../notion/customer-change-operator-preview'
import type { ComposeCustomerItineraryInput } from '../notion/customer-itinerary-composer'
import { LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS as REQ } from '../notion/__fixtures__/customer-itinerary-golden'

function clone(): ComposeCustomerItineraryInput {
  return JSON.parse(JSON.stringify(REQ))
}

const SAFE_ALT = '蘭花園景觀步道'

function declineWith(
  retrievalCases: ChangeComposerInput['retrievalCases'],
  themeTag?: string
) {
  return composeCustomerChange({
    base: clone(),
    changes: { addActivities: [{ day: 3, activity: '叢林飛索體驗', themeTag }] },
    retrievalCases,
  })
}

describe('composeCustomerChange — deterministic retrieval-case application', () => {
  it('1. themeTag match + mobilityFriendly → substituted into draft', () => {
    const r = declineWith(
      [{ name: SAFE_ALT, themeTag: 'adventure', mobilityFriendly: true }],
      'adventure'
    )
    expect(r.ok).toBe(true)
    expect(r.draft as string).not.toContain('飛索')
    expect(r.draft as string).toContain(SAFE_ALT)
    expect(r.customerExplanation).toContain(SAFE_ALT)
    expect(r.operatorNotes.join('\n')).toContain(SAFE_ALT)
    const app = r.retrievalApplications[0]
    expect(app.outcome).toBe('substituted')
    expect(app.chosen?.name).toBe(SAFE_ALT)
  })

  it('2. candidate not mobilityFriendly → not substituted, declined as none', () => {
    const r = declineWith(
      [{ name: SAFE_ALT, themeTag: 'adventure', mobilityFriendly: false }],
      'adventure'
    )
    expect(r.ok).toBe(true)
    expect(r.draft as string).not.toContain(SAFE_ALT)
    expect(r.retrievalApplications[0].outcome).toBe('none')
  })

  it('3. themeTag present but no theme match → named_only (suggested, not applied)', () => {
    const r = declineWith(
      [{ name: '清邁藍廟二訪', themeTag: 'culture', mobilityFriendly: true }],
      'adventure'
    )
    expect(r.ok).toBe(true)
    expect(r.draft as string).not.toContain('清邁藍廟二訪')
    expect(r.customerExplanation).toContain('清邁藍廟二訪')
    expect(r.retrievalApplications[0].outcome).toBe('named_only')
  })

  it('4. no usable candidate → none, generic phrase, never an invented name', () => {
    const r = declineWith([], 'adventure')
    expect(r.ok).toBe(true)
    expect(r.customerExplanation).toContain('較輕鬆的替代景點')
    expect(r.retrievalApplications[0].outcome).toBe('none')
  })

  it('5. multiple same-theme candidates → deterministic first pick', () => {
    const r = declineWith(
      [
        { name: 'A 緩坡花園', themeTag: 'adventure', mobilityFriendly: true },
        { name: 'B 緩坡花園', themeTag: 'adventure', mobilityFriendly: true },
      ],
      'adventure'
    )
    expect(r.draft as string).toContain('A 緩坡花園')
    expect(r.draft as string).not.toContain('B 緩坡花園')
    expect(r.retrievalApplications[0].candidates.length).toBe(2)
  })

  it('6. substituted draft still passes lint (no error issues)', () => {
    const r = declineWith(
      [{ name: SAFE_ALT, themeTag: 'adventure', mobilityFriendly: true }],
      'adventure'
    )
    expect(r.ok).toBe(true)
    expect(r.issues.some((i) => i.severity === 'error')).toBe(false)
  })

  it('7. lint error still fail-closed; applications still recorded', () => {
    const base = clone()
    base.requirements.days[6].lunch = '末日午餐' // hard conflict the change layer cannot fix
    const r = composeCustomerChange({
      base,
      changes: { addActivities: [{ day: 3, activity: '叢林飛索體驗', themeTag: 'adventure' }] },
      retrievalCases: [{ name: SAFE_ALT, themeTag: 'adventure', mobilityFriendly: true }],
    })
    expect(r.ok).toBe(false)
    expect(r.draft).toBeNull()
    expect(r.issues.some((i) => i.code === 'final_day_lunch')).toBe(true)
    expect(r.retrievalApplications.length).toBeGreaterThan(0)
  })

  it('8. customerExplanation carries no operator-only retrieval wording', () => {
    const r = declineWith(
      [{ name: SAFE_ALT, themeTag: 'adventure', mobilityFriendly: true }],
      'adventure'
    )
    const ex = r.customerExplanation.toLowerCase()
    for (const banned of ['themetag', 'mobilityfriendly', 'retrieval', 'source']) {
      expect(ex).not.toContain(banned)
    }
    for (const banned of ['候選', '白名單', '代入', '內部']) {
      expect(r.customerExplanation).not.toContain(banned)
    }
  })
})

describe('buildOperatorRetrievalPreview — operator-facing application trace', () => {
  it('9. substituted application → preview shows the applied alternative + candidate count', () => {
    const r = declineWith(
      [{ name: SAFE_ALT, themeTag: 'adventure', mobilityFriendly: true }],
      'adventure'
    )
    const lines = buildOperatorRetrievalPreview(r.retrievalApplications)
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('叢林飛索體驗')
    expect(lines[0]).toContain(SAFE_ALT)
  })

  it('10. none application → preview tells the operator to fill it manually (no invention)', () => {
    const r = declineWith([], 'adventure')
    const lines = buildOperatorRetrievalPreview(r.retrievalApplications)
    expect(lines[0]).toContain('人工')
  })
})
