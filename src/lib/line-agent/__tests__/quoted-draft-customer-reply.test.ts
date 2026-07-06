/**
 * quoted-draft-customer-reply.test.ts — M3.6c
 *
 * The deterministic "summarise a quoted bot draft for a customer" path.
 *
 * Eric's decision (2026-06-10):
 *  - When a partner quotes a bot-authored draft and asks to "整理給客人", and the
 *    quoted bot content is cached, emit a FIXED, conservative, customer-safe
 *    template — it NEVER echoes the internal draft body, never calls an LLM, and
 *    only uses the cached content's PRESENCE as the trigger.
 *  - When the cached content is missing, fail closed to a fixed "請貼上草稿" reply.
 *
 * These are pure-function tests: no store, no LINE, no LLM, no env, no gate.
 */

import { describe, it, expect } from 'vitest'
import {
  QUOTED_DRAFT_CUSTOMER_REPLY,
  QUOTED_DRAFT_CONTENT_MISSING_REPLY,
  composeQuotedDraftCustomerReply,
  detectSummarizeForCustomerIntent,
  sanitizeQuotedBotContext,
  shouldUseQuotedDraftCustomerReply,
  quotedDraftCustomerResponder,
  QUOTED_BOT_CONTEXT_MAX_CHARS,
} from '../partner-group/quoted-draft-customer-reply'
import { scanCustomerForbiddenTerms } from '../notion/customer-facing-forbidden-terms'
import type { PartnerGroupRespondInput } from '../partner-group/responder'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { CommandIntent } from '../commands/intent'

// A realistic internal draft the bot previously sent (carries the surfacing
// banner + internal vocabulary that must NEVER reach the customer-safe output).
const INTERNAL_DRAFT_SAMPLE =
  '【夥伴內部草稿】這不是正式報價。internal case 參考：清邁親子 5 天，大象保育營、夜間動物園、週日市集；成本約 NT$38000，利潤抓兩成。'

const INTENT_PHRASE = '請根據我引用的這則內部案例草稿，幫我整理一段可以回客人的簡短說法'

// ── composeQuotedDraftCustomerReply — content present ─────────────────────────

describe('composeQuotedDraftCustomerReply — cached content present', () => {
  it('returns ok + the fixed customer-safe template', () => {
    const result = composeQuotedDraftCustomerReply({
      quotedBotContent: INTERNAL_DRAFT_SAMPLE,
    })
    expect(result.ok).toBe(true)
    expect(result.text).toBe(QUOTED_DRAFT_CUSTOMER_REPLY)
  })

  it('reminds the partner to confirm date, headcount, kids age, flight and lodging/pickup', () => {
    const { text } = composeQuotedDraftCustomerReply({
      quotedBotContent: INTERNAL_DRAFT_SAMPLE,
    })
    expect(text).toContain('日期')
    expect(text).toContain('人數')
    expect(text).toContain('年齡')
    expect(text).toContain('航班')
    expect(text).toMatch(/住宿|上車/)
  })

  it('carries no internal/operator vocabulary (forbidden-term scan is clean)', () => {
    const { text } = composeQuotedDraftCustomerReply({
      quotedBotContent: INTERNAL_DRAFT_SAMPLE,
    })
    expect(scanCustomerForbiddenTerms(text)).toEqual([])
    for (const term of ['RAG', 'Notion', '內部', '資料庫', 'system', 'gate', 'operator']) {
      expect(text.toLowerCase()).not.toContain(term.toLowerCase())
    }
  })

  it('never promises price, a quote, availability or formal feasibility', () => {
    const { text } = composeQuotedDraftCustomerReply({
      quotedBotContent: INTERNAL_DRAFT_SAMPLE,
    })
    for (const promise of ['報價', '價格', '保證', '名額', '一定可以', '確定可行']) {
      expect(text).not.toContain(promise)
    }
  })

  it('does NOT echo the quoted internal draft body', () => {
    const { text } = composeQuotedDraftCustomerReply({
      quotedBotContent: INTERNAL_DRAFT_SAMPLE,
    })
    // Tokens unique to the internal draft must not leak into the customer text.
    for (const leak of ['成本', '利潤', 'NT$38000', '夥伴內部草稿', 'case']) {
      expect(text).not.toContain(leak)
    }
  })
})

// ── composeQuotedDraftCustomerReply — content missing (fail-closed) ───────────

describe('composeQuotedDraftCustomerReply — cached content missing', () => {
  it('returns not-ok + the fixed paste-the-draft fallback when content is undefined', () => {
    const result = composeQuotedDraftCustomerReply({})
    expect(result.ok).toBe(false)
    expect(result.text).toBe(QUOTED_DRAFT_CONTENT_MISSING_REPLY)
  })

  it('treats an empty / whitespace-only content as missing', () => {
    expect(composeQuotedDraftCustomerReply({ quotedBotContent: '' }).ok).toBe(false)
    expect(composeQuotedDraftCustomerReply({ quotedBotContent: '   \n ' }).ok).toBe(false)
  })

  it('the fallback never mentions cache/message id/system internals and makes no promise', () => {
    const { text } = composeQuotedDraftCustomerReply({})
    expect(scanCustomerForbiddenTerms(text)).toEqual([])
    for (const term of ['cache', 'message id', 'messageId', 'gate', 'RAG', 'Notion', '報價']) {
      expect(text.toLowerCase()).not.toContain(term.toLowerCase())
    }
  })
})

// ── detectSummarizeForCustomerIntent ─────────────────────────────────────────

describe('detectSummarizeForCustomerIntent', () => {
  it("matches Eric's summarise-for-customer phrasing", () => {
    expect(detectSummarizeForCustomerIntent(INTENT_PHRASE)).toBe(true)
    expect(detectSummarizeForCustomerIntent('幫我整理一段可以回客人的簡短說法')).toBe(true)
    expect(detectSummarizeForCustomerIntent('幫我把這個整理成給客人的版本')).toBe(true)
  })

  it('does NOT match a bare RAG-lookup probe (no customer-summary intent)', () => {
    expect(
      detectSummarizeForCustomerIntent('幫我查內部案例：清邁親子 大象 夜間動物園'),
    ).toBe(false)
  })

  it('does NOT match casual chat that merely mentions a customer', () => {
    expect(detectSummarizeForCustomerIntent('這個客人人很好')).toBe(false)
    expect(detectSummarizeForCustomerIntent('')).toBe(false)
  })
})

// ── sanitizeQuotedBotContext ─────────────────────────────────────────────────

describe('sanitizeQuotedBotContext', () => {
  it('collapses runs of whitespace and trims', () => {
    expect(sanitizeQuotedBotContext('  hello\n\n  world  ')).toBe('hello world')
  })

  it('caps the context length so an oversized draft cannot blow up the input', () => {
    const huge = 'x'.repeat(QUOTED_BOT_CONTEXT_MAX_CHARS + 500)
    expect(sanitizeQuotedBotContext(huge).length).toBe(QUOTED_BOT_CONTEXT_MAX_CHARS)
  })
})

// ── shouldUseQuotedDraftCustomerReply ────────────────────────────────────────

describe('shouldUseQuotedDraftCustomerReply', () => {
  const base = {
    sourceChannel: 'line_partner_group' as const,
    botDirected: true,
    isQuoteEvent: true,
    text: INTENT_PHRASE,
  }

  it('fires for a partner-group, bot-directed, quote event with summarise intent', () => {
    expect(shouldUseQuotedDraftCustomerReply(base)).toBe(true)
  })

  it('never fires on the OA customer plane', () => {
    expect(
      shouldUseQuotedDraftCustomerReply({ ...base, sourceChannel: 'line_oa' }),
    ).toBe(false)
  })

  it('requires a quote event (a bare @-tag with the same text does not qualify)', () => {
    expect(shouldUseQuotedDraftCustomerReply({ ...base, isQuoteEvent: false })).toBe(false)
  })

  it('requires the bot to be addressed', () => {
    expect(shouldUseQuotedDraftCustomerReply({ ...base, botDirected: false })).toBe(false)
  })

  it('requires explicit summarise-for-customer intent', () => {
    expect(
      shouldUseQuotedDraftCustomerReply({ ...base, text: '幫我查內部案例：大象' }),
    ).toBe(false)
  })
})

// ── quotedDraftCustomerResponder (PartnerGroupResponder seam) ─────────────────

function makeInput(quotedBotContent?: string): PartnerGroupRespondInput {
  const event: NormalizedLineEvent = {
    kind: 'group_quoted',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M_quote',
    text: INTENT_PHRASE,
    mentionsBot: false,
    timestamp: 1_700_000_000_000,
    quotedRef: { quotedMessageId: 'M_botPrev' },
  }
  const intent: CommandIntent = { action: 'analyze', confidence: 'high', source: 'llm' }
  return {
    event,
    intent,
    text: INTENT_PHRASE,
    botDirected: true,
    ...(quotedBotContent !== undefined ? { quotedBotContent } : {}),
  }
}

describe('quotedDraftCustomerResponder', () => {
  it('produces the customer template when quotedBotContent is present', async () => {
    const result = await quotedDraftCustomerResponder.respond(
      makeInput(INTERNAL_DRAFT_SAMPLE),
    )
    expect(result.text).toBe(QUOTED_DRAFT_CUSTOMER_REPLY)
    expect(result.meta?.degraded).toBeFalsy()
  })

  it('fails closed to the paste-the-draft reply when content is absent, marked degraded', async () => {
    const result = await quotedDraftCustomerResponder.respond(makeInput(undefined))
    expect(result.text).toBe(QUOTED_DRAFT_CONTENT_MISSING_REPLY)
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBe('quoted_draft_content_missing')
  })
})
