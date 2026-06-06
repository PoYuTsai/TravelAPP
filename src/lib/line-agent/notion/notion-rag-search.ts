/**
 * notion-rag-search.ts
 *
 * Operator-only RAG retrieval PREVIEW. Pure, synchronous (no env / fetch /
 * Notion). Turns a free-text need into an operator-safe ranked preview of the
 * corpus, so Eric can probe query quality from the CLI without touching the LINE
 * live path, Sanity, a scheduler, or an LLM.
 *
 * The projection is OPERATOR-SAFE, a different (looser) cut than the
 * partner-safe view: the operator may see structural + descriptive facts
 * (days / nights / area / theme / partySize / vehicleType / a short itinerary
 * preview), but NEVER private context (cost / revenue / profit / private notes /
 * Notion url / database id) and NEVER raw record ids or PII. Because the summary
 * is built from a whitelist of `facts` fields only, it structurally cannot carry
 * any of that — a downstream formatter renders an already-safe object.
 */

import { parseRagQuery, retrieveRagCases } from './rag-query'
import type { RagIndex, RagIndexRecord } from './rag-index'
import { resolveNotionRagConfig } from './notion-rag-config'
import { buildNotionRagIndex, type NotionRagClient } from './notion-rag-loader'

/** Operator-safe per-case summary — whitelisted facts only, never private/PII. */
export interface OperatorSafeCaseSummary {
  days?: number
  nights?: number
  areaHints: string[]
  themeHints: string[]
  partySize?: number
  vehicleType?: string
  /** Truncated 行程框架 preview — structure only, never customer text fields. */
  itinerarySnippetPreview?: string
}

export interface NotionRagSearchParsedQuery {
  areas: string[]
  themes: string[]
  partySize?: number
}

export interface NotionRagSearchResult {
  /** ok = at least one hit; low_confidence = parsed signal too weak / no hit. */
  status: 'ok' | 'low_confidence'
  parsedQuery: NotionRagSearchParsedQuery
  totalRecords: number
  resultCount: number
  results: OperatorSafeCaseSummary[]
}

const DEFAULT_TOP_N = 5
const DEFAULT_SNIPPET_CHARS = 60

/** Truncate a snippet to a preview length, marking elision with an ellipsis. */
function previewSnippet(text: string | undefined, maxChars: number): string | undefined {
  if (!text) return undefined
  const trimmed = text.trim()
  if (trimmed.length === 0) return undefined
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}…` : trimmed
}

/**
 * Project an index record to an operator-safe summary. Reads ONLY `facts` —
 * privateContext and identity (raw record ids) are never touched, so nothing
 * private or identifying can survive into the output.
 */
export function toOperatorSafeCaseSummary(
  record: RagIndexRecord,
  opts: { snippetPreviewChars?: number } = {}
): OperatorSafeCaseSummary {
  const f = record.facts
  const summary: OperatorSafeCaseSummary = {
    areaHints: f.areaHints ?? [],
    themeHints: f.themeHints ?? [],
  }
  if (f.days !== undefined) summary.days = f.days
  if (f.nights !== undefined) summary.nights = f.nights
  if (f.partySize !== undefined) summary.partySize = f.partySize
  if (f.vehicleType !== undefined) summary.vehicleType = f.vehicleType
  const preview = previewSnippet(f.itinerarySnippet, opts.snippetPreviewChars ?? DEFAULT_SNIPPET_CHARS)
  if (preview !== undefined) summary.itinerarySnippetPreview = preview
  return summary
}

/**
 * Search a built index with a free-text query and return an operator-safe,
 * ranked top-N preview. A query with no usable signal (or no hit) returns
 * `low_confidence` with zero results — never the whole corpus.
 */
export function searchRagIndex(
  index: RagIndex,
  query: string,
  opts: { topN?: number; snippetPreviewChars?: number } = {}
): NotionRagSearchResult {
  const parsed = parseRagQuery(query)
  const parsedQuery: NotionRagSearchParsedQuery = {
    areas: parsed.areas ?? [],
    themes: parsed.themes ?? [],
    ...(parsed.partySize !== undefined ? { partySize: parsed.partySize } : {}),
  }

  const hits = retrieveRagCases(index, query)
  const topN = opts.topN ?? DEFAULT_TOP_N
  const results = hits
    .slice(0, topN)
    .map((r) => toOperatorSafeCaseSummary(r, { snippetPreviewChars: opts.snippetPreviewChars }))

  return {
    status: results.length > 0 ? 'ok' : 'low_confidence',
    parsedQuery,
    totalRecords: index.records.length,
    resultCount: results.length,
    results,
  }
}

// ---------------------------------------------------------------------------
// Operator runtime — mirrors runNotionRagTraverseDryRun (client injected)
// ---------------------------------------------------------------------------

const EMPTY_PARSED_QUERY: NotionRagSearchParsedQuery = { areas: [], themes: [] }

export interface NotionRagSearchReport {
  status: 'skipped' | 'ok' | 'error'
  parsedQuery: NotionRagSearchParsedQuery
  totalRecords: number
  resultCount: number
  results: OperatorSafeCaseSummary[]
  /** Config-resolution + build issue CODES only — never raw tokens/messages. */
  issues: string[]
  /** Present only when status === 'error'. */
  errorCode?: 'missing_database_id' | 'client_error'
}

/**
 * Run the operator search against an injected client: resolve config, build the
 * index, then project an operator-safe ranked preview. The disabled gate lives
 * in the CLI; here a config skip / build error surfaces as a code-only report,
 * and the result projection drops every private/PII-carrying field.
 */
export async function runNotionRagSearch(
  env: Record<string, string | undefined>,
  client: NotionRagClient,
  query: string,
  opts: { topN?: number; snippetPreviewChars?: number } = {}
): Promise<NotionRagSearchReport> {
  const { config, issues: configIssues } = resolveNotionRagConfig(env)
  const issues = configIssues.map((i) => i.code)

  const result = await buildNotionRagIndex(config, client)

  if (result.status === 'skipped') {
    return { status: 'skipped', parsedQuery: EMPTY_PARSED_QUERY, totalRecords: 0, resultCount: 0, results: [], issues }
  }
  if (result.status === 'error') {
    return {
      status: 'error',
      parsedQuery: EMPTY_PARSED_QUERY,
      totalRecords: result.index.records.length,
      resultCount: 0,
      results: [],
      issues: [...issues, result.error.code],
      errorCode: result.error.code,
    }
  }

  const search = searchRagIndex(result.index, query, opts)
  return {
    status: 'ok',
    parsedQuery: search.parsedQuery,
    totalRecords: search.totalRecords,
    resultCount: search.resultCount,
    results: search.results,
    issues,
  }
}
