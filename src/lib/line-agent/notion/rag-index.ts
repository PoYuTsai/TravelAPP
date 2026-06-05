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
  adults?: number
  children?: number
  childAges?: number[]
  flightInfo?: string
  pickupInfo?: string
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
    `a:${facts.adults ?? ''}`,
    `c:${facts.children ?? ''}`,
    `ca:${normalizeArray(facts.childAges)}`,
    `f:${normalizeText(facts.flightInfo ?? '')}`,
    `p:${normalizeText(facts.pickupInfo ?? '')}`,
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
