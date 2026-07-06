/**
 * quote-url.test.ts
 *
 * Phase C (dry-run) — unit tests for the pure slug + would-be URL builder.
 *
 * Contract under test (design doc 2026-06-02):
 *  - Slug is ALWAYS `DRAFT-<caseId>` — there is no random 8-char slug path
 *    this phase, so any emitted URL is structurally impossible to mistake
 *    for a live, sendable /quote/<8char> link.
 *  - The would-be URL carries isOfficial:false + reason + a 繁中 preview-only note.
 *
 * TDD: written BEFORE quote-url.ts exists.
 */

import { describe, it, expect } from 'vitest'
import {
  buildDraftSlug,
  buildWouldBeQuoteUrl,
} from '@/lib/line-agent/quote/quote-url'

describe('buildDraftSlug', () => {
  it('prefixes the caseId with DRAFT-', () => {
    expect(buildDraftSlug('CW-0601-001')).toBe('DRAFT-CW-0601-001')
  })

  it('always carries the DRAFT- prefix regardless of caseId shape', () => {
    for (const caseId of ['CW-1', 'abc123', '0602-XYZ', 'a']) {
      expect(buildDraftSlug(caseId).startsWith('DRAFT-')).toBe(true)
    }
  })
})

describe('buildWouldBeQuoteUrl', () => {
  it('composes /quote/DRAFT-<caseId> onto the origin', () => {
    const result = buildWouldBeQuoteUrl({
      origin: 'https://chiangway-travel.com',
      caseId: 'CW-0601-001',
    })
    expect(result.wouldBeUrl).toBe(
      'https://chiangway-travel.com/quote/DRAFT-CW-0601-001'
    )
  })

  it('normalizes a trailing slash on the origin (no double slash)', () => {
    const result = buildWouldBeQuoteUrl({
      origin: 'https://chiangway-travel.com/',
      caseId: 'CW-1',
    })
    expect(result.wouldBeUrl).toBe('https://chiangway-travel.com/quote/DRAFT-CW-1')
  })

  it('is never official this phase', () => {
    const result = buildWouldBeQuoteUrl({
      origin: 'https://chiangway-travel.com',
      caseId: 'CW-1',
    })
    expect(result.isOfficial).toBe(false)
  })

  it('reports the reason as no_sanity_document_written', () => {
    const result = buildWouldBeQuoteUrl({
      origin: 'https://chiangway-travel.com',
      caseId: 'CW-1',
    })
    expect(result.reason).toBe('no_sanity_document_written')
  })

  it('carries a 繁中 preview-only note that forbids sending to customers', () => {
    const result = buildWouldBeQuoteUrl({
      origin: 'https://chiangway-travel.com',
      caseId: 'CW-1',
    })
    // The note must make the non-sendable nature explicit.
    expect(result.note).toContain('預覽')
    expect(result.note).toContain('不可')
  })

  it('every emitted URL embeds a DRAFT- slug (no live-format slug path exists)', () => {
    for (const caseId of ['CW-1', 'family-tan', '0602']) {
      const result = buildWouldBeQuoteUrl({
        origin: 'https://chiangway-travel.com',
        caseId,
      })
      expect(result.wouldBeUrl).toContain('/quote/DRAFT-')
    }
  })
})
