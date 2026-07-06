/**
 * live-masked-retrieval-cases.test.ts
 *
 * M3.4a — maps Notion live operator-safe masked summaries into RetrievalCaseRef
 * "theme signal only" shapes, and pins the substitution guardrails Eric set:
 *
 *   G1. every mapper output is FORCED provenance:'live_masked' (caller cannot
 *       downgrade it to a substitutable fixture).
 *   G2. name comes ONLY from the code-only GENERIC_THEME_LABELS table — never a
 *       string lifted from a Notion snippet / title / summary.
 *   G3. the substitution guard lives in pickRetrievalAlternative's core: even a
 *       hand-stuffed live_masked + concrete name + matching themeTag must NOT be
 *       substituted into the draft (only named_only / none).
 *
 * PURE, NO Notion live, NO LLM, NO LINE, NO gate. vitest is the authoritative gate.
 */

import { describe, it, expect } from 'vitest'
import {
  toLiveMaskedRetrievalCases,
  GENERIC_THEME_LABELS,
  MOBILITY_FRIENDLY_THEMES,
} from '../notion/live-masked-retrieval-cases'
import {
  composeCustomerChange,
  type RetrievalCaseRef,
} from '../notion/customer-itinerary-change-composer'
import { buildOperatorRetrievalPreview } from '../notion/customer-change-operator-preview'
import { scenarioAddThrillActivity } from '../notion/__fixtures__/customer-change-scenarios'

// Build a declined-add change whose themeTag aligns with a friendly live theme,
// so substitution WOULD fire if the policy guard were absent. The activity text
// carries 飛索 (a mobility-unsuitable token) so it enters the decline branch.
function cafeThemedDeclineInput(retrievalCases: RetrievalCaseRef[]) {
  const base = scenarioAddThrillActivity().base
  return {
    base,
    changes: { addActivities: [{ day: 3, activity: '叢林飛索體驗', themeTag: 'cafe' }] },
    retrievalCases,
  }
}

// ---------------------------------------------------------------------------
// 1. basic mapping: friendly theme → one live_masked ref with a generic name
// ---------------------------------------------------------------------------

describe('toLiveMaskedRetrievalCases — friendly theme', () => {
  it('maps a cafe-theme summary to a generic-label live_masked ref', () => {
    const cases = toLiveMaskedRetrievalCases([{ areaHints: [], themeHints: ['cafe'] }])
    expect(cases).toHaveLength(1)
    expect(cases[0]).toEqual({
      name: GENERIC_THEME_LABELS.cafe,
      themeTag: 'cafe',
      mobilityFriendly: true,
      provenance: 'live_masked',
    })
  })
})

// ---------------------------------------------------------------------------
// 2. no friendly theme → no ref (→ downstream none, never invented)
// ---------------------------------------------------------------------------

describe('toLiveMaskedRetrievalCases — no friendly theme', () => {
  it('emits nothing when every themeHint is mobility-unsuitable', () => {
    const cases = toLiveMaskedRetrievalCases([{ areaHints: [], themeHints: ['zipline', 'adventure'] }])
    expect(cases).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 3. picks the first FRIENDLY theme, skipping unsuitable ones
// ---------------------------------------------------------------------------

describe('toLiveMaskedRetrievalCases — first friendly wins', () => {
  it('skips the unsuitable zipline theme and maps cafe', () => {
    const cases = toLiveMaskedRetrievalCases([{ areaHints: [], themeHints: ['zipline', 'cafe'] }])
    expect(cases).toHaveLength(1)
    expect(cases[0].themeTag).toBe('cafe')
  })
})

// ---------------------------------------------------------------------------
// 4. dedupe by themeTag across multiple summaries
// ---------------------------------------------------------------------------

describe('toLiveMaskedRetrievalCases — dedupe by theme', () => {
  it('collapses repeated themes to a single ref', () => {
    const cases = toLiveMaskedRetrievalCases([
      { areaHints: [], themeHints: ['cafe'] },
      { areaHints: [], themeHints: ['cafe'] },
      { areaHints: [], themeHints: ['massage'] },
    ])
    expect(cases.map((c) => c.themeTag)).toEqual(['cafe', 'massage'])
  })
})

// ---------------------------------------------------------------------------
// G2. name comes ONLY from GENERIC_THEME_LABELS — never lifted from input text
// ---------------------------------------------------------------------------

describe('toLiveMaskedRetrievalCases — name is never lifted from input', () => {
  it('ignores any stray concrete attraction string and uses the generic label', () => {
    // A rogue summary that smuggles a concrete attraction name in extra fields.
    const rogue = {
      areaHints: [],
      themeHints: ['cafe'],
      name: '茵他儂國家公園',
      itinerarySnippetPreview: '茵他儂國家公園 + 客戶王小明',
    } as never
    const cases = toLiveMaskedRetrievalCases([rogue])
    expect(cases[0].name).toBe(GENERIC_THEME_LABELS.cafe)
    expect(cases[0].name).not.toContain('茵他儂')
    expect(cases[0].name).not.toContain('王小明')
  })
})

// ---------------------------------------------------------------------------
// G1. every output is FORCED live_masked; the whitelist labels carry no PII
// ---------------------------------------------------------------------------

describe('toLiveMaskedRetrievalCases — provenance is always live_masked', () => {
  it('forces provenance live_masked on every emitted ref', () => {
    const cases = toLiveMaskedRetrievalCases(
      MOBILITY_FRIENDLY_THEMES.map((t) => ({ areaHints: [], themeHints: [t] }))
    )
    expect(cases.length).toBe(MOBILITY_FRIENDLY_THEMES.length)
    for (const c of cases) {
      expect(c.provenance).toBe('live_masked')
      expect(c.mobilityFriendly).toBe(true)
      // generic labels never carry digits (no party size / price / record id)
      expect(c.name).not.toMatch(/\d/)
    }
  })
})

// ---------------------------------------------------------------------------
// G3. core guard: hand-stuffed live_masked + name + matching theme → NOT substituted
// ---------------------------------------------------------------------------

describe('pickRetrievalAlternative guard — live_masked is never substituted', () => {
  it('demotes a theme-matching live_masked candidate to named_only and keeps it out of the draft', () => {
    // Sentinel name guaranteed absent from the base itinerary, so its presence in
    // the draft could ONLY come from a (forbidden) substitution.
    const SENTINEL = '手動塞入替代景點SENTINEL'
    const stuffed: RetrievalCaseRef[] = [
      // Someone manually forces a concrete name + matching themeTag + friendly flag.
      { name: SENTINEL, themeTag: 'cafe', mobilityFriendly: true, provenance: 'live_masked' },
    ]
    const result = composeCustomerChange(cafeThemedDeclineInput(stuffed))
    const app = result.retrievalApplications.find((a) => a.day === 3)
    expect(app?.outcome).toBe('named_only')
    expect(result.draft ?? '').not.toContain(SENTINEL)
  })

  it('still substitutes a fixture-provenance candidate (no regression)', () => {
    const fixtureCase: RetrievalCaseRef[] = [
      { name: '湄登大象友善半日（緩坡步道）', themeTag: 'cafe', mobilityFriendly: true },
    ]
    const result = composeCustomerChange(cafeThemedDeclineInput(fixtureCase))
    const app = result.retrievalApplications.find((a) => a.day === 3)
    expect(app?.outcome).toBe('substituted')
  })
})

// ---------------------------------------------------------------------------
// 8. mapper → compose end-to-end: live cases only ever suggest, never inject
// ---------------------------------------------------------------------------

describe('toLiveMaskedRetrievalCases → composeCustomerChange', () => {
  it('a live cafe case is named_only and its generic label never enters the draft', () => {
    const live = toLiveMaskedRetrievalCases([{ areaHints: [], themeHints: ['cafe'] }])
    const result = composeCustomerChange(cafeThemedDeclineInput(live))
    const app = result.retrievalApplications.find((a) => a.day === 3)
    expect(app?.outcome).toBe('named_only')
    expect(result.draft ?? '').not.toContain(GENERIC_THEME_LABELS.cafe)
  })
})

// ---------------------------------------------------------------------------
// 9. operator preview surfaces a masked-source line for live_masked candidates
// ---------------------------------------------------------------------------

describe('buildOperatorRetrievalPreview — live_masked source line', () => {
  it('shows a masked theme-signal source without any concrete attraction name', () => {
    const live = toLiveMaskedRetrievalCases([{ areaHints: [], themeHints: ['cafe'] }])
    const result = composeCustomerChange(cafeThemedDeclineInput(live))
    const [block] = buildOperatorRetrievalPreview(result.retrievalApplications)
    expect(block).toContain('masked')
    expect(block).toContain('cafe')
    expect(block).toContain('依政策不代入')
  })
})
