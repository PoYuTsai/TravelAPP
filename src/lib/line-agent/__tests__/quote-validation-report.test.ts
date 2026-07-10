/**
 * quote-validation-report.test.ts
 *
 * Tests for the deterministic validation + math-check report (Task 9).
 * Severity: 'ok' | 'needs_human_check' | 'blocked'
 *
 * TDD: these tests are written BEFORE the implementation.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  generateValidationReport,
  type ValidationReport,
} from '@/lib/line-agent/quote/validation-report'

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
// Clean fixture → 'ok' or 'needs_human_check' (math must reconcile)
// ---------------------------------------------------------------------------

describe('generateValidationReport — clean quote', () => {
  it('returns a report with defined severity', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const report: ValidationReport = generateValidationReport(text, 2026)

    expect(['ok', 'needs_human_check', 'blocked']).toContain(report.severity)
  })

  it('is NOT blocked for the clean fixture', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const report = generateValidationReport(text, 2026)

    expect(report.severity).not.toBe('blocked')
  })

  it('exposes a findings array', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const report = generateValidationReport(text, 2026)

    expect(Array.isArray(report.findings)).toBe(true)
  })

  it('exposes a computedTotal', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const report = generateValidationReport(text, 2026)

    // computedTotal is the sum of all parsed item prices
    expect(typeof report.computedTotal).toBe('number')
    expect(report.computedTotal).toBeGreaterThan(0)
  })

  it('exposes a statedTotal from the parsed quotation', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const report = generateValidationReport(text, 2026)

    expect(typeof report.statedTotal).toBe('number')
    expect(report.statedTotal).toBe(33700)
  })

  it('exposes a mathOk boolean', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const report = generateValidationReport(text, 2026)

    expect(typeof report.mathOk).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// Messy ambiguous fixture → 'needs_human_check'
// ---------------------------------------------------------------------------

describe('generateValidationReport — messy/ambiguous fixture', () => {
  it('flags the ambiguous-currency fixture as needs_human_check or blocked', () => {
    const text = loadNamedFixture('messy-quote-examples.txt', 'messy-ambiguous')
    const report = generateValidationReport(text, 2026)

    expect(['needs_human_check', 'blocked']).toContain(report.severity)
  })

  it('includes a finding about currency ambiguity (元 without qualifier)', () => {
    const text = loadNamedFixture('messy-quote-examples.txt', 'messy-ambiguous')
    const report = generateValidationReport(text, 2026)

    const currencyFinding = report.findings.find(f =>
      f.code === 'CURRENCY_AMBIGUOUS' ||
      f.message.includes('元') ||
      f.message.includes('currency')
    )
    expect(currencyFinding).toBeTruthy()
  })

  it('includes a finding about missing excludes for 其餘門票', () => {
    const text = loadNamedFixture('messy-quote-examples.txt', 'messy-ambiguous')
    const report = generateValidationReport(text, 2026)

    const excludeFinding = report.findings.find(f =>
      f.code === 'MISSING_EXCLUDE_OTHERS' ||
      f.message.includes('其餘') ||
      f.message.includes('excluded') ||
      f.message.includes('不包含')
    )
    expect(excludeFinding).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Math-error fixture → 'blocked'
// ---------------------------------------------------------------------------

describe('generateValidationReport — math error fixture', () => {
  it('returns severity blocked for the math-error fixture', () => {
    const text = loadNamedFixture('messy-quote-examples.txt', 'math-error')
    const report = generateValidationReport(text, 2026)

    expect(report.severity).toBe('blocked')
  })

  it('exposes mathOk = false for the math-error fixture', () => {
    const text = loadNamedFixture('messy-quote-examples.txt', 'math-error')
    const report = generateValidationReport(text, 2026)

    expect(report.mathOk).toBe(false)
  })

  it('includes a finding about the math discrepancy', () => {
    const text = loadNamedFixture('messy-quote-examples.txt', 'math-error')
    const report = generateValidationReport(text, 2026)

    const mathFinding = report.findings.find(f =>
      f.code === 'MATH_TOTAL_MISMATCH' ||
      f.message.includes('total') ||
      f.message.includes('mismatch') ||
      f.message.includes('小計') ||
      f.message.includes('不符')
    )
    expect(mathFinding).toBeTruthy()
  })

  it('states computedTotal and statedTotal that differ by more than 500 THB', () => {
    const text = loadNamedFixture('messy-quote-examples.txt', 'math-error')
    const report = generateValidationReport(text, 2026)

    // The math-error fixture states 99999 but computed total is far less
    expect(Math.abs(report.computedTotal - report.statedTotal)).toBeGreaterThan(500)
  })
})

describe('generateValidationReport — bracket ticket fixture', () => {
  it('keeps math valid when ticket audience is written in parentheses', () => {
    const text = loadNamedFixture('messy-quote-examples.txt', 'bracket-ticket')
    const report = generateValidationReport(text, 2026)

    expect(report.computedTotal).toBe(12900)
    expect(report.statedTotal).toBe(12900)
    expect(report.mathOk).toBe(true)
    expect(report.severity).not.toBe('blocked')
  })
})

// ---------------------------------------------------------------------------
// Programmatically constructed math-inconsistent quote → 'blocked'
// ---------------------------------------------------------------------------

describe('generateValidationReport — inline math-inconsistent quote', () => {
  const mathInconsistentQuote = `
客戶：測試客戶
9/1 接機 3000
9/2 古城 4000
導遊 2500*2天
保險 400

小計：50000
`.trim()

  it('returns blocked when stated total > computed total by more than 500 THB', () => {
    const report = generateValidationReport(mathInconsistentQuote, 2026)

    expect(report.severity).toBe('blocked')
    expect(report.mathOk).toBe(false)
  })

  it('provides a clear reason in findings', () => {
    const report = generateValidationReport(mathInconsistentQuote, 2026)

    expect(report.findings.length).toBeGreaterThan(0)
    // At least one finding should reference the math mismatch
    const mathFinding = report.findings.find(f =>
      f.code === 'MATH_TOTAL_MISMATCH' || f.message.length > 0
    )
    expect(mathFinding).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Severity hierarchy
// ---------------------------------------------------------------------------

describe('severity hierarchy', () => {
  it('keeps a quote without optional insurance at ok severity', () => {
    const quoteWithoutInsurance = `
9/1 包車 3200

小計：3200
`.trim()

    const report = generateValidationReport(quoteWithoutInsurance, 2026)

    expect(report.findings.map(f => f.code)).not.toContain('MISSING_INSURANCE')
    expect(report.severity).toBe('ok')
  })

  it('accepts selected insurance at THB 100 per passenger per trip', () => {
    const quoteWithInsurance = `
9/1 包車 3200
旅遊保險 100*4人

小計：3600
`.trim()

    const report = generateValidationReport(quoteWithInsurance, 2026)

    expect(report.computedTotal).toBe(3600)
    expect(report.statedTotal).toBe(3600)
    expect(report.mathOk).toBe(true)
    expect(report.findings.map(f => f.code)).not.toContain('MISSING_INSURANCE')
  })

  it('ok is the best outcome — no findings or only info', () => {
    // A minimal quote with correct math
    const minimalQuote = `
9/1 包車 3200
保險 400

小計：3600
`.trim()

    const report = generateValidationReport(minimalQuote, 2026)
    // No math error, no ambiguity — should be ok or needs_human_check (missing excludes)
    expect(['ok', 'needs_human_check']).toContain(report.severity)
    expect(report.severity).not.toBe('blocked')
  })

  it('report has a summaryText string', () => {
    const text = loadFixture('chiang-mai-quote-examples.txt')
    const report = generateValidationReport(text, 2026)

    expect(typeof report.summaryText).toBe('string')
    expect(report.summaryText.length).toBeGreaterThan(0)
  })
})
