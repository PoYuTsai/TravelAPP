/**
 * Type definitions for the Notion 2026 team-collaboration **read** adapter.
 *
 * READ-ONLY phase: these types describe how we classify, mask, and summarise
 * confirmed cases pulled from the Notion 2026 team database. There is NO write
 * path here — insert/update/archive are deferred to Phase B2 / Phase D.
 *
 * Design notes:
 *   - Field sensitivity mirrors the four-tier classification in the
 *     chiangway-notion-fill skill, plus an explicit `private` tier that must
 *     NEVER reach any partner-facing output.
 *   - The fixture shape (`NotionPageFixture`) is intentionally minimal — it does
 *     NOT model the full Notion SDK property envelope. The future real adapter
 *     converts Notion API responses into this simple shape so all read logic
 *     stays SDK-agnostic and unit-testable without the network.
 */

// ---------------------------------------------------------------------------
// Field sensitivity — aligned with chiangway-notion-fill four tiers + private
// ---------------------------------------------------------------------------

export type FieldSensitivity =
  | 'read_only'        // readable & summarisable (itinerary structure, city, nights, party…)
  | 'draft_write'      // not written this Phase; classification only for future write path
  | 'confirmed_write'  // not written this Phase
  | 'manual_only'      // never auto-processed
  | 'private'          // Eric/DC private context, never in partner output (cost/profit/private notes/2025-2026 private)

// Which audience may see a given field.
export type AudienceScope = 'partner_group' | 'operator_only' | 'never'

// ---------------------------------------------------------------------------
// NotionPageFixture — minimal page shape (NOT the full Notion SDK envelope)
// ---------------------------------------------------------------------------

export interface NotionPageFixture {
  id: string
  databaseId: string
  /**
   * Raw property bag keyed by the Notion property NAME (e.g. '日期', '成本').
   * Values are plain (string | number | array) — the real adapter flattens
   * Notion's typed property objects into this minimal form.
   */
  properties: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// QuoteTier — price buckets; partners never see an exact amount (MVP: per 10k THB)
// ---------------------------------------------------------------------------

export type QuoteTier =
  | '<10k' | '10k-20k' | '20k-30k' | '30k-50k' | '50k+' | 'unknown'

// ---------------------------------------------------------------------------
// FieldPolicyEntry — one classification row
// ---------------------------------------------------------------------------

export interface FieldPolicyEntry {
  /** Notion property name (per fixtures schema). */
  property: string
  sensitivity: FieldSensitivity
  /** partner_group: shareable summary; operator_only: Eric/DC only; never: never output. */
  audience: AudienceScope
  /** Masking applied on output (amount → range, notes → truncate, sensitive → omit). */
  mask?: 'range' | 'omit' | 'truncate'
}

// ---------------------------------------------------------------------------
// CaseReferenceSummary — clean summary; no full-page copy, no Notion link, no token
// ---------------------------------------------------------------------------

export interface CaseReferenceSummary {
  /** De-identified internal reference id (NOT a Notion page url). */
  refId: string
  dates?: string          // date / day range
  nights?: number
  adults?: number
  children?: number
  childAges?: number[]    // children's ages
  cityArea?: string       // city / area
  tripType?: string       // trip type
  highlights?: string[]   // attractions / restaurants (already sensitivity-filtered)
  quoteTier?: QuoteTier   // price bucket only — partners never get the exact amount
  carGuideSetup?: string  // car + guide setup (when allowed)
  specialNeeds?: string
  internalNotes?: string  // operator_only, truncated to 120 chars; omitted for partners
  internalTags?: string[] // operator_only; omitted for partners
  lastStatus?: string
  /** Which sensitive fields were masked / omitted — for transparency. */
  omittedFields: string[]
}

// ---------------------------------------------------------------------------
// Query / result shapes for similar-case search
// ---------------------------------------------------------------------------

export interface SimilarCaseQuery {
  /** Structured conditions (mostly from case.knownFacts). */
  adults?: number
  children?: number
  childAges?: number[]
  cityArea?: string
  tripType?: string
  nights?: number
  dates?: string
  /** Free text (the itinerary a user pasted / a DC command). */
  freeText?: string
}

export interface SimilarCaseResult {
  summary: CaseReferenceSummary
  score: number            // 0–1 deterministic score
  matchedOn: string[]      // why it is similar (dimensions hit)
  referencePoints: string[]// usable reference points
  uncertain: string[]      // missing / uncertain dimensions
}

export interface SimilarCaseSearchOutput {
  audience: AudienceScope
  query: SimilarCaseQuery
  results: SimilarCaseResult[]
  notes: string[]          // global missing-data / search-limit reminders
}
