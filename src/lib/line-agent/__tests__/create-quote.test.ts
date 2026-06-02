/**
 * create-quote.test.ts
 *
 * Phase C (dry-run) — orchestration tests for createQuote + dryRunQuoteWriter.
 *
 * Hard contracts under test (design doc 2026-06-02):
 *  - severity gate: 'blocked' → no draft / no URL; 'ok' | 'needs_human_check' → draft + would-be URL.
 *  - EVERY emitted URL is non-official (isOfficial:false) — even on 'ok'. Dry-run never
 *    produces a sendable customer link, because no Sanity document is written.
 *  - the writer is the dry-run writer: it NEVER reports written:true, and the audit
 *    entry records a no-transition 'quote.dryrun' event (no write performed).
 *  - thrown errors anywhere in the flow → status:'error' with the raw input preserved,
 *    never silently swallowed.
 *
 * Reuses existing quote/itinerary fixtures — adds NO new parser golden cases
 * (parser is frozen for Phase C).
 *
 * TDD: written BEFORE create-quote.ts / sanity-write.ts exist.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { createQuote } from '@/lib/line-agent/quote/create-quote'
import {
  dryRunQuoteWriter,
  type QuoteWriter,
} from '@/lib/line-agent/quote/sanity-write'

// ---------------------------------------------------------------------------
// Fixture helpers (same convention as parse-review.test.ts)
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.resolve(__dirname, '../quote/fixtures')

function loadFixture(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf-8')
}

function loadNamedFixture(filename: string, name: string): string {
  const raw = loadFixture(filename)
  const marker = `===FIXTURE:${name}===`
  const startIdx = raw.indexOf(marker)
  if (startIdx === -1) throw new Error(`Fixture "${name}" not found in ${filename}`)
  const afterMarker = raw.slice(startIdx + marker.length)
  const nextMarker = afterMarker.indexOf('===FIXTURE:')
  return nextMarker === -1 ? afterMarker.trim() : afterMarker.slice(0, nextMarker).trim()
}

const CLEAN_ITINERARY = () => loadFixture('chiang-mai-5d4n.txt')
const CLEAN_QUOTE = () => loadFixture('chiang-mai-quote-examples.txt')
const BLOCKED_QUOTE = () => loadNamedFixture('messy-quote-examples.txt', 'math-error')
const NEEDS_HUMAN_QUOTE = () => loadNamedFixture('messy-quote-examples.txt', 'messy-ambiguous')

const BASE = {
  caseId: 'CW-0601-001',
  actor: 'eric',
  sourceChannel: 'line',
  origin: 'https://chiangway-travel.com',
  timestamp: '2026-06-02T04:00:00.000Z',
  year: 2026,
}

// ---------------------------------------------------------------------------
// blocked severity gate
// ---------------------------------------------------------------------------

describe('createQuote — blocked severity', () => {
  it('returns status blocked with no draft and no URL when math is contradictory', async () => {
    const result = await createQuote({
      ...BASE,
      itineraryText: CLEAN_ITINERARY(),
      quoteText: BLOCKED_QUOTE(),
    })

    expect(result.status).toBe('blocked')
    expect(result.report?.severity).toBe('blocked')
    expect(result.draft).toBeNull()
    expect(result.wouldBeUrl).toBeNull()
    expect(result.writeResult).toBeNull()
  })

  it('records a no-transition quote.dryrun audit entry on a blocked result', async () => {
    const result = await createQuote({
      ...BASE,
      itineraryText: CLEAN_ITINERARY(),
      quoteText: BLOCKED_QUOTE(),
    })

    expect(result.auditEntry.eventType).toBe('quote.dryrun')
    // No write / no transition: from === to.
    expect(result.auditEntry.from).toBe(result.auditEntry.to)
    expect(result.auditEntry.timestamp).toBe(BASE.timestamp)
    expect(result.auditEntry.caseId).toBe(BASE.caseId)
  })
})

// ---------------------------------------------------------------------------
// needs_human_check severity gate
// ---------------------------------------------------------------------------

describe('createQuote — needs_human_check severity', () => {
  it('builds a draft and a NON-official would-be URL', async () => {
    const result = await createQuote({
      ...BASE,
      itineraryText: CLEAN_ITINERARY(),
      quoteText: NEEDS_HUMAN_QUOTE(),
    })

    expect(result.status).toBe('needs_human_check')
    expect(result.draft).not.toBeNull()
    expect(result.wouldBeUrl).not.toBeNull()
    expect(result.wouldBeUrl?.isOfficial).toBe(false)
    expect(result.wouldBeUrl?.reason).toBe('no_sanity_document_written')
  })
})

// ---------------------------------------------------------------------------
// ok severity gate — still NOT official (dry-run)
// ---------------------------------------------------------------------------

describe('createQuote — ok severity', () => {
  it('builds a draft projected onto the itinerary shape', async () => {
    const result = await createQuote({
      ...BASE,
      itineraryText: CLEAN_ITINERARY(),
      quoteText: CLEAN_QUOTE(),
    })

    expect(result.status).toBe('ok')
    expect(result.draft).not.toBeNull()
    expect(result.draft?.clientName).toBe('陳家豪')
    expect(result.draft?.rawItineraryText).toBe(CLEAN_ITINERARY())
    expect(result.draft?.quotation.items.length).toBeGreaterThan(0)
  })

  it('emits a DRAFT- slug that is still flagged non-official on a clean quote', async () => {
    const result = await createQuote({
      ...BASE,
      itineraryText: CLEAN_ITINERARY(),
      quoteText: CLEAN_QUOTE(),
    })

    expect(result.draft?.publicSlug).toBe('DRAFT-CW-0601-001')
    expect(result.wouldBeUrl?.wouldBeUrl).toContain('/quote/DRAFT-CW-0601-001')
    // The hard contract: even a clean, math-correct quote is NOT a sendable link.
    expect(result.wouldBeUrl?.isOfficial).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// dry-run writer — never writes
// ---------------------------------------------------------------------------

describe('dry-run writer contract', () => {
  it('dryRunQuoteWriter.write never reports written:true', async () => {
    const writeResult = await dryRunQuoteWriter.write({
      clientName: '測試',
      rawItineraryText: 'x',
      days: [],
      quotation: { items: [] },
      publicSlug: 'DRAFT-test',
    })
    expect(writeResult.written).toBe(false)
  })

  it('createQuote routes through the dry-run writer (writeResult never written) on ok', async () => {
    const result = await createQuote({
      ...BASE,
      itineraryText: CLEAN_ITINERARY(),
      quoteText: CLEAN_QUOTE(),
    })

    expect(result.writeResult).not.toBeNull()
    expect(result.writeResult?.written).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// error handling — thrown errors surface, raw input preserved
// ---------------------------------------------------------------------------

describe('createQuote — error handling', () => {
  it('surfaces status:error with raw input preserved when a dependency throws', async () => {
    const throwingWriter: QuoteWriter = {
      async write() {
        throw new Error('boom: simulated downstream failure')
      },
    }

    const result = await createQuote({
      ...BASE,
      itineraryText: CLEAN_ITINERARY(),
      quoteText: CLEAN_QUOTE(),
      writer: throwingWriter,
    })

    expect(result.status).toBe('error')
    // The raw input must NOT be swallowed — it is echoed back for the bug packet.
    expect(result.rawInput?.itineraryText).toBe(CLEAN_ITINERARY())
    expect(result.rawInput?.quoteText).toBe(CLEAN_QUOTE())
  })
})
