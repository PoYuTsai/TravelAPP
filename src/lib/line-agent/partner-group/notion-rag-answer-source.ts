/**
 * notion-rag-answer-source.ts — M3.2 "next knife": the REAL cached Notion RAG
 * answer source (design 2026-06-06-line-oa-m3-2-partner-rag-surfacing-design.md
 * §6 cost guard + "Next knife (still gated off)").
 *
 * It assembles the existing pieces into a `PartnerRagDraftSource`, behind the §6
 * TTL + single-flight cache, WITHOUT enabling anything:
 *
 *   loadIndex = loadNotionRagIndex({env, client})
 *               resolveNotionRagConfig → buildNotionRagIndex(injected client) → RagIndex
 *               (fail-closed: a disabled/error build THROWS, so the cache never
 *                stores a failure and the rag responder gives the unavailable reply)
 *
 *   answer    = composeRagAnswerFromIndex(index, input)
 *               searchRagIndex (operator-safe projection) → composeAnswer → body text
 *
 *   source    = createCachedRagAnswerSource({ loadIndex, answer, ttlMs, now })
 *
 * Boundaries (all inherited / re-stated):
 *  - The injected `client` is the loader port (a fake in tests; the real
 *    `@notionhq/client` adapter is supplied by the bootstrap that calls the
 *    webhook installer). This module imports NO SDK, NO LINE client, NO LLM.
 *  - `searchRagIndex` projects each record to an OPERATOR-SAFE whitelist
 *    (`OperatorSafeCaseSummary`) BEFORE `composeAnswer` runs, so privateContext
 *    (cost / revenue / profit / Notion url / db id / private notes) and PII-bearing
 *    free text (flight / pickup / itinerary snippet) cannot enter the draft.
 *  - This module flips NO env gate. It is reached only through the already-gated
 *    dispatcher, and only after the webhook installer is explicitly called.
 */

import { searchRagIndex } from '../notion/notion-rag-search'
import { composeAnswer } from '../notion/notion-rag-answer-composer'
import type { RagIndex } from '../notion/rag-index'
import { resolveNotionRagConfig } from '../notion/notion-rag-config'
import { buildNotionRagIndex, type NotionRagClient } from '../notion/notion-rag-loader'
import { createCachedRagAnswerSource } from './cached-rag-source'
import type { PartnerGroupRespondInput } from './responder'
import type { PartnerRagDraftSource } from './rag-draft-surfacing'

/**
 * Fail-closed signal that the corpus could not be read into a usable index
 * (config disabled, missing db id, or a client error). Carries a fixed,
 * code-only message — never a raw token / db id / Notion url — so the
 * `createRagPartnerGroupResponder` try/catch can convert it into the unavailable
 * reply without leaking. The cache wrapper never stores a throw, so the next call
 * retries rather than serving a stale failure for the whole TTL.
 */
export class NotionRagIndexUnavailableError extends Error {
  readonly code = 'notion_rag_index_unavailable'
  constructor(reason: string) {
    super(`Notion RAG index unavailable: ${reason}`)
    this.name = 'NotionRagIndexUnavailableError'
  }
}

export interface LoadNotionRagIndexDeps {
  /** Loader port (real adapter in prod, fake in tests). */
  client: NotionRagClient
  /** Env for config resolution. Defaults to process.env. */
  env?: Record<string, string | undefined>
}

/**
 * The EXPENSIVE half: resolve config, then build the index via the injected
 * client. Any non-`ok` outcome (disabled gate, missing id, client error) FAILS
 * CLOSED by throwing — an empty silent index would read as "no internal
 * references" instead of "lookup unavailable", masking a misconfiguration.
 */
export async function loadNotionRagIndex(deps: LoadNotionRagIndexDeps): Promise<RagIndex> {
  const { config } = resolveNotionRagConfig(deps.env ?? process.env)
  const result = await buildNotionRagIndex(config, deps.client)
  if (result.status !== 'ok') {
    // `reason` (disabled) / `error.code` (missing_database_id | client_error) are
    // already sanitized code strings — safe to surface, never a token / url.
    const reason = result.status === 'skipped' ? result.reason : result.error.code
    throw new NotionRagIndexUnavailableError(reason)
  }
  return result.index
}

/**
 * The CHEAP half: search the cached index for the message need and compose the
 * deterministic operator-safe draft body. `searchRagIndex` does the whitelist
 * projection, so nothing private/PII can reach `composeAnswer`; this returns only
 * the body text (the surfacing banner is added later by the rag responder).
 */
export function composeRagAnswerFromIndex(
  index: RagIndex,
  input: PartnerGroupRespondInput,
): { text: string } {
  const search = searchRagIndex(index, input.text)
  const composed = composeAnswer({ userQuestion: input.text, search })
  return { text: composed.text }
}

export interface NotionRagAnswerSourceDeps {
  /** Loader port (real adapter in prod, fake in tests). */
  client: NotionRagClient
  /** Cache lifetime in ms (§6 TTL). */
  ttlMs: number
  /** Env for config resolution. Defaults to process.env. */
  env?: Record<string, string | undefined>
  /** Injected clock (ms) — tests pin it; defaults to the wall clock. */
  now?: () => number
}

/**
 * Assemble the real cached `PartnerRagDraftSource`: the expensive index build is
 * cached behind the §6 TTL + single-flight gate, and the cheap search+compose
 * runs per request against the cached index.
 */
export function createNotionRagAnswerSource(
  deps: NotionRagAnswerSourceDeps,
): PartnerRagDraftSource {
  const env = deps.env ?? process.env
  return createCachedRagAnswerSource<RagIndex>({
    loadIndex: () => loadNotionRagIndex({ env, client: deps.client }),
    answer: async (index, respondInput) => composeRagAnswerFromIndex(index, respondInput),
    ttlMs: deps.ttlMs,
    now: deps.now,
  })
}
