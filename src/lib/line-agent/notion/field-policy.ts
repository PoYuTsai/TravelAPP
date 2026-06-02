/**
 * Field policy for the Notion 2026 team-collaboration **read** adapter.
 *
 * Deterministic classification table + alias normalisation + audience filter.
 *
 * SAFETY MODEL (whitelist): any property we do not explicitly recognise is
 * treated as `private` + `never` — it reaches no output. Sensitive fields
 * (cost, profit-share, customer name, private full text) are always omitted;
 * operator_only is only a little more open than partner_group (truncated
 * internal notes, internal tags, and a price *bucket* — never an exact amount,
 * never raw cost/profit).
 *
 * The real 2026 DB schema is NOT yet imported: classification keys off a
 * stable set of CANONICAL fields, and raw Notion property names are mapped in
 * via FIELD_ALIASES. When Eric supplies the real schema, extend FIELD_ALIASES
 * only — do not change the canonical set or the table below.
 */

import type {
  AudienceScope,
  FieldPolicyEntry,
  FieldSensitivity,
  QuoteTier,
} from './types'

// ---------------------------------------------------------------------------
// Canonical fields — the single source of truth shared by fixtures and policy
// ---------------------------------------------------------------------------

export type CanonicalField =
  | 'dates' | 'nights' | 'partySize' | 'adults' | 'children' | 'childAges'
  | 'cityArea' | 'tripType' | 'itinerarySummary' | 'highlights'
  | 'carGuideSetup' | 'quoteTotal' | 'status' | 'specialNeeds'
  | 'internalNotes' | 'internalTags' | 'cost' | 'profitShare'

// alias (raw Notion property name) → canonical. Extend when real schema lands.
export const FIELD_ALIASES: Record<string, CanonicalField> = {
  日期: 'dates', 出發日期: 'dates', 旅遊日期: 'dates',
  天數: 'nights', 人數: 'partySize', 大人: 'adults',
  小孩: 'children', 小孩年齡: 'childAges', 城市區域: 'cityArea',
  行程類型: 'tripType', 行程摘要: 'itinerarySummary',
  景點餐廳: 'highlights', 車導配置: 'carGuideSetup',
  報價總額: 'quoteTotal', 狀態: 'status', 特殊需求: 'specialNeeds',
  內部備註: 'internalNotes',
  內部標籤: 'internalTags', 標籤: 'internalTags', Tags: 'internalTags',
  成本: 'cost', 分潤: 'profitShare',
}

const CANONICAL_FIELDS = new Set<string>(Object.values(FIELD_ALIASES))

const INTERNAL_NOTES_MAX = 120

// ---------------------------------------------------------------------------
// Policy table — canonical field → sensitivity / max audience / mask
// ---------------------------------------------------------------------------

type PolicyRow = {
  sensitivity: FieldSensitivity
  audience: AudienceScope
  mask?: FieldPolicyEntry['mask']
}

const READ_ONLY_SHAREABLE: PolicyRow = { sensitivity: 'read_only', audience: 'partner_group' }

const POLICY: Record<CanonicalField, PolicyRow> = {
  dates: READ_ONLY_SHAREABLE,
  nights: READ_ONLY_SHAREABLE,
  partySize: READ_ONLY_SHAREABLE,
  adults: READ_ONLY_SHAREABLE,
  children: READ_ONLY_SHAREABLE,
  childAges: READ_ONLY_SHAREABLE,
  cityArea: READ_ONLY_SHAREABLE,
  tripType: READ_ONLY_SHAREABLE,
  itinerarySummary: READ_ONLY_SHAREABLE,
  highlights: READ_ONLY_SHAREABLE,
  carGuideSetup: READ_ONLY_SHAREABLE,
  status: READ_ONLY_SHAREABLE,
  specialNeeds: READ_ONLY_SHAREABLE,
  // partners get a bucket only; operators also only a bucket — never the exact amount
  quoteTotal: { sensitivity: 'read_only', audience: 'partner_group', mask: 'range' },
  // operator_only: note truncated, tags visible — never to partners
  internalNotes: { sensitivity: 'read_only', audience: 'operator_only', mask: 'truncate' },
  internalTags: { sensitivity: 'read_only', audience: 'operator_only' },
  // private: never to anyone
  cost: { sensitivity: 'private', audience: 'never', mask: 'omit' },
  profitShare: { sensitivity: 'private', audience: 'never', mask: 'omit' },
}

// Default for unknown properties — whitelist: deny by default.
const UNKNOWN_POLICY: PolicyRow = { sensitivity: 'private', audience: 'never', mask: 'omit' }

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/** Raw Notion property name → canonical key (via FIELD_ALIASES). Unknown → null. */
export function normalizeField(property: string): CanonicalField | null {
  if (CANONICAL_FIELDS.has(property)) return property as CanonicalField
  return FIELD_ALIASES[property] ?? null
}

/** Classify a raw property name. Unknown → private + never (whitelist default). */
export function classifyField(property: string): FieldPolicyEntry {
  const canonical = normalizeField(property)
  if (canonical === null) {
    return { property, ...UNKNOWN_POLICY }
  }
  return { property: canonical, ...POLICY[canonical] }
}

/** Is a property visible to the given viewer audience? */
export function isVisibleTo(property: string, audience: AudienceScope): boolean {
  if (audience === 'never') return false
  const entry = classifyField(property)
  if (entry.audience === 'never') return false
  // partner_group fields are visible to everyone (partners ⊂ operators)
  if (entry.audience === 'partner_group') return true
  // operator_only fields are visible only to operators
  return audience === 'operator_only'
}

/** Apply the field's value-level mask. Returns the value to store in `visible`. */
function applyMask(value: unknown, mask: FieldPolicyEntry['mask']): unknown {
  if (mask === 'range') {
    return toQuoteTier(typeof value === 'number' ? value : Number(value))
  }
  if (mask === 'truncate' && typeof value === 'string' && value.length > INTERNAL_NOTES_MAX) {
    return value.slice(0, INTERNAL_NOTES_MAX - 1) + '…'
  }
  return value
}

/**
 * Filter a raw property bag down to the keys visible to `audience`.
 *
 * `visible` is keyed by CANONICAL field name and carries already-masked values
 * (price → bucket, long note → truncated). `omitted` lists the RAW property
 * names that were dropped (sensitivity or unknown), for transparency.
 */
export function filterProperties(
  raw: Record<string, unknown>,
  audience: AudienceScope
): { visible: Record<string, unknown>; omitted: string[] } {
  const visible: Record<string, unknown> = {}
  const omitted: string[] = []

  for (const [rawName, value] of Object.entries(raw)) {
    const canonical = normalizeField(rawName)
    if (canonical === null || !isVisibleTo(rawName, audience)) {
      omitted.push(rawName)
      continue
    }
    visible[canonical] = applyMask(value, POLICY[canonical].mask)
  }

  return { visible, omitted }
}

/** Exact amount → coarse bucket. Partners/operators only ever see the bucket. */
export function toQuoteTier(amount: number | null | undefined): QuoteTier {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return 'unknown'
  if (amount < 10000) return '<10k'
  if (amount < 20000) return '10k-20k'
  if (amount < 30000) return '20k-30k'
  if (amount < 50000) return '30k-50k'
  return '50k+'
}
