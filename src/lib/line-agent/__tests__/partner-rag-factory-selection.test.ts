/**
 * partner-rag-factory-selection.test.ts — M3.2 runtime wiring (factory selection)
 * (design 2026-06-06-line-oa-m3-2-partner-rag-surfacing-design.md §7).
 *
 * Builds a DISPATCHING partner-group responder: per message it routes to the
 * rag responder ONLY when shouldUsePartnerRagDraft holds, else to the base
 * (stub/anthropic) responder. No real Notion (answerSource is an injected fake),
 * no LLM, no LINE wiring, no router/webhook change. Both gates default off.
 */

import { describe, it, expect, vi } from 'vitest'
import { createPartnerGroupResponderWithRagDraft } from '@/lib/line-agent/partner-group/responder-factory'
import { stubPartnerGroupResponder } from '@/lib/line-agent/partner-group/responder'
import { PARTNER_RAG_UNAVAILABLE_REPLY } from '@/lib/line-agent/partner-group/rag-draft-surfacing'
import type { PartnerGroupRespondInput } from '@/lib/line-agent/partner-group/responder'
import type { AgentSourceChannel } from '@/lib/line-agent/types'

const BOTH_GATES_ON = {
  AI_AGENT_NOTION_RAG_ENABLED: 'true',
  AI_AGENT_PARTNER_RAG_DRAFT_ENABLED: 'true',
}
const INTENT_TEXT = '幫我草稿 一下這團的內部參考'
const NO_INTENT_TEXT = '明天清邁天氣如何'

function makeInput(opts: {
  sourceChannel?: AgentSourceChannel
  mentionsBot?: boolean
  botDirected?: boolean
  text?: string
}): PartnerGroupRespondInput {
  const text = opts.text ?? INTENT_TEXT
  return {
    event: {
      kind: opts.sourceChannel === 'line_oa' ? 'oa_text' : 'group_text',
      sourceChannel: opts.sourceChannel ?? 'line_partner_group',
      lineUserId: 'U_tsai',
      groupId: opts.sourceChannel === 'line_oa' ? undefined : 'G_partner',
      messageId: 'M001',
      text,
      mentionsBot: opts.mentionsBot ?? true,
      timestamp: 1_700_000_000_000,
    },
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text,
    ...(opts.botDirected !== undefined ? { botDirected: opts.botDirected } : {}),
  }
}

/** A fake answerSource recording its call count; returns an operator-safe body. */
function fakeSource() {
  return vi.fn(async () => ({
    text: '【夥伴群草稿】內部過往案例傾向：區域 古城、約 6 人',
  }))
}

describe('createPartnerGroupResponderWithRagDraft — per-message dispatch', () => {
  it('Test 1/6: gates off → base responder runs, answerSource not called', async () => {
    const answerSource = fakeSource()
    const responder = createPartnerGroupResponderWithRagDraft({
      base: stubPartnerGroupResponder,
      answerSource,
      env: { AI_AGENT_NOTION_RAG_ENABLED: 'true' }, // partner gate off
    })

    const result = await responder.respond(makeInput({ text: INTENT_TEXT }))

    expect(result.meta?.responder).toBe('stub')
    expect(answerSource).toHaveBeenCalledTimes(0)
  })

  it('Test 2: partner group + intent + both gates on → rag responder', async () => {
    const answerSource = fakeSource()
    const responder = createPartnerGroupResponderWithRagDraft({
      base: stubPartnerGroupResponder,
      answerSource,
      env: BOTH_GATES_ON,
    })

    const result = await responder.respond(makeInput({ text: INTENT_TEXT }))

    expect(result.meta?.responder).toBe('rag')
    expect(result.text).toContain('夥伴內部草稿')
    expect(answerSource).toHaveBeenCalledTimes(1)
  })

  it('Test 3: partner group tag but no explicit intent → base responder', async () => {
    const answerSource = fakeSource()
    const responder = createPartnerGroupResponderWithRagDraft({
      base: stubPartnerGroupResponder,
      answerSource,
      env: BOTH_GATES_ON,
    })

    const result = await responder.respond(makeInput({ text: NO_INTENT_TEXT }))

    expect(result.meta?.responder).toBe('stub')
    expect(answerSource).toHaveBeenCalledTimes(0)
  })

  it('Test 4: OA source even with RAG keyword → never rag, answerSource not called', async () => {
    const answerSource = fakeSource()
    const responder = createPartnerGroupResponderWithRagDraft({
      base: stubPartnerGroupResponder,
      answerSource,
      env: BOTH_GATES_ON,
    })

    const result = await responder.respond(
      makeInput({ sourceChannel: 'line_oa', mentionsBot: false, text: '幫我草稿 RAG' }),
    )

    expect(result.meta?.responder).toBe('stub')
    expect(answerSource).toHaveBeenCalledTimes(0)
  })

  it('Test 5: quote-to-bot (botDirected, mentionsBot:false) + intent + gates → rag', async () => {
    const answerSource = fakeSource()
    const responder = createPartnerGroupResponderWithRagDraft({
      base: stubPartnerGroupResponder,
      answerSource,
      env: BOTH_GATES_ON,
    })

    const result = await responder.respond(
      makeInput({ mentionsBot: false, botDirected: true, text: '參考過往案例抓個方向' }),
    )

    expect(result.meta?.responder).toBe('rag')
    expect(answerSource).toHaveBeenCalledTimes(1)
  })

  it('Test 7: answerSource throws → fail closed degraded, no hallucinated draft', async () => {
    const answerSource = vi.fn(async () => {
      throw new Error('notion timeout')
    })
    const responder = createPartnerGroupResponderWithRagDraft({
      base: stubPartnerGroupResponder,
      answerSource,
      env: BOTH_GATES_ON,
    })

    const result = await responder.respond(makeInput({ text: INTENT_TEXT }))

    expect(result.text).toBe(PARTNER_RAG_UNAVAILABLE_REPLY)
    expect(result.text).not.toContain('內部過往案例傾向')
    expect(result.meta?.degraded).toBe(true)
    expect(answerSource).toHaveBeenCalledTimes(1)
  })

  it('untagged partner (not botDirected) + keyword → base responder, no rag', async () => {
    const answerSource = fakeSource()
    const responder = createPartnerGroupResponderWithRagDraft({
      base: stubPartnerGroupResponder,
      answerSource,
      env: BOTH_GATES_ON,
    })

    const result = await responder.respond(
      makeInput({ mentionsBot: false, botDirected: false, text: 'RAG 幫我草稿' }),
    )

    expect(result.meta?.responder).toBe('stub')
    expect(answerSource).toHaveBeenCalledTimes(0)
  })
})
