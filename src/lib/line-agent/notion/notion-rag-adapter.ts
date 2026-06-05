/**
 * Notion read adapter (fixture-first) — NotionPageFixture → RagIndexRecord[].
 *
 * Bridges the minimal Notion page shape (types.ts) to the RAG index contract
 * (rag-index.ts). It is deliberately SDK-agnostic and network-free: the future
 * real adapter only has to flatten a Notion API response into NotionPageFixture
 * and this layer keeps working unchanged.
 *
 * NO real Notion API, NO real database id, NO Sanity / webhook / send gate.
 *
 * Mapping rules:
 *   - Property NAMES are normalised through the shared FIELD_ALIASES
 *     (field-policy.ts) so date/area/theme aliases resolve in one place.
 *   - Duration is the ONE exception: field-policy conflates 天數 into canonical
 *     'nights', but the RAG layer keeps days and nights distinct, so the adapter
 *     owns its own duration aliases. Eric's rule (2026-06-05):
 *         天數 → days, 夜數 → nights, NEVER auto-derive nights = days - 1.
 *   - Shareable trip structure → facts (partner-safe).
 *   - Private fields (成本/分潤) + provenance (databaseId) → privateContext only;
 *     toPartnerSafeView() drops them downstream.
 *   - Whitelist by construction: only recognised properties are read, so an
 *     unknown / sensitive field (客人姓名) never enters the record at all.
 */

import type {
  AudienceScope,
  NotionPageFixture,
} from './types'
import { normalizeField } from './field-policy'
import {
  buildRagIndexRecord,
  type RagCaseFacts,
  type RagIndexRecord,
  type RagPrivateContext,
  type RagSourceTable,
} from './rag-index'

export interface NotionRagAdapterOptions {
  /** Which corpus these pages came from — the page shape carries no tag. */
  sourceTable: RagSourceTable
}

// Duration aliases owned by the adapter (see header — field-policy conflates 天數).
const DAYS_ALIASES = new Set(['天數', '天数', '行程天數'])
const NIGHTS_ALIASES = new Set(['夜數', '夜数', '晚數', '晚数'])

// Cross-table stable case id (future「清微案例ID」), highest-priority dedupe key.
const CASE_ID_ALIASES = new Set(['案例ID', '清微案例ID', 'caseId', 'caseID'])

// Facts are always partner-safe (read_only structure only); privacy lives in
// privateContext and is enforced at projection time, not here.
const FACTS_AUDIENCE: AudienceScope = 'partner_group'

// --- coercion helpers ------------------------------------------------------

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined
}

function asNumberArray(v: unknown): number[] | undefined {
  if (!Array.isArray(v)) return undefined
  const nums = v.filter((x): x is number => typeof x === 'number' && !Number.isNaN(x))
  return nums.length > 0 ? nums : undefined
}

/** One-element hint array from a single area / theme string (empty → undefined). */
function asHints(v: unknown): string[] | undefined {
  const s = asString(v)
  return s ? [s] : undefined
}

/** Set a key only when the value is defined — keeps facts free of empty slots. */
function setIf<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) target[key] = value
}

// --- core ------------------------------------------------------------------

interface ParsedPage {
  facts: RagCaseFacts
  privateContext: RagPrivateContext
  canonicalCaseId?: string
}

function parseProperties(properties: Record<string, unknown>): ParsedPage {
  const facts: RagCaseFacts = {}
  const privateContext: RagPrivateContext = {}
  let canonicalCaseId: string | undefined

  for (const [rawName, value] of Object.entries(properties)) {
    if (CASE_ID_ALIASES.has(rawName)) {
      canonicalCaseId = asString(value) ?? canonicalCaseId
      continue
    }
    if (DAYS_ALIASES.has(rawName)) {
      setIf(facts, 'days', asNumber(value))
      continue
    }
    if (NIGHTS_ALIASES.has(rawName)) {
      setIf(facts, 'nights', asNumber(value))
      continue
    }

    // Everything else routes through the shared canonical map. Unknown
    // properties resolve to null and are simply never read (whitelist).
    switch (normalizeField(rawName)) {
      case 'dates':
        setIf(facts, 'travelDateRange', asString(value))
        break
      case 'adults':
        setIf(facts, 'adults', asNumber(value))
        break
      case 'children':
        setIf(facts, 'children', asNumber(value))
        break
      case 'childAges':
        setIf(facts, 'childAges', asNumberArray(value))
        break
      case 'cityArea':
        setIf(facts, 'areaHints', asHints(value))
        break
      case 'tripType':
        setIf(facts, 'themeHints', asHints(value))
        break
      case 'itinerarySummary':
        setIf(facts, 'itinerarySnippet', asString(value))
        break
      case 'cost':
        setIf(privateContext, 'cost', asNumber(value))
        break
      case 'profitShare':
        // RagPrivateContext.profitShare is a string (split descriptor or amount).
        setIf(
          privateContext,
          'profitShare',
          value === undefined || value === null ? undefined : String(value)
        )
        break
      default:
        break // 人數/景點餐廳/車導配置/狀態/內部備註… not RAG facts; intentionally dropped
    }
  }

  return { facts, privateContext, canonicalCaseId }
}

/** Convert one Notion page (minimal fixture shape) into a RagIndexRecord. */
export function notionPageToRagRecord(
  page: NotionPageFixture,
  opts: NotionRagAdapterOptions
): RagIndexRecord {
  const { facts, privateContext, canonicalCaseId } = parseProperties(page.properties)

  // Provenance: the page's own database id is operator-only context.
  setIf(privateContext, 'databaseId', asString(page.databaseId))

  const hasPrivate = Object.keys(privateContext).length > 0

  return buildRagIndexRecord({
    identity: {
      canonicalCaseId,
      sourceRecordIds: [page.id],
      sourceTables: [opts.sourceTable],
    },
    facts,
    audience: FACTS_AUDIENCE,
    privateContext: hasPrivate ? privateContext : undefined,
  })
}

/** Convert a batch of pages. Feed the result straight into buildRagIndex(). */
export function notionPagesToRagRecords(
  pages: NotionPageFixture[],
  opts: NotionRagAdapterOptions
): RagIndexRecord[] {
  return pages.map((page) => notionPageToRagRecord(page, opts))
}
