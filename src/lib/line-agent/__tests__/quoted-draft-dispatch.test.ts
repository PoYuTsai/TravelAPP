/**
 * quoted-draft-dispatch.test.ts — M3.6c
 *
 * The dispatching responder must route a partner-group quote-to-bot message
 * that asks to "整理給客人" to the deterministic customer-summary path BEFORE the
 * rag path / base — and it must not regress the existing rag dispatch for a
 * tagged rag-intent message that does NOT quote a bot draft.
 */

import { describe, it, expect, vi } from 'vitest'
import { createPartnerGroupResponderWithRagDraft } from '@/lib/line-agent/partner-group/responder-factory'
import {
  QUOTED_DRAFT_CUSTOMER_REPLY,
  QUOTED_DRAFT_CONTENT_MISSING_REPLY,
} from '@/lib/line-agent/partner-group/quoted-draft-customer-reply'
import type {
  PartnerGroupResponder,
  PartnerGroupRespondInput,
} from '@/lib/line-agent/partner-group/responder'
import type { NormalizedLineEvent } from '@/lib/line-agent/line/event-normalizer'

const BOTH_GATES_ON = {
  AI_AGENT_NOTION_RAG_ENABLED: 'true',
  AI_AGENT_PARTNER_RAG_DRAFT_ENABLED: 'true',
}

const SUMMARIZE_TEXT = '請根據我引用的這則內部案例草稿，幫我整理一段可以回客人的簡短說法'
const RAG_TEXT = '幫我查內部案例：清邁親子 大象 夜間動物園'

const BASE_SENTINEL = '[[base responder ran]]'
const recordingBase: PartnerGroupResponder = {
  async respond() {
    return { text: BASE_SENTINEL, meta: { responder: 'stub' } }
  },
}

function quoteToBotInput(
  text: string,
  quotedBotContent?: string,
): PartnerGroupRespondInput {
  const event: NormalizedLineEvent = {
    kind: 'group_quoted',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M_quote',
    text,
    mentionsBot: false, // not re-tagged; addressed via the quote
    timestamp: 1_700_000_000_000,
    quotedRef: { quotedMessageId: 'M_botPrev' },
  }
  return {
    event,
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text,
    botDirected: true,
    ...(quotedBotContent !== undefined ? { quotedBotContent } : {}),
  }
}

function taggedInput(text: string): PartnerGroupRespondInput {
  const event: NormalizedLineEvent = {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M_tag',
    text,
    mentionsBot: true,
    timestamp: 1_700_000_000_000,
  }
  return {
    event,
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text,
    botDirected: true,
  }
}

describe('dispatching responder — M3.6c quoted-draft customer-summary path', () => {
  it('routes a quote-to-bot summarise request WITH cached content to the customer template', async () => {
    const answerSource = vi.fn()
    const responder = createPartnerGroupResponderWithRagDraft({
      base: recordingBase,
      answerSource,
      env: BOTH_GATES_ON, // even with rag gates ON, the customer path wins
    })

    const result = await responder.respond(
      quoteToBotInput(SUMMARIZE_TEXT, '【夥伴內部草稿】清邁親子 5 天行程草稿'),
    )

    expect(result.text).toBe(QUOTED_DRAFT_CUSTOMER_REPLY)
    expect(answerSource).not.toHaveBeenCalled() // no Notion read
  })

  it('fails closed to the paste-the-draft reply when the cached content is missing', async () => {
    const responder = createPartnerGroupResponderWithRagDraft({
      base: recordingBase,
      answerSource: vi.fn(),
      env: BOTH_GATES_ON,
    })

    const result = await responder.respond(quoteToBotInput(SUMMARIZE_TEXT, undefined))

    expect(result.text).toBe(QUOTED_DRAFT_CONTENT_MISSING_REPLY)
  })

  it('does NOT hijack a tagged rag-intent message that has no quote (rag path unchanged)', async () => {
    const answerSource = vi.fn(async () => ({ text: 'rag draft body' }))
    const responder = createPartnerGroupResponderWithRagDraft({
      base: recordingBase,
      answerSource,
      env: BOTH_GATES_ON,
    })

    const result = await responder.respond(taggedInput(RAG_TEXT))

    expect(answerSource).toHaveBeenCalledTimes(1) // rag path still runs
    expect(result.text).toContain('rag draft body')
    expect(result.meta?.responder).toBe('rag')
  })

  it('falls through to base for a quote-to-bot message without summarise intent', async () => {
    const responder = createPartnerGroupResponderWithRagDraft({
      base: recordingBase,
      answerSource: vi.fn(),
      env: {}, // gates off
    })

    const result = await responder.respond(
      quoteToBotInput('這團我先看一下', '【夥伴內部草稿】內容'),
    )

    expect(result.text).toBe(BASE_SENTINEL)
  })
})
