/**
 * customer-refine-scenarios.ts
 *
 * M3.4b fixtures — fake `RefineDraftSource` implementations + the deterministic
 * base draft they polish. PURE / fixture-only: no real LLM, no LINE, no Sanity,
 * no gate. Each fake models ONE kind of refine output so a test can prove the
 * matching guard in the harness gates it.
 *
 * The deterministic base is the李family golden, composed through the real
 * M3.3b composer (so it is guaranteed to have already passed lint). Fakes derive
 * their output by string surgery on `req.deterministicDraft`, keeping each
 * scenario self-contained and reproducible.
 */

import type { RefineDraftSource } from '../customer-itinerary-refine'
import { composeCustomerItineraryDraft } from '../customer-itinerary-composer'
import {
  LI_FAMILY_ELDERLY_CHIANGMAI_CONSTRAINTS,
  LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS,
} from './customer-itinerary-golden'

export const REFINE_CONSTRAINTS = LI_FAMILY_ELDERLY_CHIANGMAI_CONSTRAINTS

/** The deterministic customer_itinerary_v1 draft the refiner is asked to polish. */
export const DETERMINISTIC_DRAFT: string = (() => {
  const composed = composeCustomerItineraryDraft(LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS)
  if (!composed.draft) {
    throw new Error('golden requirements must compose to a non-null deterministic draft')
  }
  return composed.draft
})()

/**
 * GOOD: only the title line is warmed up and a closing greeting is appended.
 * Every day-structure line stays byte-identical → all three guards pass.
 */
export const goodPolishSource: RefineDraftSource = (req) =>
  req.deterministicDraft.replace('<李先生一家套餐訂製> ', '<李先生一家 ✦ 專屬訂製> ') +
  '\n\n有任何想調整的都可以隨時跟我們說，我們會一起把步調調到最舒服 🙂'

/** STRUCTURE BREAK: silently renames an activity → structuralDiffGuard rejects. */
export const structureBreakSource: RefineDraftSource = (req) =>
  req.deterministicDraft.replace('・水果市場', '・夜市')

/**
 * LEAK: appends a greeting that carries internal wording. The line is not an
 * activity line, so structural + lint stay clean → only the leak guard rejects.
 */
export const leakySource: RefineDraftSource = (req) =>
  req.deterministicDraft + '\n\n（內部備註：這家成本較高，分潤另計）'

/** LINT BREAK: duplicates a 午餐 line on Day 3 → lint (and structural) reject. */
export const lintBreakSource: RefineDraftSource = (req) =>
  req.deterministicDraft.replace(
    '午餐：營區或附近餐廳\n',
    '午餐：營區或附近餐廳\n午餐：清邁市區小吃\n'
  )

/** SOURCE ERROR: the refiner throws → harness fail-closes to deterministic. */
export const throwingSource: RefineDraftSource = () => {
  throw new Error('llm backend unavailable')
}

/** EMPTY: the refiner returns an empty string → treated as unusable output. */
export const emptySource: RefineDraftSource = () => ''
