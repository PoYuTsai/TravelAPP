/**
 * quote-url.ts
 *
 * Phase C (dry-run) — pure slug + would-be URL builder. No I/O, no Sanity.
 *
 * This phase NEVER writes a Sanity document, so it never mints a real,
 * sendable `/quote/<8char>` link. Every URL it emits uses a fixed
 * `DRAFT-<caseId>` slug, which is structurally impossible to confuse with a
 * live public quote link, and is flagged isOfficial:false. The random-slug
 * generator belongs to the future real-write phase, NOT here.
 */

/**
 * A would-be quote URL: what the public link WOULD be once (and if) a real
 * Sanity document is written. It is explicitly non-official this phase.
 */
export interface WouldBeQuoteUrl {
  /** e.g. https://chiangway-travel.com/quote/DRAFT-<caseId> */
  wouldBeUrl: string
  /** Always false this phase — no document was written. */
  isOfficial: false
  /** Why it is not official. */
  reason: 'no_sanity_document_written'
  /** 繁中 warning: preview only, never sendable to a customer. */
  note: string
}

/**
 * Build the dry-run slug for a case. ALWAYS `DRAFT-<caseId>`.
 * There is intentionally no random 8-char slug path in this phase.
 */
export function buildDraftSlug(caseId: string): string {
  return `DRAFT-${caseId}`
}

/**
 * Build the would-be quote URL for a case, flagged as a non-official preview.
 */
export function buildWouldBeQuoteUrl(params: {
  origin: string
  caseId: string
}): WouldBeQuoteUrl {
  const origin = params.origin.replace(/\/+$/, '')
  const slug = buildDraftSlug(params.caseId)

  return {
    wouldBeUrl: `${origin}/quote/${slug}`,
    isOfficial: false,
    reason: 'no_sanity_document_written',
    note: '尚未建檔，此為預覽用網址，非正式連結，不可傳給客戶',
  }
}
