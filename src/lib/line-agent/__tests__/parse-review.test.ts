/**
 * parse-review.test.ts
 *
 * Tests for the itinerary + quote parse-review harness (Task 9).
 * Loads real fixture files and asserts that the wrapper correctly maps
 * output from the REAL underlying parser functions.
 *
 * TDD: these tests are written BEFORE the implementation.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  reviewItinerary,
  reviewQuotation,
  type ItineraryReview,
  type QuotationReview,
} from '@/lib/line-agent/quote/parse-review'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.resolve(
  __dirname,
  '../quote/fixtures'
)

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

// ---------------------------------------------------------------------------
// reviewItinerary — 5D4N clean fixture
// ---------------------------------------------------------------------------

describe('reviewItinerary', () => {
  it('parses 5 days from the 5D4N fixture', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review: ItineraryReview = reviewItinerary(text, 2026)

    // Must have called the real parser — only the real parser produces ParsedDay objects
    expect(review.parseResult.success).toBe(true)
    expect(review.days).toHaveLength(5)
  })

  it('extracts the correct day numbers', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review = reviewItinerary(text, 2026)

    const dayNumbers = review.days.map(d => d.dayNumber)
    expect(dayNumbers).toEqual([1, 2, 3, 4, 5])
  })

  it('extracts Day 2 title containing elephant camp', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review = reviewItinerary(text, 2026)

    const day2 = review.days.find(d => d.dayNumber === 2)
    expect(day2?.title).toContain('大象')
  })

  it('extracts lunch for Day 2', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review = reviewItinerary(text, 2026)

    const day2 = review.days.find(d => d.dayNumber === 2)
    expect(day2?.lunch).toBeTruthy()
  })

  it('extracts dinner for Day 2', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review = reviewItinerary(text, 2026)

    const day2 = review.days.find(d => d.dayNumber === 2)
    expect(day2?.dinner).toBeTruthy()
  })

  it('extracts lodging for Day 1', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review = reviewItinerary(text, 2026)

    const day1 = review.days.find(d => d.dayNumber === 1)
    expect(day1?.accommodation).toContain('Akyra')
  })

  it('surfaces a basicInfo clientName from the header section', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review = reviewItinerary(text, 2026)

    expect(review.basicInfo.clientName).toBe('陳家豪')
  })

  it('surfaces adult and child counts', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review = reviewItinerary(text, 2026)

    expect(review.basicInfo.adults).toBe(4)
    expect(review.basicInfo.children).toBe(2)
  })

  it('produces no parse errors for a clean fixture', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review = reviewItinerary(text, 2026)

    expect(review.parseResult.errors).toHaveLength(0)
  })

  it('surfaces a warnings array (may be empty for clean fixture)', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review = reviewItinerary(text, 2026)

    expect(Array.isArray(review.parseResult.warnings)).toBe(true)
  })

  it('exposes reviewWarnings surfaced by the harness', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review = reviewItinerary(text, 2026)

    // The fixture has a 3-year-old; harness should warn about night safari
    // (夜間動物園) on Day 4 combined with infant/toddler age.
    expect(Array.isArray(review.reviewWarnings)).toBe(true)
    // At minimum a night-safari-toddler warning should fire
    const nightSafariWarning = review.reviewWarnings.find(w =>
      w.includes('夜間動物園') || w.includes('Night Safari') || w.includes('3 歲')
    )
    expect(nightSafariWarning).toBeTruthy()
  })

  it('Day 5 has no accommodation (departure day)', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review = reviewItinerary(text, 2026)

    const day5 = review.days.find(d => d.dayNumber === 5)
    // Departure day should have no lodging
    expect(day5?.accommodation).toBeFalsy()
  })

  it('includes parsed year from the real parser', () => {
    const text = loadFixture('chiang-mai-5d4n.txt')
    const review = reviewItinerary(text, 2026)

    expect(review.parseResult.year).toBe(2026)
  })
})

// ---------------------------------------------------------------------------
// reviewQuotation — clean quote fixture
// ---------------------------------------------------------------------------

describe('reviewQuotation — clean fixture', () => {
  it('parses items from the clean quote fixture', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const review: QuotationReview = reviewQuotation(text, 2026)

    expect(review.parsedQuotation.items.length).toBeGreaterThan(0)
  })

  it('extracts the stated total', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const review = reviewQuotation(text, 2026)

    // The clean fixture has 小計：33700
    expect(review.parsedQuotation.total).toBe(33700)
  })

  it('finds the day-by-day vehicle items', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const review = reviewQuotation(text, 2026)

    // Expect vehicle items for days 8/17 through 8/21
    const vehicleItems = review.dayVehicleItems
    expect(vehicleItems.length).toBeGreaterThan(0)
  })

  it('extracts guide fee item', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const review = reviewQuotation(text, 2026)

    expect(review.guideFeeItem).toBeTruthy()
    expect(review.guideFeeItem?.unitPrice).toBe(2500)
    expect(review.guideFeeItem?.quantity).toBe(3)
  })

  it('extracts insurance item', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const review = reviewQuotation(text, 2026)

    expect(review.insuranceItem).toBeTruthy()
    expect(review.insuranceItem?.unitPrice).toBe(400)
  })

  it('extracts ticket items', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const review = reviewQuotation(text, 2026)

    expect(review.ticketItems.length).toBeGreaterThan(0)
    const ticketDescriptions = review.ticketItems.map(t => t.description)
    const hasElephant = ticketDescriptions.some(d => d.includes('大象'))
    const hasNightSafari = ticketDescriptions.some(d => d.includes('夜間'))
    expect(hasElephant || hasNightSafari).toBe(true)
  })

  it('extracts included items list', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const review = reviewQuotation(text, 2026)

    expect(Array.isArray(review.includedItems)).toBe(true)
    expect(review.includedItems.length).toBeGreaterThan(0)
  })

  it('extracts excluded items list', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const review = reviewQuotation(text, 2026)

    expect(Array.isArray(review.excludedItems)).toBe(true)
    expect(review.excludedItems.length).toBeGreaterThan(0)
  })

  it('correctly identifies the currency as THB (no ambiguity in clean fixture)', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const review = reviewQuotation(text, 2026)

    expect(review.currencyAmbiguous).toBe(false)
  })
})
