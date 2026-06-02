/**
 * Maps a Notion page (minimal fixture shape) into a clean CaseReferenceSummary.
 *
 * The mapper itself holds NO masking policy — it delegates to filterProperties
 * (field-policy.ts), which returns canonical-keyed, already-masked values for
 * the requested audience. The mapper only shapes that visible subset into the
 * summary type. It never copies the full page and never emits a Notion link or
 * token; `omittedFields` carries the raw names that were dropped.
 */

import type {
  AudienceScope,
  CaseReferenceSummary,
  NotionPageFixture,
  QuoteTier,
} from './types'
import { filterProperties } from './field-policy'

// Small coercion helpers — visible values are `unknown`; wrong type → undefined.
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

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const strs = v.filter((x): x is string => typeof x === 'string')
  return strs.length > 0 ? strs : undefined
}

/**
 * Notion page → CaseReferenceSummary for the given audience.
 *
 * Note: `quoteTier` is read straight from the policy-bucketed `quoteTotal`
 * (already a QuoteTier string), so the exact amount never reaches the mapper.
 */
export function mapPageToSummary(
  page: NotionPageFixture,
  audience: AudienceScope
): CaseReferenceSummary {
  const { visible, omitted } = filterProperties(page.properties, audience)

  const summary: CaseReferenceSummary = {
    refId: page.id,
    dates: asString(visible.dates),
    nights: asNumber(visible.nights),
    adults: asNumber(visible.adults),
    children: asNumber(visible.children),
    childAges: asNumberArray(visible.childAges),
    cityArea: asString(visible.cityArea),
    tripType: asString(visible.tripType),
    highlights: asStringArray(visible.highlights),
    quoteTier: (visible.quoteTotal as QuoteTier | undefined) ?? undefined,
    carGuideSetup: asString(visible.carGuideSetup),
    specialNeeds: asString(visible.specialNeeds),
    internalNotes: asString(visible.internalNotes),
    internalTags: asStringArray(visible.internalTags),
    lastStatus: asString(visible.status),
    omittedFields: omitted,
  }

  return summary
}
