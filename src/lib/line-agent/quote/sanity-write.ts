/**
 * sanity-write.ts
 *
 * Phase C (dry-run) — the quote WRITE CONTRACT, defined now so the future
 * real-write phase only has to swap the implementation.
 *
 * IMPORTANT: this file imports NO Sanity client and performs NO mutation.
 * The dry-run writer is structurally incapable of writing — there is no
 * client wired in this phase. A real write surface (token, createOrReplace)
 * is deferred to a later phase, gated on Eric explicitly approving a
 * server-side Sanity write token.
 */

import type { ParsedDay, ParsedQuotation } from '@/lib/itinerary/types'

// ---------------------------------------------------------------------------
// ReadyToWriteQuoteDraft — projection onto the Sanity `itinerary` schema
// ---------------------------------------------------------------------------

/**
 * The payload a writer WOULD persist. Mirrors the fields of the Sanity
 * `itinerary` document that the dry-run flow can derive deterministically.
 */
export interface ReadyToWriteQuoteDraft {
  clientName?: string
  startDate?: string
  endDate?: string
  adults?: number
  children?: number
  childrenAges?: string
  totalPeople?: number
  /** Original itinerary text, kept verbatim for backup/audit. */
  rawItineraryText: string
  /** Per-day rows from the real parser. */
  days: ParsedDay[]
  /** Parsed quotation (items + total). */
  quotation: ParsedQuotation
  /** Dry-run slug — always `DRAFT-<caseId>` this phase. */
  publicSlug: string
}

// ---------------------------------------------------------------------------
// Write contract
// ---------------------------------------------------------------------------

export interface QuoteWriteResult {
  written: boolean
  documentId?: string
  publicSlug?: string
}

export interface QuoteWriter {
  write(payload: ReadyToWriteQuoteDraft): Promise<QuoteWriteResult>
}

/**
 * The dry-run writer. Never mutates Sanity, never imports a client.
 * Always reports `written: false` so no consumer can mistake the result
 * for a persisted, sendable quote.
 */
export const dryRunQuoteWriter: QuoteWriter = {
  async write(): Promise<QuoteWriteResult> {
    return { written: false }
  },
}

/**
 * Inert placeholder for the future real-write phase. NOT wired into any flow,
 * imports no Sanity client, and throws if called this phase. It exists only
 * to pin the contract shape; the next phase replaces this body with a real
 * createOrReplace behind an explicitly-approved write token.
 */
export const liveQuoteWriter: QuoteWriter = {
  async write(): Promise<QuoteWriteResult> {
    throw new Error(
      'liveQuoteWriter is not implemented in the dry-run phase — ' +
        'real Sanity writes are gated on an approved server-side write token.'
    )
  },
}
