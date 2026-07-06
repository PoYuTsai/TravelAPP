/**
 * Free-text → RAG query bridge (v1).
 *
 * Pure, synchronous, network-free, NO LLM. Turns a customer-style free-text
 * need ('清邁 親子 5天 大象 夜間動物園') into a deterministic RagIndexQuery using
 * the SAME canonical area/theme vocabulary the corpus was ingested with
 * (parseItineraryHints). This guarantees query tokens and corpus hints line up.
 *
 * Discipline (locked):
 *   - Only in-vocab tokens survive. Out-of-vocab words (5天 / 金三角 / 包車 /
 *     東京) contribute NOTHING — area/theme stay empty rather than being invented.
 *     As of GAP-2 "family/kids" (親子 / 小孩 / 小朋友 / 兒童 / family / kids) IS
 *     in-vocab → it lifts the canonical `family` theme so a 親子 query and a 親子 /
 *     小朋友 corpus record line up; children / partySize remain a further
 *     structural fact on top, never invented from partySize alone.
 *   - partySize is a usable structural signal ('6人' → 6), but this layer never
 *     maps 包車 to a vehicleType and retrieval never commits to a vehicle/quote.
 *   - A query with zero usable signal (no area, no theme, no partySize) yields a
 *     low-confidence EMPTY result instead of returning the whole corpus.
 */

import { parseItineraryHints } from './itinerary-parser'
import { queryRagIndex, type RagIndex, type RagIndexQuery, type RagIndexRecord } from './rag-index'

/** Bare head-count like '6人' (no adult/child split invented at the query layer). */
function parsePartySize(text: string): number | undefined {
  const match = text.match(/(\d+)\s*人/)
  return match ? Number(match[1]) : undefined
}

/**
 * Parse free text into a RagIndexQuery. areas/themes come from the canonical
 * alias table; partySize from a bare '人' count. Nothing outside the vocab is
 * emitted.
 */
export function parseRagQuery(text: string): RagIndexQuery {
  const { areaHints, themeHints } = parseItineraryHints(text)
  const query: RagIndexQuery = { areas: areaHints, themes: themeHints }
  const partySize = parsePartySize(text)
  if (partySize !== undefined) query.partySize = partySize
  return query
}

/** True when the parsed query carries no usable retrieval signal. */
function hasNoSignal(query: RagIndexQuery): boolean {
  return (
    (query.areas?.length ?? 0) === 0 &&
    (query.themes?.length ?? 0) === 0 &&
    query.partySize === undefined
  )
}

/**
 * Retrieve ranked cases for a free-text need. Returns EMPTY for a query that
 * parses to no usable signal, so an out-of-scope ask never bleeds into the whole
 * corpus.
 */
export function retrieveRagCases(index: RagIndex, text: string): RagIndexRecord[] {
  const query = parseRagQuery(text)
  if (hasNoSignal(query)) return []
  return queryRagIndex(index, query)
}
