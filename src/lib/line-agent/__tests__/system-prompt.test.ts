/**
 * system-prompt.test.ts — locks the partner-group persona + guardrail clauses
 * (design 2026-06-03 §7).  These assertions are a tripwire: if anyone silently
 * weakens a guardrail (drops the "no formal quote", "no claiming already
 * replied", "needs Eric's sign-off" clauses) the build breaks.
 */

import { describe, it, expect } from 'vitest'
import { buildPartnerGroupSystemPrompt } from '@/lib/line-agent/partner-group/system-prompt'
import type { PartnerGroupRespondInput } from '@/lib/line-agent/partner-group/responder'

function makeInput(): PartnerGroupRespondInput {
  return {
    event: {
      kind: 'group_text',
      sourceChannel: 'line_partner_group',
      lineUserId: 'U_tsai',
      groupId: 'G_partner',
      messageId: 'M001',
      text: '@bot 看一下這團',
      mentionsBot: true,
      timestamp: 1_700_000_000_000,
    },
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text: '@bot 看一下這團',
  }
}

describe('buildPartnerGroupSystemPrompt', () => {
  const prompt = buildPartnerGroupSystemPrompt(makeInput())

  it('declares the internal partner-group assistant persona', () => {
    expect(prompt).toContain('內部夥伴群')
    expect(prompt).toContain('Eric')
  })

  it('locks the Traditional-Chinese + concise/actionable style clauses', () => {
    expect(prompt).toContain('繁體中文')
    expect(prompt).toContain('簡短')
    expect(prompt).toContain('條列')
  })

  it('forbids claiming the customer was already replied to / contacted', () => {
    expect(prompt).toContain('不得')
    expect(prompt).toContain('已回覆')
    expect(prompt).toContain('已聯繫')
  })

  it('forbids claiming real-time data (flights / tickets / weather / stock) was looked up', () => {
    expect(prompt).toContain('即時資料')
    expect(prompt).toContain('航班')
    expect(prompt).toContain('門票')
    expect(prompt).toContain('天氣')
  })

  it('forbids formal quote numbers / outward commitments and requires Eric sign-off', () => {
    expect(prompt).toContain('正式報價')
    expect(prompt).toContain('需 Eric 拍板')
  })

  it('requires admitting uncertainty rather than fabricating', () => {
    expect(prompt).toContain('不確定就說不確定')
  })
})
