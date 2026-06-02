/**
 * Read path for the Notion 2026 team-collaboration database.
 *
 * Deterministic similar-case search (NO LLM / RAG this Phase). Pulls confirmed
 * cases via a NotionReadClient (read-only; 2026 database id only), maps each to
 * an audience-masked CaseReferenceSummary, scores them against a query, and
 * returns ranked results plus a clean search output.
 *
 * Every search optionally writes ONE notion_read audit entry through an
 * injected sink (DI). The audit is NOT a CaseStore state transition — it has no
 * required caseId and is never funnelled through CaseStore.appendAudit. There
 * is NO write path to Notion here.
 */

import type {
  AudienceScope,
  CaseReferenceSummary,
  NotionPageFixture,
  SimilarCaseQuery,
  SimilarCaseResult,
  SimilarCaseSearchOutput,
} from './types'
import { classifyField } from './field-policy'
import { mapPageToSummary } from './notion-mapper'
import { TEAM_2026_DATABASE_LABEL } from './__fixtures__/team-2026-schema'

// ---------------------------------------------------------------------------
// Read client + read-audit contracts
// ---------------------------------------------------------------------------

export interface NotionReadClient {
  /** Read-only. Implementations MUST accept only the 2026 database id and throw otherwise. */
  queryTeam2026(databaseId: string): Promise<NotionPageFixture[]>
}

export interface NotionReadAuditEntry {
  type: 'notion_read'
  actor: 'eric' | 'tsai' | 'chun' | 'ai-agent'
  audience: AudienceScope
  querySummary: string        // human-readable, no secret
  databaseLabel: string       // stable label / short hash — never the full id
  resultCount: number
  omittedSensitiveCount: number
  caseId?: string             // optional — operator/DC queries need not bind a case
  timestamp: number           // injected; never Date.now() internally
}

/** Independent read-audit sink — kept separate from CaseStore transition audit. */
export interface NotionReadAuditSink {
  appendNotionRead(entry: NotionReadAuditEntry): Promise<void>
}

export interface SearchOptions {
  auditSink?: NotionReadAuditSink
  databaseId?: string
  limit?: number
  actor?: NotionReadAuditEntry['actor']
  caseId?: string
  /** Injected timestamp for the audit entry (never generated internally). */
  timestamp?: number
}

// ---------------------------------------------------------------------------
// Deterministic scoring
// ---------------------------------------------------------------------------

const WEIGHTS = {
  children: 3, // parenting composition — highest
  childAges: 2,
  adults: 1,
  cityArea: 2,
  tripType: 2,
  nights: 1,
  freeText: 1,
} as const

const DEFAULT_LIMIT = 5

interface DimScore {
  dimension: string
  points: number    // points earned (0..weight)
  weight: number    // max points for this dimension
  matched: boolean  // counted into matchedOn
  uncertain: boolean// query asked but candidate lacks data
}

function scoreChildren(query: SimilarCaseQuery, s: CaseReferenceSummary): DimScore | null {
  if (query.children === undefined) return null
  const w = WEIGHTS.children
  if (s.children === undefined) {
    return { dimension: 'children', points: 0, weight: w, matched: false, uncertain: true }
  }
  if (s.children === query.children) {
    return { dimension: 'children', points: w, weight: w, matched: true, uncertain: false }
  }
  // both are families (>0) but different count → partial
  if (s.children > 0 && query.children > 0) {
    return { dimension: 'children', points: w * 0.5, weight: w, matched: true, uncertain: false }
  }
  return { dimension: 'children', points: 0, weight: w, matched: false, uncertain: false }
}

function scoreChildAges(query: SimilarCaseQuery, s: CaseReferenceSummary): DimScore | null {
  if (query.childAges === undefined || query.childAges.length === 0) return null
  const w = WEIGHTS.childAges
  if (s.childAges === undefined || s.childAges.length === 0) {
    return { dimension: 'childAges', points: 0, weight: w, matched: false, uncertain: true }
  }
  // overlap ratio of ±1-year matches
  const hits = query.childAges.filter((q) =>
    s.childAges!.some((c) => Math.abs(c - q) <= 1)
  ).length
  const ratio = hits / query.childAges.length
  return {
    dimension: 'childAges',
    points: w * ratio,
    weight: w,
    matched: ratio > 0,
    uncertain: false,
  }
}

function scoreAdults(query: SimilarCaseQuery, s: CaseReferenceSummary): DimScore | null {
  if (query.adults === undefined) return null
  const w = WEIGHTS.adults
  if (s.adults === undefined) {
    return { dimension: 'adults', points: 0, weight: w, matched: false, uncertain: true }
  }
  const matched = s.adults === query.adults
  return { dimension: 'adults', points: matched ? w : 0, weight: w, matched, uncertain: false }
}

function scoreText(
  query: SimilarCaseQuery,
  s: CaseReferenceSummary,
  field: 'cityArea' | 'tripType'
): DimScore | null {
  const q = query[field]
  if (q === undefined) return null
  const w = WEIGHTS[field]
  const v = s[field]
  if (v === undefined) {
    return { dimension: field, points: 0, weight: w, matched: false, uncertain: true }
  }
  if (v === q) return { dimension: field, points: w, weight: w, matched: true, uncertain: false }
  if (v.includes(q) || q.includes(v)) {
    return { dimension: field, points: w * 0.5, weight: w, matched: true, uncertain: false }
  }
  return { dimension: field, points: 0, weight: w, matched: false, uncertain: false }
}

function scoreNights(query: SimilarCaseQuery, s: CaseReferenceSummary): DimScore | null {
  if (query.nights === undefined) return null
  const w = WEIGHTS.nights
  if (s.nights === undefined) {
    return { dimension: 'nights', points: 0, weight: w, matched: false, uncertain: true }
  }
  const diff = Math.abs(s.nights - query.nights)
  const points = diff === 0 ? w : diff === 1 ? w * 0.5 : 0
  return { dimension: 'nights', points, weight: w, matched: points > 0, uncertain: false }
}

function scoreFreeText(query: SimilarCaseQuery, s: CaseReferenceSummary): DimScore | null {
  const ft = query.freeText?.trim()
  if (!ft) return null
  const w = WEIGHTS.freeText
  const haystack = [s.tripType ?? '', ...(s.highlights ?? [])]
  // any highlight/tripType that appears in the free text (or vice versa)
  const matched = haystack.some(
    (h) => h.length > 0 && (ft.includes(h) || h.includes(ft))
  )
  return { dimension: 'freeText', points: matched ? w : 0, weight: w, matched, uncertain: false }
}

function scoreSummary(
  query: SimilarCaseQuery,
  summary: CaseReferenceSummary
): Pick<SimilarCaseResult, 'score' | 'matchedOn' | 'uncertain' | 'referencePoints'> {
  const dims = [
    scoreChildren(query, summary),
    scoreChildAges(query, summary),
    scoreAdults(query, summary),
    scoreText(query, summary, 'cityArea'),
    scoreText(query, summary, 'tripType'),
    scoreNights(query, summary),
    scoreFreeText(query, summary),
  ].filter((d): d is DimScore => d !== null)

  const maxPoints = dims.reduce((sum, d) => sum + d.weight, 0)
  const gotPoints = dims.reduce((sum, d) => sum + d.points, 0)
  const score = maxPoints > 0 ? Number((gotPoints / maxPoints).toFixed(4)) : 0

  const matchedOn = dims.filter((d) => d.matched).map((d) => d.dimension)
  const uncertain = dims.filter((d) => d.uncertain).map((d) => d.dimension)

  // reference points = the concrete, shareable facts worth reusing
  const referencePoints: string[] = []
  if (summary.carGuideSetup) referencePoints.push(`車導：${summary.carGuideSetup}`)
  if (summary.specialNeeds) referencePoints.push(`特殊需求：${summary.specialNeeds}`)
  if (summary.highlights?.length) referencePoints.push(`亮點：${summary.highlights.join('、')}`)
  if (summary.quoteTier) referencePoints.push(`報價級距：${summary.quoteTier}`)

  return { score, matchedOn, uncertain, referencePoints }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function countOmittedSensitive(results: SimilarCaseResult[]): number {
  let count = 0
  for (const r of results) {
    for (const raw of r.summary.omittedFields) {
      if (classifyField(raw).sensitivity === 'private') count += 1
    }
  }
  return count
}

function summariseQuery(query: SimilarCaseQuery): string {
  const parts: string[] = []
  if (query.adults !== undefined) parts.push(`大人${query.adults}`)
  if (query.children !== undefined) parts.push(`小孩${query.children}`)
  if (query.childAges?.length) parts.push(`年齡${query.childAges.join('/')}`)
  if (query.cityArea) parts.push(`城市${query.cityArea}`)
  if (query.tripType) parts.push(`類型${query.tripType}`)
  if (query.nights !== undefined) parts.push(`${query.nights}晚`)
  if (query.freeText) parts.push(`文字「${query.freeText.slice(0, 20)}」`)
  return parts.length > 0 ? parts.join('，') : '(無結構化條件)'
}

export async function searchSimilarCases(
  client: NotionReadClient,
  query: SimilarCaseQuery,
  audience: AudienceScope,
  opts: SearchOptions = {}
): Promise<SimilarCaseSearchOutput> {
  const databaseId = opts.databaseId ?? process.env.NOTION_TEAM_2026_DATABASE_ID
  if (!databaseId) {
    throw new Error('searchSimilarCases: no NOTION_TEAM_2026_DATABASE_ID configured')
  }

  // Read-only; the client enforces the 2026-only rule (throws on other ids).
  const pages = await client.queryTeam2026(databaseId)

  const limit = opts.limit ?? DEFAULT_LIMIT

  const results: SimilarCaseResult[] = pages
    .map((page) => {
      const summary = mapPageToSummary(page, audience)
      const { score, matchedOn, uncertain, referencePoints } = scoreSummary(query, summary)
      return { summary, score, matchedOn, referencePoints, uncertain }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  const notes: string[] = []
  if (summariseQuery(query) === '(無結構化條件)' && !query.freeText) {
    notes.push('未提供搜尋條件，結果僅為近期案例樣本。')
  }
  notes.push('deterministic 排序（未使用 LLM）。')

  // One read-audit entry per search, only if a sink was injected.
  if (opts.auditSink) {
    const entry: NotionReadAuditEntry = {
      type: 'notion_read',
      actor: opts.actor ?? 'ai-agent',
      audience,
      querySummary: summariseQuery(query),
      databaseLabel: TEAM_2026_DATABASE_LABEL,
      resultCount: results.length,
      omittedSensitiveCount: countOmittedSensitive(results),
      caseId: opts.caseId,
      timestamp: opts.timestamp ?? 0,
    }
    await opts.auditSink.appendNotionRead(entry)
  }

  return { audience, query, results, notes }
}
