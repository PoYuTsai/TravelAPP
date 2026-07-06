/**
 * itinerary-reference.ts — design 2026-06-14 §2(2)。
 *
 * 平行 toOperatorSafeCaseSummary（notion-rag-search.ts），但**保留** sanitized
 * skeleton，專供產 customer_itinerary_v1 的 LLM 當骨架範本。
 * 絕不走夥伴問答 surfacing（那條故意丟 snippet，GAP-1）。snippet 必過 sanitizer，
 * fail-closed ⇒ 整筆 null（不降級成沒骨架）。
 */
import type { RagIndexRecord } from './rag-index'
import { sanitizeItinerarySnippet } from './itinerary-reference-sanitizer'

export interface ItineraryReference {
  /** sanitized 活動骨架（無 PII），LLM 的主範本。 */
  skeleton: string
  days?: number
  nights?: number
  partySize?: number
  areaHints: string[]
  themeHints: string[]
}

export function toItineraryReference(record: RagIndexRecord): ItineraryReference | null {
  const f = record.facts
  if (!f.itinerarySnippet) return null

  const sanitized = sanitizeItinerarySnippet(f.itinerarySnippet)
  if (!sanitized.ok || !sanitized.skeleton) return null

  const ref: ItineraryReference = {
    skeleton: sanitized.skeleton,
    areaHints: f.areaHints ?? [],
    themeHints: f.themeHints ?? [],
  }
  if (f.days !== undefined) ref.days = f.days
  if (f.nights !== undefined) ref.nights = f.nights
  if (f.partySize !== undefined) ref.partySize = f.partySize
  return ref
}
