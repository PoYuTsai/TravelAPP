/**
 * case-intake-dispatch.test.ts — dispatcher 接線（批2）：
 * createPartnerGroupResponderWithRagDraft 在 quoted_draft 之後、rag 之前插
 * case-intake 路徑；gate default off ⇒ 行為與現行完全相同。
 */

import { describe, expect, it } from 'vitest'
import { createPartnerGroupResponderWithRagDraft } from '../partner-group/responder-factory'
import {
  stubPartnerGroupResponder,
  STUB_PARTNER_GROUP_REPLY,
} from '../partner-group/responder'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { CommandIntent } from '../commands/intent'

const INTENT: CommandIntent = { action: 'analyze', confidence: 'high', source: 'deterministic' }

function makeEvent(
  text: string,
  sourceChannel: 'line_partner_group' | 'line_oa' = 'line_partner_group'
): NormalizedLineEvent {
  return {
    kind: sourceChannel === 'line_oa' ? 'oa_text' : 'group_text',
    sourceChannel,
    lineUserId: 'U-partner',
    messageId: 'msg-1',
    timestamp: 1760000000000,
    text,
    mentionsBot: true,
  } as NormalizedLineEvent
}

function makeDispatcher(env: Record<string, string | undefined>) {
  return createPartnerGroupResponderWithRagDraft({
    base: stubPartnerGroupResponder,
    answerSource: async () => ({ text: 'RAG 草稿內容' }),
    env,
  })
}

const INTAKE_ON = { AI_AGENT_CASE_INTAKE_ENABLED: 'true' }
const RAG_ON = {
  AI_AGENT_NOTION_RAG_ENABLED: 'true',
  AI_AGENT_PARTNER_RAG_DRAFT_ENABLED: 'true',
}

describe('case-intake dispatch', () => {
  it('routes an intake-token message to the intake responder when the gate is on', async () => {
    const dispatcher = makeDispatcher(INTAKE_ON)
    const text = '客需：客人說 12 月想去清邁玩'
    const result = await dispatcher.respond({ event: makeEvent(text), intent: INTENT, text })
    expect(result.meta?.responder).toBe('intake')
    expect(result.text).toContain('【客需整理】')
  })

  it('falls back to base when the intake gate is off（default off 不影響現行）', async () => {
    const dispatcher = makeDispatcher({})
    const text = '客需：客人說 12 月想去清邁玩'
    const result = await dispatcher.respond({ event: makeEvent(text), intent: INTENT, text })
    expect(result.text).toBe(STUB_PARTNER_GROUP_REPLY)
    expect(result.meta?.responder).toBe('stub')
  })

  it('does not regress the rag path（rag token 仍走 rag）', async () => {
    const dispatcher = makeDispatcher({ ...INTAKE_ON, ...RAG_ON })
    const text = '查內部案例 清萊兩日'
    const result = await dispatcher.respond({ event: makeEvent(text), intent: INTENT, text })
    expect(result.meta?.responder).toBe('rag')
  })

  it('never fires for OA events even with the gate on', async () => {
    const dispatcher = makeDispatcher(INTAKE_ON)
    const text = '客需：12月 2大2小'
    const result = await dispatcher.respond({
      event: makeEvent(text, 'line_oa'),
      intent: INTENT,
      text,
    })
    expect(result.meta?.responder).toBe('stub')
  })

  it('never fires without botDirected', async () => {
    const dispatcher = makeDispatcher(INTAKE_ON)
    const text = '客需：12月 2大2小'
    const result = await dispatcher.respond({
      event: { ...makeEvent(text), mentionsBot: false },
      intent: INTENT,
      text,
      botDirected: false,
    })
    expect(result.meta?.responder).toBe('stub')
  })
})
