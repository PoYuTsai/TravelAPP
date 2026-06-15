import { describe, expect, it } from 'vitest'
import { selectItineraryReference } from '../notion/itinerary-reference-source'
import { sanitizeItinerarySnippet } from '../notion/itinerary-reference-sanitizer'
import {
  buildRagIndex,
  type RagCaseFacts,
  type RagIndex,
  type RagIndexRecord,
} from '../notion/rag-index'

// Build a real RagIndex via buildRagIndex (which runs dedupe/merge and
// materializes the lookup maps) so the test genuinely exercises
// retrieveRagCases → queryRagIndex ranking — NOT a hand-fed hit list.
function indexWith(facts: Partial<RagCaseFacts>): RagIndex {
  const record: RagIndexRecord = {
    identity: { sourceTables: ['private_2026'], sourceRecordIds: ['p1'] },
    facts: { ...facts },
  } as RagIndexRecord
  return buildRagIndex([record])
}

describe('selectItineraryReference', () => {
  it('returns top-1 sanitized reference when a like case exists', () => {
    const index = indexWith({
      days: 5,
      nights: 4,
      // area/theme hints that retrieveRagCases ranking will hit for the query
      // below (清邁→chiangmai, 親子→family, 大象→elephant).
      areaHints: ['chiangmai'],
      themeHints: ['family', 'elephant'],
      itinerarySnippet:
        '<王先生一家套餐訂製> 清邁親子5天4夜\nDay 1｜抵達清邁\n・大象保護營\n・清邁大峽谷水上樂園',
    })

    const r = selectItineraryReference(index, '清邁親子5天4夜 大象 水上樂園')
    expect(r.source).toBe('case')
    expect(r.skeleton).toMatch(/Day 1｜/)
  })

  it('falls back to markdown template when low_confidence (no signal/hit)', () => {
    const index = buildRagIndex([])
    const r = selectItineraryReference(index, '隨便問問')
    expect(r.source).toBe('template')
    expect(r.skeleton.length).toBeGreaterThan(0)
  })

  it('falls back to template when top-1 sanitizer fails closed', () => {
    // The only retrievable case carries a residual 王太太 honorific that the
    // sanitizer denylist trips on (fail-closed) → no case survives → template.
    const index = indexWith({
      days: 5,
      areaHints: ['chiangmai'],
      themeHints: ['family'],
      itinerarySnippet: 'Day 1｜送王太太回飯店',
    })

    const r = selectItineraryReference(index, '清邁親子5天')
    expect(r.source).toBe('template')
  })

  // 開閘前必修 I-1：fallback 範本與真案例共用同一 sanitizer assert，且不得
  // 逐字注入具體航班碼（會抵銷「不臆造航班」）或 `**` markdown（會誘發 gate 擋格式）。
  it('template fallback skeleton is sanitizer-clean, flight-code-free and emphasis-free', () => {
    const r = selectItineraryReference(buildRagIndex([]), '隨便問問')
    expect(r.source).toBe('template')
    expect(r.skeleton).not.toMatch(/[A-Z]{2}\s?\d{2,4}/) // 航班碼 BR257/CI851
    expect(r.skeleton).not.toMatch(/華航|長榮|泰航|虎航|亞航/)
    expect(r.skeleton).not.toMatch(/\*\*/) // markdown 粗體
    expect(sanitizeItinerarySnippet(r.skeleton).ok).toBe(true)
  })
})
