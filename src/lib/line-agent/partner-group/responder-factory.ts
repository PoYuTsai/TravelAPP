/**
 * responder-factory.ts — builds the partner-group responder from an already
 * parsed models object + an injected transport (design 2026-06-03 §3 / §3.2).
 *
 * The factory NEVER reads process.env — env parsing is owned by the narrow
 * selector (responder-config.ts).  Dispatch + degrade table:
 *
 *   mode unset / 'stub'                         → stubPartnerGroupResponder (identity)
 *   mode 'anthropic' + key + both model names   → AnthropicPartnerGroupResponder
 *   mode 'anthropic' + empty key                → degraded stub, error=missing_anthropic_api_key
 *   mode 'anthropic' + key but missing a model  → degraded stub, error=missing_partner_responder_model
 * (all degrade paths are loud + observable and NEVER throw)
 *
 * Degrading (not throwing) is deliberate: the partner-group reply is an
 * enhancement, not case persistence; a failure must not 500 the LINE webhook
 * and trigger a redelivery storm (design §6).
 */

import {
  stubPartnerGroupResponder,
  STUB_PARTNER_GROUP_REPLY,
  type PartnerGroupResponder,
} from './responder'
import { AnthropicPartnerGroupResponder } from './anthropic-responder'
import type { PartnerResponderConfig } from './responder-config'

export interface CreatePartnerGroupResponderInput {
  /** Already-parsed model config (from getPartnerResponderConfig). */
  models: PartnerResponderConfig
  /** Injected fetch-shaped transport for the real adapter. */
  transport: typeof fetch
}

/**
 * A safe-default responder for the "mode=anthropic but key missing" case.
 * Returns the frozen stub text but tags meta with `degraded` + an error code so
 * the misconfiguration is traceable (NOT a silent failure).
 */
function createDegradedStubResponder(error: string): PartnerGroupResponder {
  return {
    async respond() {
      return {
        text: STUB_PARTNER_GROUP_REPLY,
        meta: { responder: 'stub', degraded: true, error },
      }
    },
  }
}

export function createPartnerGroupResponder(
  input: CreatePartnerGroupResponderInput
): PartnerGroupResponder {
  const { models, transport } = input

  if (models.partnerResponderMode !== 'anthropic') {
    return stubPartnerGroupResponder
  }

  if (!models.anthropicApiKey) {
    // Loud + observable (design §6.1) — non-minified so it can be traced.
    console.warn(
      '[partner-responder] AI_AGENT_PARTNER_RESPONDER_MODE=anthropic but ' +
        'ANTHROPIC_API_KEY is missing — degrading to safe stub.'
    )
    return createDegradedStubResponder('missing_anthropic_api_key')
  }

  // The adapter must never receive an empty model: an empty model string would
  // be POSTed to the Anthropic API, wasting billing on a guaranteed error
  // (design §3.2 — missing model name is a degrade trigger).
  if (!models.defaultModel || !models.researchModel) {
    console.warn(
      '[partner-responder] AI_AGENT_PARTNER_RESPONDER_MODE=anthropic but ' +
        'AI_AGENT_DEFAULT_MODEL / AI_AGENT_RESEARCH_MODEL is missing — degrading to safe stub.'
    )
    return createDegradedStubResponder('missing_partner_responder_model')
  }

  return new AnthropicPartnerGroupResponder({
    transport,
    apiKey: models.anthropicApiKey,
    defaultModel: models.defaultModel,
    researchModel: models.researchModel,
  })
}
