/**
 * cached-rag-source.ts — M3.2 option B: a TTL + single-flight cache around the
 * expensive RAG index build (design 2026-06-06 §6 cost guard).
 *
 * The partner-group rag draft must NOT read the full Notion corpus on every tag.
 * This wrapper caches the EXPENSIVE part — `loadIndex` (read corpus → build a
 * searchable index) — for a TTL window, and runs the cheap per-request
 * `answer(index, input)` (search + compose) against the cached index each time.
 *
 * Two guards, both cost-motivated:
 *  - TTL: within `ttlMs` of the last build, the index is reused (no Notion read).
 *  - Single-flight: concurrent calls that arrive while a build is in progress JOIN
 *    that one build instead of each starting their own. A burst of tagged
 *    messages therefore triggers AT MOST one corpus read, not N.
 *
 * Fail-closed: a `loadIndex` error propagates to the caller (the rag responder
 * turns it into the unavailable reply) and is NEVER cached — the next call
 * retries rather than serving a stale failure for the whole TTL.
 *
 * This module is generic + pure: it imports no Notion/LLM client. The real
 * loader/answer (Notion retrieval + composeAnswer) are injected by a later slice
 * BEHIND the still-off env gate; nothing here enables production behavior.
 *
 * TTL + single-flight 核心已抽到 cached-loader.ts（檢索閉環刀）；本檔委派之。
 */

import { createCachedLoader } from './cached-loader'
import type { PartnerGroupRespondInput } from './responder'
import type { PartnerRagDraftSource } from './rag-draft-surfacing'

export interface CachedRagAnswerSourceDeps<TIndex> {
  /** Expensive: read the corpus and build a searchable index. Cached per TTL. */
  loadIndex: () => Promise<TIndex>
  /** Cheap per-request: search the cached index + compose the operator-safe body. */
  answer: (
    index: TIndex,
    input: PartnerGroupRespondInput,
  ) => Promise<{ text: string }>
  /** Cache lifetime in ms. A build older than this (>=) is stale and rebuilt. */
  ttlMs: number
  /** Injected clock (ms). Defaults to the wall clock; tests pin it. */
  now?: () => number
}

/**
 * Build a `PartnerRagDraftSource` that caches the index build behind a TTL +
 * single-flight gate. The returned source is transparent: it returns the
 * injected `answer` body verbatim (it adds no field, so it cannot reintroduce
 * leakage that the upstream projection removed).
 */
export function createCachedRagAnswerSource<TIndex>(
  deps: CachedRagAnswerSourceDeps<TIndex>,
): PartnerRagDraftSource {
  // TTL + single-flight 核心抽到 cached-loader.ts（檢索閉環刀）— 行為不變：
  // fail-closed（loadIndex error 上拋且不快取）由泛型核心同樣保證。
  const getIndex = createCachedLoader({
    load: deps.loadIndex,
    ttlMs: deps.ttlMs,
    now: deps.now,
  })

  return async (input) => {
    const index = await getIndex()
    return deps.answer(index, input)
  }
}
