/**
 * notion-mapper.test.ts
 *
 * The mapper turns a (policy-filtered) Notion page into a clean
 * CaseReferenceSummary. It must never copy the full page, never emit a Notion
 * link or token, and never leak an exact amount or any private field into a
 * partner-facing summary.
 */

import { describe, it, expect } from 'vitest'
import { mapPageToSummary } from '../notion/notion-mapper'
import { FIXTURE_PAGES } from '../notion/__fixtures__/pages'
import type { NotionPageFixture } from '../notion/types'

function pageById(id: string): NotionPageFixture {
  const page = FIXTURE_PAGES.find((p) => p.id === id)
  if (!page) throw new Error(`fixture page ${id} not found`)
  return page
}

const family5d = pageById('case-family-cm-5d')
const photoTour = pageById('case-photo-tour')

describe('mapPageToSummary — partner_group', () => {
  const summary = mapPageToSummary(family5d, 'partner_group')

  it('maps shareable structured fields', () => {
    expect(summary.refId).toBe('case-family-cm-5d')
    expect(summary.adults).toBe(2)
    expect(summary.children).toBe(2)
    expect(summary.childAges).toEqual([4, 7])
    expect(summary.cityArea).toBe('清邁')
    expect(summary.tripType).toBe('親子')
    expect(summary.highlights).toEqual(
      expect.arrayContaining(['叢林飛索'])
    )
    expect(summary.lastStatus).toBe('converted')
  })

  it('exposes only a price bucket, never the exact amount', () => {
    expect(summary.quoteTier).toBe('30k-50k')
    expect(JSON.stringify(summary)).not.toContain('38000')
  })

  it('omits sensitive + operator-only fields', () => {
    expect(summary.internalNotes).toBeUndefined()
    expect(summary.internalTags).toBeUndefined()
    expect(summary.omittedFields).toEqual(
      expect.arrayContaining(['成本', '分潤', '客人姓名', '內部備註', '內部標籤'])
    )
  })

  it('never emits a notion link or token', () => {
    const blob = JSON.stringify(summary)
    expect(blob).not.toMatch(/notion\.so|https?:\/\/|secret_|ntn_/i)
    expect(blob).not.toContain('王先生')
  })
})

describe('mapPageToSummary — operator_only', () => {
  const summary = mapPageToSummary(family5d, 'operator_only')

  it('adds truncated internal notes + internal tags', () => {
    expect(typeof summary.internalNotes).toBe('string')
    expect((summary.internalNotes as string).length).toBeLessThanOrEqual(120)
    expect(summary.internalTags).toEqual(['親子', '高滿意', '回頭客'])
  })

  it('still buckets the amount and omits cost/profit', () => {
    expect(summary.quoteTier).toBe('30k-50k')
    expect(JSON.stringify(summary)).not.toContain('38000')
    expect(summary.omittedFields).toEqual(
      expect.arrayContaining(['成本', '分潤', '客人姓名'])
    )
  })
})

describe('mapPageToSummary — handles missing/zero fields', () => {
  const summary = mapPageToSummary(photoTour, 'partner_group')

  it('maps zero children and a different bucket', () => {
    expect(summary.children).toBe(0)
    expect(summary.quoteTier).toBe('20k-30k')
    expect(summary.childAges).toBeUndefined()
  })
})
