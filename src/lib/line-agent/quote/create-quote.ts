/**
 * create-quote.ts
 *
 * Phase C (dry-run) — orchestrates raw inputs → parser/review → validation →
 * severity gate → ready-to-write draft + would-be URL (flagged non-official).
 *
 * DRY-RUN ONLY. No Sanity document is ever written, so:
 *  - every URL it emits is a non-official preview (DRAFT-<caseId>, isOfficial:false);
 *  - the audit entry records a NO-transition 'quote.dryrun' event (no write performed).
 *
 * Reuses existing anchors as-is — does NOT touch the parser:
 *   reviewItinerary / reviewQuotation  (parse-review.ts)
 *   generateValidationReport           (validation-report.ts)
 */

import { reviewItinerary, reviewQuotation } from './parse-review'
import {
  generateValidationReport,
  type ValidationReport,
} from './validation-report'
import {
  buildDraftSlug,
  buildWouldBeQuoteUrl,
  type WouldBeQuoteUrl,
} from './quote-url'
import {
  dryRunQuoteWriter,
  type QuoteWriter,
  type QuoteWriteResult,
  type ReadyToWriteQuoteDraft,
} from './sanity-write'
import { makeAuditEntry, type AuditEntry } from '../audit/audit-log'
import type { CaseStatus } from '../cases/case-state'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CreateQuoteStatus =
  | 'ok'
  | 'needs_human_check'
  | 'blocked'
  | 'error'

export interface CreateQuoteParams {
  /** Raw itinerary text (the customer-facing day-by-day plan). */
  itineraryText: string
  /** Raw quotation text (the priced breakdown). */
  quoteText: string
  /** Case identifier — drives the DRAFT-<caseId> slug. */
  caseId: string
  /** Who triggered this (e.g. 'eric', 'partner'). */
  actor: string
  /** Origin channel, e.g. 'line' | 'discord'. */
  sourceChannel: string
  /** Site origin for URL composition, e.g. https://chiangway-travel.com */
  origin: string
  /** ISO-8601 timestamp — injected so the audit entry stays deterministic. */
  timestamp: string
  /** Optional year hint passed through to the parsers. */
  year?: number
  /** Writer dependency — defaults to the dry-run writer (never mutates). */
  writer?: QuoteWriter
}

export interface CreateQuoteResult {
  status: CreateQuoteStatus
  /** Deterministic validation report (null only on a thrown error). */
  report: ValidationReport | null
  /** Ready-to-write draft, or null when blocked / errored. */
  draft: ReadyToWriteQuoteDraft | null
  /** Non-official preview URL, or null when blocked / errored. */
  wouldBeUrl: WouldBeQuoteUrl | null
  /** Dry-run write result, or null when blocked / errored. */
  writeResult: QuoteWriteResult | null
  /** Append-only audit record of this dry-run (no transition performed). */
  auditEntry: AuditEntry
  /** Raw input echoed back on error — never swallowed. */
  rawInput?: { itineraryText: string; quoteText: string }
  /** Human-readable summary the command router can relay to LINE/DC. */
  summaryText: string
}

// A dry-run performs no state transition. We record the quote-review context
// with from === to so the audit log makes the "no write" explicit.
const DRYRUN_STATUS: CaseStatus = 'quote_review'
const DRYRUN_EVENT = 'quote.dryrun'

// ---------------------------------------------------------------------------
// createQuote
// ---------------------------------------------------------------------------

export async function createQuote(
  params: CreateQuoteParams
): Promise<CreateQuoteResult> {
  const {
    itineraryText,
    quoteText,
    caseId,
    actor,
    origin,
    timestamp,
    year,
    writer = dryRunQuoteWriter,
  } = params

  const auditEntry = makeAuditEntry(
    caseId,
    DRYRUN_STATUS,
    DRYRUN_STATUS,
    DRYRUN_EVENT,
    timestamp,
    actor
  )

  try {
    // 1–3. Review + deterministic validation (severity gate input).
    const report = generateValidationReport(quoteText, year)

    // 4a. Blocked → normal control-flow result, no draft, no URL, no write.
    if (report.severity === 'blocked') {
      return {
        status: 'blocked',
        report,
        draft: null,
        wouldBeUrl: null,
        writeResult: null,
        auditEntry,
        summaryText: `🚫 報價無法自動進後台（dry-run，未建檔）\n${report.summaryText}`,
      }
    }

    // 4b. ok | needs_human_check → build the draft + would-be URL.
    const itineraryReview = reviewItinerary(itineraryText, year)
    const quotationReview = reviewQuotation(quoteText, year)
    const { basicInfo } = itineraryReview

    const draft: ReadyToWriteQuoteDraft = {
      clientName: basicInfo.clientName,
      startDate: basicInfo.startDate,
      endDate: basicInfo.endDate,
      adults: basicInfo.adults,
      children: basicInfo.children,
      childrenAges: basicInfo.childrenAges,
      totalPeople: basicInfo.totalPeople,
      rawItineraryText: itineraryText,
      days: itineraryReview.parseResult.days,
      quotation: quotationReview.parsedQuotation,
      publicSlug: buildDraftSlug(caseId),
    }

    const wouldBeUrl = buildWouldBeQuoteUrl({ origin, caseId })

    // 5. Dry-run write — structurally a no-op; asserts nothing is persisted.
    const writeResult = await writer.write(draft)

    return {
      status: report.severity,
      report,
      draft,
      wouldBeUrl,
      writeResult,
      auditEntry,
      summaryText: buildSummary(report, wouldBeUrl),
    }
  } catch (err) {
    // External/parse errors must not be silently dropped — echo raw input.
    const message = err instanceof Error ? err.message : String(err)
    return {
      status: 'error',
      report: null,
      draft: null,
      wouldBeUrl: null,
      writeResult: null,
      auditEntry,
      rawInput: { itineraryText, quoteText },
      summaryText: `❌ 報價產生失敗（dry-run）：${message}`,
    }
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function buildSummary(report: ValidationReport, url: WouldBeQuoteUrl): string {
  const head =
    report.severity === 'ok'
      ? '✅ 報價檢查通過（dry-run，未建檔）'
      : '⚠️ 報價需人工確認（dry-run，未建檔）'
  return [
    head,
    report.summaryText,
    '',
    `預覽網址（非正式，不可傳客戶）：${url.wouldBeUrl}`,
    url.note,
  ].join('\n')
}
