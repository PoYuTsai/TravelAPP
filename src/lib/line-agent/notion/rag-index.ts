/**
 * Notion RAG index identity + dedupe primitives (v1).
 *
 * Pure, synchronous functions only — NO env, NO fetch, NO Notion client, NO
 * fuzzy matching. This layer crystallizes the source-of-truth rules in
 * docs/ai-agent-knowledge/rules/notion-rag-sources.md so a future traverse /
 * index-builder job can consume a stable contract.
 *
 * Two-layer dedupe identity (hybrid):
 *   Layer 1 — explicit stable key `canonicalCaseId` (highest priority).
 *   Layer 2 — deterministic composite natural-key fingerprint (fallback).
 *
 * Source rules:
 *   - private_2026 > team_2026 (same 2026 case; private is the fuller canonical).
 *   - private_2025 is an independent frozen historical corpus — never strong-
 *     merged with 2026.
 *   - markdown_template is a curated retrieval seed — never strong-deduped with
 *     a Notion case.
 *
 * Privacy: an index record may carry private context (cost, profit share,
 * Notion page url, database id, private notes); the partner-safe view MUST drop
 * all of it.
 */

import { createHash } from 'node:crypto'
import type { AudienceScope } from './types'

// ---------------------------------------------------------------------------
// Source tables + identity
// ---------------------------------------------------------------------------

export type RagSourceTable =
  | 'private_2026'
  | 'team_2026'
  | 'private_2025'
  | 'markdown_template'

export interface RagCaseIdentity {
  /** Cross-table stable case id (future「清微案例ID」). When present it is the highest-priority dedupe key. */
  canonicalCaseId?: string
  /** Raw source record ids — never leaked to partner output. */
  sourceRecordIds: string[]
  /** Which source corpora this record was assembled from. */
  sourceTables: RagSourceTable[]
}

// ---------------------------------------------------------------------------
// Fingerprint-relevant facts (Layer 2 natural key)
// ---------------------------------------------------------------------------

export interface RagCaseFacts {
  travelDateRange?: string
  nights?: number
  days?: number
  /** Total head-count (真實「旅遊人數」). adults/children are a further, optional split. */
  partySize?: number
  adults?: number
  children?: number
  childAges?: number[]
  flightInfo?: string
  pickupInfo?: string
  /** Charter vehicle type (真實「包車車型」) — a first-class retrieval fact, not buried in text. */
  vehicleType?: string
  /** Itinerary framework text; normalized before hashing (structure only, no invented facts). */
  itinerarySnippet?: string
  areaHints?: string[]
  themeHints?: string[]
}

// ---------------------------------------------------------------------------
// Private context — operator-only; NEVER reaches partner output
// ---------------------------------------------------------------------------

export interface RagPrivateContext {
  notionPageUrl?: string
  databaseId?: string
  cost?: number
  /** 真實「總收入」— operator-only; partner-safe view MUST drop it. */
  revenue?: number | string
  profitShare?: string
  privateNotes?: string
}

// ---------------------------------------------------------------------------
// Index record + partner-safe view
// ---------------------------------------------------------------------------

export interface RagIndexRecord {
  identity: RagCaseIdentity
  fingerprint: string
  facts: RagCaseFacts
  audience: AudienceScope
  privateContext?: RagPrivateContext
}

export interface RagPartnerSafeView {
  /** De-identified key (canonicalCaseId or fingerprint) — never a Notion url / db id. */
  caseKey: string
  facts: RagCaseFacts
  sourceTables: RagSourceTable[]
}

// ---------------------------------------------------------------------------
// Deterministic natural-key fingerprint
// ---------------------------------------------------------------------------

/**
 * Collapse semantically-equivalent text into one canonical form: NFKC unifies
 * full/half-width forms, then whitespace and a fixed punctuation/separator set
 * are stripped so spacing and punctuation differences do not change the result.
 */
function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(
      /[\s　_~\-–—|｜:：;；,，、.。．・/／()（）[\]【】「」『』"'`]+/g,
      ''
    )
}

function normalizeArray(values: number[] | undefined): string
function normalizeArray(values: string[] | undefined): string
function normalizeArray(values: Array<number | string> | undefined): string {
  if (!values || values.length === 0) return ''
  if (typeof values[0] === 'number') {
    return [...(values as number[])].sort((a, b) => a - b).join('-')
  }
  return [...(values as string[])]
    .map(normalizeText)
    .filter((v) => v.length > 0)
    .sort()
    .join(',')
}

/**
 * Deterministic composite fingerprint: same data (modulo whitespace,
 * punctuation, full/half-width, and array order) → same fingerprint. v1 does
 * EXACT fingerprint matching only — no fuzzy / approximate comparison.
 */
export function computeNaturalFingerprint(facts: RagCaseFacts): string {
  const parts = [
    `d:${normalizeText(facts.travelDateRange ?? '')}`,
    `n:${facts.nights ?? ''}`,
    `dy:${facts.days ?? ''}`,
    `ps:${facts.partySize ?? ''}`,
    `a:${facts.adults ?? ''}`,
    `c:${facts.children ?? ''}`,
    `ca:${normalizeArray(facts.childAges)}`,
    `f:${normalizeText(facts.flightInfo ?? '')}`,
    `p:${normalizeText(facts.pickupInfo ?? '')}`,
    `v:${normalizeText(facts.vehicleType ?? '')}`,
    `it:${normalizeText(facts.itinerarySnippet ?? '')}`,
    `ar:${normalizeArray(facts.areaHints)}`,
    `th:${normalizeArray(facts.themeHints)}`,
  ]
  const canonical = parts.join('#')
  return 'fp_' + createHash('sha256').update(canonical).digest('hex')
}

// ---------------------------------------------------------------------------
// Record construction + key resolution
// ---------------------------------------------------------------------------

export function buildRagIndexRecord(input: {
  identity: RagCaseIdentity
  facts: RagCaseFacts
  audience: AudienceScope
  privateContext?: RagPrivateContext
}): RagIndexRecord {
  return {
    identity: input.identity,
    fingerprint: computeNaturalFingerprint(input.facts),
    facts: input.facts,
    audience: input.audience,
    privateContext: input.privateContext,
  }
}

/** Explicit stable key wins; otherwise fall back to the natural fingerprint. */
export function resolveCaseKey(record: RagIndexRecord): string {
  return record.identity.canonicalCaseId ?? record.fingerprint
}

// ---------------------------------------------------------------------------
// Source priority + merge
// ---------------------------------------------------------------------------

const SOURCE_RANK: Record<RagSourceTable, number> = {
  private_2026: 3, // fullest itinerary + private context → canonical facts
  team_2026: 2, // duplicate subset of the private 2026 case
  private_2025: 1,
  markdown_template: 0,
}

function recordRank(record: RagIndexRecord): number {
  return record.identity.sourceTables.reduce(
    (max, t) => Math.max(max, SOURCE_RANK[t]),
    0
  )
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

/**
 * Merge two records known to be the same case. The higher-ranked source
 * (private_2026 > team_2026) supplies the canonical facts / fingerprint; record
 * provenance (sourceRecordIds, sourceTables) is unioned. Argument order does
 * not matter — rank decides.
 */
export function mergeCaseRecords(a: RagIndexRecord, b: RagIndexRecord): RagIndexRecord {
  const [canonical, other] = recordRank(a) >= recordRank(b) ? [a, b] : [b, a]
  return {
    identity: {
      canonicalCaseId: canonical.identity.canonicalCaseId ?? other.identity.canonicalCaseId,
      sourceRecordIds: uniq([
        ...canonical.identity.sourceRecordIds,
        ...other.identity.sourceRecordIds,
      ]),
      sourceTables: uniq([
        ...canonical.identity.sourceTables,
        ...other.identity.sourceTables,
      ]),
    },
    fingerprint: canonical.fingerprint,
    facts: canonical.facts,
    audience: canonical.audience,
    privateContext:
      canonical.privateContext || other.privateContext
        ? { ...other.privateContext, ...canonical.privateContext }
        : undefined,
  }
}

/**
 * Merge key for a record, or null when it must NOT auto-merge in v1.
 * private_2025 (independent historical corpus) and markdown_template (curated
 * seed) are passthrough — they never strong-merge, even on a fingerprint clash.
 */
function mergeKeyFor(record: RagIndexRecord): string | null {
  const independent = record.identity.sourceTables.some(
    (t) => t === 'private_2025' || t === 'markdown_template'
  )
  if (independent) return null
  if (record.identity.canonicalCaseId) return `cid:${record.identity.canonicalCaseId}`
  return `fp:${record.fingerprint}`
}

/**
 * Dedupe records by case identity. canonicalCaseId beats fingerprint; only 2026
 * Notion records (private_2026 / team_2026) participate in fingerprint merging.
 * Order of the surviving records is stable (first-seen for merged keys, then
 * passthrough records in input order).
 */
export function dedupeCaseRecords(records: RagIndexRecord[]): RagIndexRecord[] {
  const byKey = new Map<string, RagIndexRecord>()
  const passthrough: RagIndexRecord[] = []

  for (const record of records) {
    const key = mergeKeyFor(record)
    if (key === null) {
      passthrough.push(record)
      continue
    }
    const existing = byKey.get(key)
    byKey.set(key, existing ? mergeCaseRecords(existing, record) : record)
  }

  return [...Array.from(byKey.values()), ...passthrough]
}

// ---------------------------------------------------------------------------
// Partner-safe projection
// ---------------------------------------------------------------------------

/** Project a record to a partner-safe view, dropping ALL private context. */
export function toPartnerSafeView(record: RagIndexRecord): RagPartnerSafeView {
  return {
    caseKey: resolveCaseKey(record),
    facts: record.facts,
    sourceTables: record.identity.sourceTables,
  }
}

// ---------------------------------------------------------------------------
// Fixture-backed searchable index (v1)
// ---------------------------------------------------------------------------
//
// buildRagIndex runs dedupe/merge once, then materializes lookup maps over the
// surviving records. queryRagIndex applies deterministic, EXACT filters (no
// fuzzy, no weighted scorer) and applies only the light ordering the spec
// allows: source priority first, then "more matched dimensions first".
//
// byCaseKey values are arrays because an independent corpus twin (private_2025
// / markdown_template) can share a fingerprint with a 2026 case yet must stay a
// separate record — so one resolved key can legitimately hold two records.

export interface RagIndex {
  /** Deduped/merged records in dedupe output order. */
  records: RagIndexRecord[]
  byCaseKey: Map<string, RagIndexRecord[]>
  bySourceTable: Map<RagSourceTable, RagIndexRecord[]>
  /** Normalized area token → records. */
  byArea: Map<string, RagIndexRecord[]>
  /** Normalized theme token → records. */
  byTheme: Map<string, RagIndexRecord[]>
}

export interface RagIndexQuery {
  /** Descriptive: at least one area / theme token must hit when any is given. */
  area?: string
  /** Multiple areas are OR-gated; each hit counts as a matched dimension. */
  areas?: string[]
  themes?: string[]
  /** Structural: exact equality required when given. */
  days?: number
  nights?: number
  partySize?: number
  adults?: number
  children?: number
  sourceTable?: RagSourceTable
}

function pushRecord<K>(map: Map<K, RagIndexRecord[]>, key: K, record: RagIndexRecord): void {
  const bucket = map.get(key)
  if (bucket) bucket.push(record)
  else map.set(key, [record])
}

/** Normalized, de-duplicated tokens for a hint array (empty tokens dropped). */
function hintTokens(values: string[] | undefined): string[] {
  if (!values) return []
  return uniq(values.map(normalizeText).filter((t) => t.length > 0))
}

/**
 * Build a searchable index from raw RagIndexRecord[]. Dedupe/merge is applied
 * first; the maps then index the surviving records by stable key, source table,
 * and normalized area / theme tokens.
 */
export function buildRagIndex(records: RagIndexRecord[]): RagIndex {
  const deduped = dedupeCaseRecords(records)
  const index: RagIndex = {
    records: deduped,
    byCaseKey: new Map(),
    bySourceTable: new Map(),
    byArea: new Map(),
    byTheme: new Map(),
  }

  for (const record of deduped) {
    pushRecord(index.byCaseKey, resolveCaseKey(record), record)
    for (const table of uniq(record.identity.sourceTables)) {
      pushRecord(index.bySourceTable, table, record)
    }
    for (const token of hintTokens(record.facts.areaHints)) {
      pushRecord(index.byArea, token, record)
    }
    for (const token of hintTokens(record.facts.themeHints)) {
      pushRecord(index.byTheme, token, record)
    }
  }

  return index
}

function matchesStructural(record: RagIndexRecord, query: RagIndexQuery): boolean {
  if (query.sourceTable && !record.identity.sourceTables.includes(query.sourceTable)) return false
  if (query.days !== undefined && record.facts.days !== query.days) return false
  if (query.nights !== undefined && record.facts.nights !== query.nights) return false
  if (query.partySize !== undefined && record.facts.partySize !== query.partySize) return false
  if (query.adults !== undefined && record.facts.adults !== query.adults) return false
  if (query.children !== undefined && record.facts.children !== query.children) return false
  return true
}

/** Stable, deterministic tiebreak so equal-rank/equal-match results never reorder. */
function tiebreakKey(record: RagIndexRecord): string {
  return [
    resolveCaseKey(record),
    record.fingerprint,
    [...record.identity.sourceTables].sort().join('+'),
  ].join('|')
}

/**
 * Query the index with deterministic filters. Structural dimensions
 * (sourceTable / days / nights / adults / children) must match exactly when
 * given. Descriptive dimensions (area / themes) are a candidate gate: when
 * either is provided a record must hit at least one. Results are ordered by
 * source priority, then by number of matched descriptive dimensions, then by a
 * stable key — never by a weighted score.
 */
export function queryRagIndex(index: RagIndex, query: RagIndexQuery): RagIndexRecord[] {
  // Single `area` and multi `areas` collapse into one normalized token set so a
  // multi-area query (清萊 + 芳縣) is OR-gated and each area hit ranks like a
  // matched theme dimension.
  const queryAreas = new Set<string>(hintTokens(query.areas))
  if (query.area) queryAreas.add(normalizeText(query.area))
  const queryThemes = hintTokens(query.themes)
  const hasDescriptive = queryAreas.size > 0 || queryThemes.length > 0

  const scored: Array<{ record: RagIndexRecord; matched: number }> = []
  for (const record of index.records) {
    if (!matchesStructural(record, query)) continue

    const recAreas = new Set(hintTokens(record.facts.areaHints))
    const recThemes = new Set(hintTokens(record.facts.themeHints))
    const areaHits = Array.from(queryAreas).filter((t) => recAreas.has(t)).length
    const themeHits = queryThemes.filter((t) => recThemes.has(t)).length

    if (hasDescriptive && areaHits === 0 && themeHits === 0) continue
    scored.push({ record, matched: areaHits + themeHits })
  }

  scored.sort((a, b) => {
    const rank = recordRank(b.record) - recordRank(a.record)
    if (rank !== 0) return rank
    if (b.matched !== a.matched) return b.matched - a.matched
    return tiebreakKey(a.record) < tiebreakKey(b.record) ? -1 : 1
  })

  return scored.map((s) => s.record)
}
