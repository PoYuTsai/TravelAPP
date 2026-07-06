/**
 * model-routing.ts — pure intent→model selection (design 2026-06-03 §4).
 *
 * No I/O, no env, fully unit-testable.  The adapter calls this per-request so
 * the model is chosen dynamically from intent, not bound once in the
 * constructor.
 *
 *   respond / analyze / unknown → defaultModel
 *   draft / parse              → researchModel
 *   anything else              → defaultModel (safe fallback)
 */

import type { CommandIntent } from '../commands/intent'

const RESEARCH_ACTIONS = new Set(['draft', 'parse'])

export function routePartnerModel(
  intent: CommandIntent,
  models: { defaultModel: string; researchModel: string }
): string {
  return RESEARCH_ACTIONS.has(intent.action)
    ? models.researchModel
    : models.defaultModel
}
