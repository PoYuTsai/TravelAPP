import { describe, expect, it } from 'vitest'
import { sanitizeItinerarySnippet } from '../notion/itinerary-reference-sanitizer'
import {
  DIRTY_SNIPPET_FULL,
  CLEAN_SKELETON,
  RESIDUAL_HONORIFIC_SNIPPET,
  RESIDUAL_EMAIL_SNIPPET,
} from '../notion/__fixtures__/itinerary-reference-snippets'

describe('sanitizeItinerarySnippet', () => {
  it('strips header lines (title surname / 人數 / 日期)', () => {
    const r = sanitizeItinerarySnippet(DIRTY_SNIPPET_FULL)
    expect(r.ok).toBe(true)
    expect(r.skeleton).not.toMatch(/李先生|套餐訂製/)
    expect(r.skeleton).not.toMatch(/人數[：:]/)
    expect(r.skeleton).not.toMatch(/日期[：:]/)
  })

  it('redacts flight codes / amounts / phone / url from body', () => {
    const r = sanitizeItinerarySnippet(DIRTY_SNIPPET_FULL)
    expect(r.ok).toBe(true)
    expect(r.skeleton).not.toMatch(/CI851|華航/)
    expect(r.skeleton).not.toMatch(/NT\$|泰銖|萬/)
    expect(r.skeleton).not.toMatch(/0912-345-678/)
    expect(r.skeleton).not.toMatch(/notion\.so|https?:\/\//)
  })

  it('keeps activity / restaurant / lodging skeleton', () => {
    const r = sanitizeItinerarySnippet(DIRTY_SNIPPET_FULL)
    expect(r.skeleton).toMatch(/大象保護營/)
    expect(r.skeleton).toMatch(/午餐：本地小館/)
    expect(r.skeleton).toMatch(/住宿：古城區飯店/)
    expect(r.skeleton).toMatch(/Day 1｜抵達清邁/)
  })

  it('passes an already-clean skeleton through (header-less)', () => {
    const r = sanitizeItinerarySnippet(CLEAN_SKELETON)
    expect(r.ok).toBe(true)
    expect(r.skeleton).toMatch(/Day 1｜抵達清邁/)
  })

  it('FAIL-CLOSED: drops record when honorific surname survives', () => {
    const r = sanitizeItinerarySnippet(RESIDUAL_HONORIFIC_SNIPPET)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('residual_pii')
    expect(r.skeleton).toBeUndefined()
  })

  it('FAIL-CLOSED: drops record when email survives', () => {
    const r = sanitizeItinerarySnippet(RESIDUAL_EMAIL_SNIPPET)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('residual_pii')
  })

  it('FAIL-CLOSED: drops empty/blank snippet', () => {
    expect(sanitizeItinerarySnippet('').ok).toBe(false)
    expect(sanitizeItinerarySnippet('   \n  ').ok).toBe(false)
  })
})
