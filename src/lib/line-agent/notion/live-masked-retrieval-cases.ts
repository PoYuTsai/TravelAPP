/**
 * live-masked-retrieval-cases.ts
 *
 * M3.4a — bridge Notion LIVE operator-safe masked summaries into the change
 * composer's RetrievalCaseRef shape, as "theme signal only".
 *
 * Why theme-only: the operator-safe summary (OperatorSafeCaseSummary) carries NO
 * attraction name by design — the raw 行程框架 free text is dropped (GAP-1) because
 * it leaks customer names / flights / phone / URL / amounts. So a live case has no
 * trustworthy concrete name to inject. We therefore project ONLY the theme signal
 * and hard-mark every output `provenance:'live_masked'` so the composer's
 * substitution guard can never write a live case into the draft.
 *
 * Guardrails (pinned by live-masked-retrieval-cases.test.ts):
 *   - every output is FORCED provenance:'live_masked' (caller cannot downgrade).
 *   - `name` comes ONLY from the code-only GENERIC_THEME_LABELS table — never a
 *     string lifted from a summary field. Any stray concrete string is ignored.
 *   - only themes in the conservative MOBILITY_FRIENDLY_THEMES whitelist yield a
 *     ref; an unsuitable-only summary yields nothing (→ downstream `none`).
 *
 * PURE: no env / fetch / Notion / LLM. Consumed by the operator dry-run CLI.
 */

import type { OperatorSafeCaseSummary } from './notion-rag-search'
import type { RetrievalCaseRef } from './customer-itinerary-change-composer'

/**
 * Conservative, code-only set of canonical theme tokens that are generally safe
 * for limited-mobility / elderly travellers (low exertion, flat, short walks).
 * Deliberately EXCLUDES zipline / adventure / elephant / zoo / night_safari —
 * walking- or thrill-heavy themes we will never suggest to a tired elder.
 */
export const MOBILITY_FRIENDLY_THEMES = [
  'cafe',
  'massage',
  'photo',
  'shopping',
  'market',
  'temple',
  'family',
] as const

/**
 * Code-only generic labels — the ONLY source of a live case's `name`. Each is an
 * exertion-light, NON-specific phrase: never a real attraction, digit, or PII.
 */
export const GENERIC_THEME_LABELS: Record<(typeof MOBILITY_FRIENDLY_THEMES)[number], string> = {
  cafe: '較輕鬆的咖啡主題景點',
  massage: '較輕鬆的按摩放鬆行程',
  photo: '較輕鬆的拍照打卡景點',
  shopping: '較輕鬆的購物採買行程',
  market: '較輕鬆的市集散步行程',
  temple: '較輕鬆的寺廟參訪景點',
  family: '較輕鬆的親子主題景點',
}

const FRIENDLY = new Set<string>(MOBILITY_FRIENDLY_THEMES)

function firstFriendlyTheme(themeHints: string[]): (typeof MOBILITY_FRIENDLY_THEMES)[number] | undefined {
  for (const t of themeHints) {
    if (FRIENDLY.has(t)) return t as (typeof MOBILITY_FRIENDLY_THEMES)[number]
  }
  return undefined
}

/**
 * Project masked live summaries into theme-signal RetrievalCaseRefs. Reads ONLY
 * `themeHints`; every other field (including any stray concrete string) is
 * ignored. Each emitted ref is forced live_masked with a generic-label name, and
 * refs are de-duplicated by themeTag (first friendly theme wins, stable order).
 */
export function toLiveMaskedRetrievalCases(
  summaries: OperatorSafeCaseSummary[]
): RetrievalCaseRef[] {
  const out: RetrievalCaseRef[] = []
  const seen = new Set<string>()

  for (const summary of summaries) {
    const theme = firstFriendlyTheme(summary.themeHints ?? [])
    if (!theme || seen.has(theme)) continue
    seen.add(theme)
    out.push({
      name: GENERIC_THEME_LABELS[theme],
      themeTag: theme,
      mobilityFriendly: true,
      provenance: 'live_masked',
    })
  }

  return out
}
