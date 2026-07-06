/**
 * refine-smoke-cases.ts
 *
 * M3.4c Cut 2 fixtures — the deterministic, already-lint-clean customer drafts the
 * offline refine smoke asks the (real, when gated on) LLM to polish. PURE /
 * fixture-only: no live LLM, no LINE, no Sanity, no gate. Each case carries the
 * EXACT `constraints` that produced its draft, so the refine harness's guards
 * (lintCustomerItinerary + structuralDiffGuard) judge a refined candidate against
 * the same rules the deterministic draft already satisfied.
 *
 * Provenance of each draft:
 *   - the golden case is the李family 7D6N requirements rendered straight through
 *     the M3.3b composer;
 *   - the change cases are realistic customer-change scenarios pushed through the
 *     real `applyChanges` transform, then rendered through the same composer. We
 *     keep `adjustedInput.constraints` (the resolved post-change constraints) so a
 *     final-day morning-transfer rule, a mobility downgrade, etc. is reflected in
 *     the guard inputs too.
 *
 * Every case is asserted non-null at module load: a draft that fail-closes (a lint
 * error) would be a broken benchmark, so we surface it loudly rather than smoke a
 * null.
 */

import type { CustomerItineraryConstraints } from '../customer-itinerary-lint'
import {
  composeCustomerItineraryDraft,
  type ComposeCustomerItineraryInput,
} from '../customer-itinerary-composer'
import {
  applyChanges,
  type ChangeComposerInput,
} from '../customer-itinerary-change-composer'
import { LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS } from './customer-itinerary-golden'
import {
  scenarioMobilityDowngrade,
  scenarioKeepTianshiWaterfall,
  scenarioFinalDayStillWantsLunch,
} from './customer-change-scenarios'

export interface RefineSmokeCase {
  caseId: string
  /** Already lint-clean deterministic draft (the safe fallback the guards anchor on). */
  deterministicDraft: string
  /** The exact constraints that rendered this draft. */
  constraints: CustomerItineraryConstraints
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function composeOrThrow(input: ComposeCustomerItineraryInput, caseId: string): string {
  const composed = composeCustomerItineraryDraft(input)
  if (!composed.draft) {
    throw new Error(`refine-smoke case "${caseId}" must compose to a non-null deterministic draft`)
  }
  return composed.draft
}

/** The李family golden requirements rendered straight (no change applied). */
function goldenCase(): RefineSmokeCase {
  const caseId = 'li-family-7d6n-golden'
  const input = clone(LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS)
  return { caseId, deterministicDraft: composeOrThrow(input, caseId), constraints: input.constraints }
}

/** A change scenario pushed through the real applyChanges + composer. */
function changeCase(caseId: string, build: () => ChangeComposerInput): RefineSmokeCase {
  const { base, changes, retrievalCases = [] } = build()
  const { adjustedInput } = applyChanges(base, changes, retrievalCases)
  return {
    caseId,
    deterministicDraft: composeOrThrow(adjustedInput, caseId),
    constraints: adjustedInput.constraints,
  }
}

export const REFINE_SMOKE_CASES: RefineSmokeCase[] = [
  goldenCase(),
  changeCase('change-mobility-downgrade', scenarioMobilityDowngrade),
  changeCase('change-keep-tianshi-waterfall', scenarioKeepTianshiWaterfall),
  changeCase('change-final-day-morning-transfer', scenarioFinalDayStillWantsLunch),
]
