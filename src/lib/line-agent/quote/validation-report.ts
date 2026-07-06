/**
 * validation-report.ts
 *
 * Task 9 — Deterministic Validation + Quote Math Check.
 *
 * Severity levels (from the engineering spec):
 *   'ok'               — parses cleanly, math consistent, includes/excludes coherent.
 *   'needs_human_check' — parses but has ambiguities or low-confidence fields.
 *   'blocked'          — cannot parse essentials, OR math is internally contradictory
 *                        (total mismatch > 500 THB per quote-included-excluded.md).
 *
 * ALL checks are DETERMINISTIC TypeScript — no LLM calls here.
 *
 * Thresholds sourced from docs/ai-agent-knowledge/rules/quote-included-excluded.md:
 *   - Total arithmetic error > 500 THB → blocked
 *   - `元` without qualifier → needs_human_check
 *   - "其餘門票現場買" present but excluded list doesn't mention other tickets → flag
 *   - Guide fee appears in day-by-day AND separate total → possible double-count flag
 */

import { parseQuotationText } from '@/lib/itinerary/parser'
import type { ParsedQuotationItem } from '@/lib/itinerary/types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ValidationSeverity = 'ok' | 'needs_human_check' | 'blocked'

export interface ValidationFinding {
  code: string
  message: string
  severity: ValidationSeverity
}

export interface ValidationReport {
  severity: ValidationSeverity
  mathOk: boolean
  computedTotal: number
  statedTotal: number
  findings: ValidationFinding[]
  summaryText: string
}

// ---------------------------------------------------------------------------
// generateValidationReport
// ---------------------------------------------------------------------------

/**
 * Run all deterministic validation checks on a raw quote text.
 * Wraps parseQuotationText — does NOT call an LLM.
 */
export function generateValidationReport(text: string, year?: number): ValidationReport {
  const parsedQuotation = parseQuotationText(text, year)
  const items = parsedQuotation.items
  const findings: ValidationFinding[] = []

  // ---- 1. Math check -------------------------------------------------------
  const computedTotal = computeItemsTotal(items)
  const statedTotal = parsedQuotation.total ?? 0

  let mathOk = true

  if (statedTotal > 0) {
    const diff = Math.abs(computedTotal - statedTotal)
    if (diff > 500) {
      mathOk = false
      findings.push({
        code: 'MATH_TOTAL_MISMATCH',
        severity: 'blocked',
        message:
          `加總不符：計算值 ${computedTotal} 泰銖，報價寫的小計 ${statedTotal} 泰銖，` +
          `差額 ${diff} 泰銖（超過 500 泰銖閾值）。`,
      })
    }
  }

  // ---- 2. Currency ambiguity -----------------------------------------------
  if (detectCurrencyAmbiguity(text)) {
    findings.push({
      code: 'CURRENCY_AMBIGUOUS',
      severity: 'needs_human_check',
      message:
        '報價出現「元」但未標明幣別（泰銖/台幣/人民幣），請確認幣別後再進後台。',
    })
  }

  // ---- 3. "其餘門票現場買" but excluded list incomplete --------------------
  if (
    text.includes('其餘門票現場買') &&
    !textContainsExcludeSection(text)
  ) {
    findings.push({
      code: 'MISSING_EXCLUDE_OTHERS',
      severity: 'needs_human_check',
      message:
        '報價提到「其餘門票現場買」，但不包含欄位未列出其餘景點門票，請補齊不包含項目。',
    })
  }

  // ---- 4. Missing insurance ------------------------------------------------
  const hasInsurance = items.some(item => item.description.includes('保險'))
  if (!hasInsurance) {
    findings.push({
      code: 'MISSING_INSURANCE',
      severity: 'needs_human_check',
      message: '報價未列乘客保險（保險費），請確認是否已包含。',
    })
  }

  // ---- 5. Guide fee possible double-count ----------------------------------
  const guideFeeItems = items.filter(item => item.description.includes('導遊'))
  if (guideFeeItems.length > 1) {
    findings.push({
      code: 'GUIDE_FEE_POSSIBLE_DOUBLE_COUNT',
      severity: 'needs_human_check',
      message:
        `導遊費出現 ${guideFeeItems.length} 次，可能重複計算，請確認。`,
    })
  }

  // ---- 6. Implausibly low total (currency confusion heuristic) --------------
  if (statedTotal > 0 && statedTotal < 5000 && items.length > 2) {
    findings.push({
      code: 'TOTAL_IMPLAUSIBLY_LOW',
      severity: 'needs_human_check',
      message:
        `報價總計 ${statedTotal}，多天行程低於 5,000 可能是幣別混淆，請確認。`,
    })
  }

  // ---- Determine overall severity -----------------------------------------
  const severity = deriveSeverity(findings)

  // ---- Summary text --------------------------------------------------------
  const summaryText = buildSummaryText(severity, computedTotal, statedTotal, mathOk, findings)

  return {
    severity,
    mathOk,
    computedTotal,
    statedTotal,
    findings,
    summaryText,
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Sum all parsed items: unitPrice × quantity.
 */
function computeItemsTotal(items: ParsedQuotationItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
}

/**
 * Detect `元` without a currency qualifier on the same line.
 * Per quote-included-excluded.md.
 */
function detectCurrencyAmbiguity(text: string): boolean {
  const lines = text.split('\n')
  for (const line of lines) {
    if (/\d+\s*元/.test(line)) {
      const qualified = /泰銖|THB|NT\$|NTD|TWD/.test(line)
      if (!qualified) return true
    }
  }
  return false
}

/**
 * Check if the text has a 不包含 section with at least one bullet item.
 */
function textContainsExcludeSection(text: string): boolean {
  const lines = text.split('\n')
  let inSection = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('不包含') && (trimmed.includes('：') || trimmed.includes(':'))) {
      inSection = true
      continue
    }
    if (inSection && /^[・\-•·]/.test(trimmed)) {
      return true // found at least one bullet in the exclude section
    }
    // Another heading-level line ends the section
    if (inSection && !trimmed.startsWith('・') && trimmed.includes('：')) {
      inSection = false
    }
  }
  return false
}

/**
 * Derive overall severity from the list of findings.
 * Highest severity wins: blocked > needs_human_check > ok.
 */
function deriveSeverity(findings: ValidationFinding[]): ValidationSeverity {
  if (findings.some(f => f.severity === 'blocked')) return 'blocked'
  if (findings.some(f => f.severity === 'needs_human_check')) return 'needs_human_check'
  return 'ok'
}

/**
 * Build a human-readable summary text for the report.
 */
function buildSummaryText(
  severity: ValidationSeverity,
  computedTotal: number,
  statedTotal: number,
  mathOk: boolean,
  findings: ValidationFinding[]
): string {
  const severityLabel: Record<ValidationSeverity, string> = {
    ok: '✅ 通過',
    needs_human_check: '⚠️ 需人工確認',
    blocked: '🚫 無法自動進後台',
  }

  const lines: string[] = []
  lines.push(`整體判斷：${severityLabel[severity]}`)

  if (statedTotal > 0) {
    if (mathOk) {
      lines.push(`加總檢查：計算值 ${computedTotal}，報價小計 ${statedTotal}，✅ 相符`)
    } else {
      const diff = Math.abs(computedTotal - statedTotal)
      lines.push(
        `加總檢查：計算值 ${computedTotal}，報價小計 ${statedTotal}，❌ 差額 ${diff} 泰銖`
      )
    }
  } else {
    lines.push(`加總檢查：報價未標小計，跳過數學驗證`)
  }

  if (findings.length > 0) {
    lines.push('')
    lines.push('發現問題：')
    for (const f of findings) {
      const icon = f.severity === 'blocked' ? '🚫' : '⚠️'
      lines.push(`${icon} [${f.code}] ${f.message}`)
    }
  }

  return lines.join('\n')
}
