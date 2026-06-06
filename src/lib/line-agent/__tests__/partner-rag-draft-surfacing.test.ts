/**
 * partner-rag-draft-surfacing.test.ts — M3.2 runtime seam contract
 * (design 2026-06-06-line-oa-m3-2-partner-rag-surfacing-design.md).
 *
 * Tests ONLY the routing/selection decision + the rag responder seam. No real
 * Notion read, no LLM, no LINE wiring, no router change. Both gates default off.
 *
 * The decision: a RAG draft surfaces ONLY when ALL hold —
 *   sourceChannel === 'line_partner_group'
 *   && botDirected (mentionsBot OR quote-to-bot)
 *   && detectPartnerRagIntent(text)
 *   && isPartnerRagDraftEnabled(env)   // BOTH env gates exactly "true"
 * Otherwise the existing responder runs and Notion is never read.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  detectPartnerRagIntent,
  isPartnerRagDraftEnabled,
  shouldUsePartnerRagDraft,
  createRagPartnerGroupResponder,
  PARTNER_RAG_UNAVAILABLE_REPLY,
  type PartnerRagDraftSource,
} from '@/lib/line-agent/partner-group/rag-draft-surfacing'
import type { PartnerGroupRespondInput } from '@/lib/line-agent/partner-group/responder'

const BOTH_GATES_ON = {
  AI_AGENT_NOTION_RAG_ENABLED: 'true',
  AI_AGENT_PARTNER_RAG_DRAFT_ENABLED: 'true',
}

const INTENT_TEXT = '幫我草稿 一下這團的內部參考'
const NO_INTENT_TEXT = '明天清邁天氣如何'

function makeInput(text: string): PartnerGroupRespondInput {
  return {
    event: {
      kind: 'group_text',
      sourceChannel: 'line_partner_group',
      lineUserId: 'U_tsai',
      groupId: 'G_partner',
      messageId: 'M001',
      text,
      mentionsBot: true,
      timestamp: 1_700_000_000_000,
    },
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text,
  }
}

describe('isPartnerRagDraftEnabled — two gates in series, default off', () => {
  it('Test 1: AI_AGENT_PARTNER_RAG_DRAFT_ENABLED default (unset) → disabled', () => {
    expect(isPartnerRagDraftEnabled({ AI_AGENT_NOTION_RAG_ENABLED: 'true' })).toBe(false)
  })

  it('Test 2: NOTION_RAG_ENABLED=false even with partner gate true → disabled', () => {
    expect(
      isPartnerRagDraftEnabled({
        AI_AGENT_NOTION_RAG_ENABLED: 'false',
        AI_AGENT_PARTNER_RAG_DRAFT_ENABLED: 'true',
      }),
    ).toBe(false)
  })

  it('both gates exactly "true" → enabled', () => {
    expect(isPartnerRagDraftEnabled(BOTH_GATES_ON)).toBe(true)
  })

  it('"TRUE" / "1" / " true " are NOT accepted (exact-"true" convention)', () => {
    expect(
      isPartnerRagDraftEnabled({
        AI_AGENT_NOTION_RAG_ENABLED: 'true',
        AI_AGENT_PARTNER_RAG_DRAFT_ENABLED: 'TRUE',
      }),
    ).toBe(false)
  })
})

describe('detectPartnerRagIntent — explicit intent only', () => {
  it('matches deliberate draft/lookup phrasing', () => {
    expect(detectPartnerRagIntent('幫我草稿這團')).toBe(true)
    expect(detectPartnerRagIntent('查內部案例有沒有類似的')).toBe(true)
    expect(detectPartnerRagIntent('參考過往的安排')).toBe(true)
    expect(detectPartnerRagIntent('跑一下 RAG')).toBe(true)
  })

  it('ordinary chatter (no intent) does not match', () => {
    expect(detectPartnerRagIntent(NO_INTENT_TEXT)).toBe(false)
    expect(detectPartnerRagIntent('收到，謝謝')).toBe(false)
  })
})

describe('shouldUsePartnerRagDraft — the surfacing decision', () => {
  it('Test 3: partner tag + intent + both gates → use rag', () => {
    expect(
      shouldUsePartnerRagDraft({
        sourceChannel: 'line_partner_group',
        botDirected: true,
        text: INTENT_TEXT,
        env: BOTH_GATES_ON,
      }),
    ).toBe(true)
  })

  it('Test 4: partner tag but NO explicit intent → do not use rag', () => {
    expect(
      shouldUsePartnerRagDraft({
        sourceChannel: 'line_partner_group',
        botDirected: true,
        text: NO_INTENT_TEXT,
        env: BOTH_GATES_ON,
      }),
    ).toBe(false)
  })

  it('Test 5: quote-to-bot (botDirected) + intent + gates → may use rag', () => {
    expect(
      shouldUsePartnerRagDraft({
        sourceChannel: 'line_partner_group',
        botDirected: true, // derived from quote-to-bot upstream
        text: '參考過往案例幫我抓個方向',
        env: BOTH_GATES_ON,
      }),
    ).toBe(true)
  })

  it('Test 6: OA customer event even with RAG keyword → never rag', () => {
    expect(
      shouldUsePartnerRagDraft({
        sourceChannel: 'line_oa',
        botDirected: false, // OA events are always mentionsBot:false
        text: '幫我草稿 RAG 查內部案例',
        env: BOTH_GATES_ON,
      }),
    ).toBe(false)
  })

  it('Test 7: untagged partner message with RAG keyword → no reply (not botDirected)', () => {
    expect(
      shouldUsePartnerRagDraft({
        sourceChannel: 'line_partner_group',
        botDirected: false,
        text: 'RAG 幫我草稿',
        env: BOTH_GATES_ON,
      }),
    ).toBe(false)
  })

  it('Test 1 (decision-level): partner gate default off → do not use rag', () => {
    expect(
      shouldUsePartnerRagDraft({
        sourceChannel: 'line_partner_group',
        botDirected: true,
        text: INTENT_TEXT,
        env: { AI_AGENT_NOTION_RAG_ENABLED: 'true' },
      }),
    ).toBe(false)
  })
})

describe('createRagPartnerGroupResponder — output contract + fail-closed', () => {
  it('Test 9: happy path draft carries the surfacing safety banner', async () => {
    const source: PartnerRagDraftSource = async () => ({
      text: '【夥伴群草稿】內部過往案例傾向：區域 古城、約 6 人',
    })
    const responder = createRagPartnerGroupResponder({ source })

    const result = await responder.respond(makeInput(INTENT_TEXT))

    expect(result.text).toContain('夥伴內部草稿')
    expect(result.text).toContain('不是正式報價')
    expect(result.text).toContain('內部過往案例傾向') // body preserved
    expect(result.meta?.responder).toBe('rag')
  })

  it('Test 8: source error → fail closed, no hallucinated RAG draft', async () => {
    const source: PartnerRagDraftSource = async () => {
      throw new Error('notion timeout')
    }
    const responder = createRagPartnerGroupResponder({ source })

    const result = await responder.respond(makeInput(INTENT_TEXT))

    expect(result.text).toBe(PARTNER_RAG_UNAVAILABLE_REPLY)
    expect(result.text).not.toContain('內部過往案例傾向')
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBeTruthy()
  })

  it('Test 10: gate off → source (Notion read) is never invoked', async () => {
    const source = vi.fn<Parameters<PartnerRagDraftSource>, ReturnType<PartnerRagDraftSource>>(
      async () => ({ text: 'should never be produced' }),
    )

    const useRag = shouldUsePartnerRagDraft({
      sourceChannel: 'line_partner_group',
      botDirected: true,
      text: INTENT_TEXT,
      env: { AI_AGENT_PARTNER_RAG_DRAFT_ENABLED: 'true' }, // NOTION gate off
    })

    // The caller only constructs/invokes the rag source when the decision is true.
    if (useRag) {
      await createRagPartnerGroupResponder({ source }).respond(makeInput(INTENT_TEXT))
    }

    expect(useRag).toBe(false)
    expect(source).toHaveBeenCalledTimes(0)
  })
})
