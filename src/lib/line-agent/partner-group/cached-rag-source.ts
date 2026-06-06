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
 */

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
  const { loadIndex, answer, ttlMs } = deps
  const now = deps.now ?? (() => Date.now())

  let entry: { index: TIndex; builtAt: number } | null = null
  let inFlight: Promise<TIndex> | null = null

  async function getIndex(): Promise<TIndex> {
    // Fresh cache hit — reuse, no Notion read.
    if (entry !== null && now() - entry.builtAt < ttlMs) {
      return entry.index
    }
    // A build is already running (cold start or post-expiry) — join it so a
    // burst of tagged messages collapses into a SINGLE corpus read.
    if (inFlight !== null) {
      return inFlight
    }
    inFlight = (async () => {
      try {
        const index = await loadIndex()
        // Stamp builtAt AFTER the load so the TTL covers usable-cache time only.
        entry = { index, builtAt: now() }
        return index
      } finally {
        // Always clear the in-flight latch — on success the next caller reads the
        // fresh `entry`; on error `entry` is untouched so the failure is NOT
        // cached and the next call retries.
        inFlight = null
      }
    })()
    return inFlight
  }

  return async (input) => {
    const index = await getIndex()
    return answer(index, input)
  }
}
