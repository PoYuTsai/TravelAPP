/**
 * customer-facing-forbidden-terms.ts
 *
 * Single source of truth for internal/operator vocabulary that must NEVER reach
 * a customer-facing text (itinerary draft, explanation, …). PURE constants + a
 * scanner; no LLM, no IO.
 *
 * Both the M3.3e explanation regression and the M3.4b refine leak guard import
 * this list so the two layers can never drift apart.
 */

/** Latin internal vocabulary (matched case-insensitively). */
export const FORBIDDEN_CUSTOMER_TERMS: readonly string[] = [
  'internal',
  'retrieval',
  'source',
  'themetag',
  'mobilityfriendly',
  'operator',
  'lint',
  'fail-closed',
  'system',
]

/** CJK internal vocabulary (matched as-is). */
export const FORBIDDEN_CUSTOMER_CJK: readonly string[] = [
  '內部',
  '候選',
  '白名單',
  '代入',
  '來源 case',
  '否決',
  'decision',
]

/**
 * Return every forbidden term present in `text`. Empty array means the text is
 * clean. Latin terms match case-insensitively; CJK terms match verbatim.
 */
export function scanCustomerForbiddenTerms(text: string): string[] {
  const lower = text.toLowerCase()
  const hits: string[] = []
  for (const term of FORBIDDEN_CUSTOMER_TERMS) {
    if (lower.includes(term)) hits.push(term)
  }
  for (const term of FORBIDDEN_CUSTOMER_CJK) {
    if (text.includes(term)) hits.push(term)
  }
  return hits
}
