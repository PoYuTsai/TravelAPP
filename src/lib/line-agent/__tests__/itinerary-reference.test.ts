import { describe, expect, it } from 'vitest'
import { toItineraryReference } from '../notion/itinerary-reference'
import type { RagIndexRecord } from '../notion/rag-index'

function record(facts: Partial<RagIndexRecord['facts']>): RagIndexRecord {
  return {
    facts: { ...facts },
    identity: { sourceTables: ['private_2025'], sourceRecordIds: ['x'] },
  } as RagIndexRecord
}

describe('toItineraryReference', () => {
  it('returns sanitized skeleton + structural facts when snippet is clean-able', () => {
    const ref = toItineraryReference(
      record({
        days: 5,
        nights: 4,
        areaHints: ['chiangmai'],
        themeHints: ['family'],
        itinerarySnippet: '<李先生一家套餐訂製> x\nDay 1｜抵達\n・大象保護營',
      }),
    )
    expect(ref).not.toBeNull()
    expect(ref?.skeleton).toMatch(/大象保護營/)
    expect(ref?.skeleton).not.toMatch(/李先生/)
    expect(ref?.days).toBe(5)
  })

  it('returns null (drop) when snippet missing', () => {
    expect(toItineraryReference(record({ days: 5 }))).toBeNull()
  })

  it('returns null (drop) when sanitizer fails closed', () => {
    expect(
      toItineraryReference(record({ itinerarySnippet: 'Day 1｜送王太太回飯店' })),
    ).toBeNull()
  })
})
