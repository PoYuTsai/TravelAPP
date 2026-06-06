/**
 * cached-rag-source.test.ts — M3.2 option B: cached in-memory index source
 * (design 2026-06-06-line-oa-m3-2-partner-rag-surfacing-design.md §6 cost guard).
 *
 * The cached source wraps an EXPENSIVE `loadIndex` (read corpus → build index)
 * behind a TTL + single-flight cache, then runs a cheap per-request
 * `answer(index, input)` (search + compose) against the cached index. This is the
 * cost guard that lets the rag draft be attached to runtime without every tag
 * fanning out into a full-corpus Notion read.
 *
 * NO real Notion / LLM here — `loadIndex` and `answer` are injected fakes and the
 * clock is injected for deterministic TTL math. This slice does NOT wire the
 * cached source into the webhook default (the production source stays not-wired +
 * fail-closed) and does NOT flip any env gate.
 */

import { describe, it, expect, vi } from 'vitest'
import { createCachedRagAnswerSource } from '@/lib/line-agent/partner-group/cached-rag-source'
import { createRagPartnerGroupResponder } from '@/lib/line-agent/partner-group/rag-draft-surfacing'
import { PARTNER_RAG_UNAVAILABLE_REPLY } from '@/lib/line-agent/partner-group/rag-draft-surfacing'
import type { PartnerGroupRespondInput } from '@/lib/line-agent/partner-group/responder'

const TTL = 10 * 60 * 1000 // 10 minutes

function input(): PartnerGroupRespondInput {
  return {
    event: {
      kind: 'group_text',
      sourceChannel: 'line_partner_group',
      lineUserId: 'U_tsai',
      groupId: 'G_partner',
      messageId: 'M001',
      text: '幫我草稿 一下這團的內部參考',
      mentionsBot: true,
      timestamp: 1_700_000_000_000,
    },
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text: '幫我草稿 一下這團的內部參考',
    botDirected: true,
  }
}

/** A fake index + counted loader/answer + a mutable injected clock. */
function harness(opts: { loadThrows?: boolean } = {}) {
  let clock = 1_000_000
  let loadCount = 0
  let answerCount = 0
  const loadIndex = vi.fn(async () => {
    loadCount += 1
    if (opts.loadThrows) throw new Error('notion read failed')
    return { builtAtTick: clock, cases: ['caseA', 'caseB'] }
  })
  const answer = vi.fn(
    async (index: { cases: string[] }, _input: PartnerGroupRespondInput) => ({
      text: `【夥伴群草稿】內部過往案例傾向：區域 古城、約 6 人（${index.cases.length} 筆參考）`,
    }),
  )
  const source = createCachedRagAnswerSource({
    loadIndex,
    answer,
    ttlMs: TTL,
    now: () => clock,
  })
  return {
    source,
    loadIndex,
    answer,
    advance: (ms: number) => {
      clock += ms
    },
    counts: () => ({ loadCount, answerCount }),
  }
}

describe('createCachedRagAnswerSource — TTL + single-flight index cache', () => {
  it('point 1: first call builds the index and runs answer once', async () => {
    const h = harness()
    await h.source(input())
    expect(h.loadIndex).toHaveBeenCalledTimes(1)
    expect(h.answer).toHaveBeenCalledTimes(1)
  })

  it('point 2: a second call within TTL reuses the cached index (no rebuild)', async () => {
    const h = harness()
    await h.source(input())
    h.advance(TTL - 1)
    await h.source(input())
    expect(h.loadIndex).toHaveBeenCalledTimes(1) // built once, reused
    expect(h.answer).toHaveBeenCalledTimes(2) // search/compose still runs per request
  })

  it('point 3: a call after TTL expiry rebuilds the index', async () => {
    const h = harness()
    await h.source(input())
    h.advance(TTL) // exactly at TTL boundary ⇒ stale
    await h.source(input())
    expect(h.loadIndex).toHaveBeenCalledTimes(2)
  })

  it('point 5 (cost guard): concurrent calls fan into a SINGLE index build', async () => {
    const h = harness()
    // Both calls start before the first build settles → single-flight joins them.
    await Promise.all([h.source(input()), h.source(input()), h.source(input())])
    expect(h.loadIndex).toHaveBeenCalledTimes(1)
    expect(h.answer).toHaveBeenCalledTimes(3)
  })

  it('point 4: loadIndex error propagates (fail-closed) and is NOT cached', async () => {
    const h = harness({ loadThrows: true })
    await expect(h.source(input())).rejects.toThrow('notion read failed')
    // A failed build must not be cached for the whole TTL — the next call retries.
    await expect(h.source(input())).rejects.toThrow('notion read failed')
    expect(h.loadIndex).toHaveBeenCalledTimes(2)
  })

  it('transparency: the wrapper returns the answer body verbatim (adds/leaks nothing)', async () => {
    const body = '【夥伴群草稿】內部過往案例傾向：區域 古城'
    const source = createCachedRagAnswerSource({
      loadIndex: async () => ({}),
      answer: async () => ({ text: body }),
      ttlMs: TTL,
      now: () => 0,
    })
    const result = await source(input())
    expect(result.text).toBe(body) // no mutation, no extra fields
  })
})

describe('cached source behind the rag responder (output contract)', () => {
  it('point 6: surfaced draft carries the safety banner + the 草稿 marker', async () => {
    const h = harness()
    const responder = createRagPartnerGroupResponder({ source: h.source })

    const result = await responder.respond(input())

    expect(result.meta?.responder).toBe('rag')
    expect(result.text).toContain('夥伴內部草稿') // banner
    expect(result.text).toContain('不是正式報價') // banner
    expect(result.text).toContain('夥伴群草稿') // M3.1 body marker
  })

  it('point 4 end-to-end: cached loader error → fail-closed unavailable reply, no fabricated draft', async () => {
    const h = harness({ loadThrows: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const responder = createRagPartnerGroupResponder({ source: h.source })

    const result = await responder.respond(input())

    expect(result.text).toBe(PARTNER_RAG_UNAVAILABLE_REPLY)
    expect(result.text).not.toContain('內部過往案例傾向')
    expect(result.meta?.degraded).toBe(true)
  })

  it('point 7: surfaced text leaks no PII / price / token / Notion URL / db id', async () => {
    // The fake answer returns an operator-safe body; assert the cache+responder
    // path introduces none of the forbidden shapes (the projection upstream is
    // what guarantees the body itself is safe — M3.2 adds no field).
    const h = harness()
    const responder = createRagPartnerGroupResponder({ source: h.source })

    const result = await responder.respond(input())

    expect(result.text).not.toMatch(/notion\.so/i)
    expect(result.text).not.toMatch(/secret_[A-Za-z0-9]/) // Notion token shape
    expect(result.text).not.toMatch(/[0-9a-f]{32}/i) // Notion page/db id shape
    expect(result.text).not.toMatch(/\bNT\$?\s?\d/) // price shape
  })

  // points 5 (gate off ⇒ answerSource 0) and 8 (OA / untagged unchanged) are
  // locked by the webhook wiring suite (partner-rag-webhook-wiring.test.ts) and
  // the factory selection suite — referenced here (DRY), not duplicated. The
  // cached source is reached ONLY through that already-gated dispatcher, so it
  // cannot change those invariants.
})
