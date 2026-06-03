/**
 * anthropic-responder.ts — real Anthropic Messages API adapter for the
 * partner-group responder (design 2026-06-03 §5).
 *
 * HARD BOUNDARIES (inherited from responder.ts, must never be violated):
 *  - Produces TEXT only. Never imports a LINE client, never sends, never writes
 *    a quote. Whether the text reaches the group is owned by router + permission.
 *  - Never reads env. The constructor receives primitives; the factory owns env.
 *
 * The respond() body is implemented test-first in step 4; this shell exists so
 * the factory's `instanceof` dispatch (§3 table) compiles and is unit-testable.
 */

import {
  STUB_PARTNER_GROUP_REPLY,
  type PartnerGroupResponder,
  type PartnerGroupRespondInput,
  type PartnerGroupRespondResult,
} from './responder'
import { routePartnerModel } from './model-routing'
import { buildPartnerGroupSystemPrompt } from './system-prompt'

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MAX_TOKENS = 1024

/** Safe-default fallback: stub text, observably tagged with the error code. */
function degraded(model: string, error: string): PartnerGroupRespondResult {
  return {
    text: STUB_PARTNER_GROUP_REPLY,
    meta: { responder: 'stub', model, degraded: true, error },
  }
}

export interface AnthropicPartnerGroupResponderDeps {
  /** Injected fetch-shaped transport — tests pass a fake; prod passes fetch. */
  transport: typeof fetch
  /** Anthropic API key (non-empty — the factory degrades to stub when empty). */
  apiKey: string
  /** Model for respond/analyze/unknown intents. */
  defaultModel: string
  /** Model for draft/parse intents. */
  researchModel: string
}

export class AnthropicPartnerGroupResponder implements PartnerGroupResponder {
  private readonly transport: typeof fetch
  private readonly apiKey: string
  private readonly defaultModel: string
  private readonly researchModel: string

  constructor(deps: AnthropicPartnerGroupResponderDeps) {
    this.transport = deps.transport
    this.apiKey = deps.apiKey
    this.defaultModel = deps.defaultModel
    this.researchModel = deps.researchModel
  }

  async respond(input: PartnerGroupRespondInput): Promise<PartnerGroupRespondResult> {
    // Model is chosen per-request from intent (design §4) — not bound in ctor.
    const model = routePartnerModel(input.intent, {
      defaultModel: this.defaultModel,
      researchModel: this.researchModel,
    })
    const system = buildPartnerGroupSystemPrompt(input)

    let response: Response
    try {
      response = await this.transport(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: input.text }],
        }),
      })
    } catch (err) {
      // Transport threw (network/DNS/abort). Safe-default — NEVER 500 the webhook.
      console.error('[partner-responder] Anthropic transport error:', err)
      return degraded(model, 'anthropic_api_error')
    }

    if (!response.ok) {
      console.warn(`[partner-responder] Anthropic returned non-200 status: ${response.status}`)
      return degraded(model, 'anthropic_non_200')
    }

    let text: unknown
    try {
      const data = (await response.json()) as { content?: Array<{ text?: unknown }> }
      text = data?.content?.[0]?.text
    } catch (err) {
      console.warn('[partner-responder] Anthropic response JSON parse failed:', err)
      return degraded(model, 'anthropic_parse_error')
    }

    if (typeof text !== 'string' || text.trim() === '') {
      console.warn('[partner-responder] Anthropic response had no usable content[0].text')
      return degraded(model, 'anthropic_parse_error')
    }

    return { text, meta: { responder: 'llm', model } }
  }
}
