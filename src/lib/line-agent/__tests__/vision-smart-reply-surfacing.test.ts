/**
 * vision-smart-reply-surfacing.test.ts — 圖片智慧回覆 responder（Task 4.1）.
 *
 * 取代舊「轉錄→triage 死路」path。流程：夥伴引用客人截圖＋tag bot →
 *   抓圖 → need 語義抽取 → 真對話 ⇒ 跑 agentic smart-reply 兩段回覆。
 *
 * 鎖住（fail-closed 全鏈、永不 throw、夥伴永遠有回覆）：
 *   1. 正常：need → agent，回 agent 的兩段文字；agent 被呼叫一次、帶 brief
 *   2. 非對話截圖：need.isConversation=false → 固定誠實句；agent 0 次；
 *      meta degraded not_a_conversation（不燒 RAG/web）
 *   3. fetchImage 404 → NO_IMAGE 固定回覆；agent 0 次
 *   4. need throw VisionIntakeError → UNAVAILABLE 固定回覆；agent 0 次
 *   5. 無 quotedMessageId → NO_IMAGE 固定回覆；agent 0 次
 */

import { describe, expect, it, vi } from 'vitest'
import {
  createVisionSmartReplyResponder,
  VISION_SMART_REPLY_NOT_A_CONVERSATION_REPLY,
} from '../partner-group/vision-smart-reply-surfacing'
import {
  VISION_INTAKE_NO_IMAGE_REPLY,
  VISION_INTAKE_UNAVAILABLE_REPLY,
} from '../partner-group/vision-intake-surfacing'
import { LineContentError } from '../line/content-client'
import { VisionIntakeError } from '../partner-group/vision-intake-adapter'
import type { VisionNeedBrief } from '../partner-group/vision-need-extraction'
import type {
  PartnerGroupRespondInput,
  PartnerGroupRespondResult,
} from '../partner-group/responder'
import type { NormalizedLineEvent } from '../line/event-normalizer'

const T_EVENT = 1_700_000_600_000

const CONVERSATION_BRIEF: VisionNeedBrief = {
  isConversation: true,
  summary: '客人想 12/20–12/26 帶 2大2小（5歲、8歲）清邁親子包車',
  knownFacts: ['12/20 出發', '12/26 回', '2大2小（5歲、8歲）'],
  gaps: ['航班', '住宿區域'],
}

const AGENT_TWO_SEGMENT =
  '【可直接複製給客人】\n沒問題，這個天數很適合親子安排。\n\n【內部備註・待確認】\n待確認：航班、住宿區域。'

function makeEvent(overrides: Partial<NormalizedLineEvent> = {}): NormalizedLineEvent {
  return {
    kind: 'group_quoted',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_chun',
    groupId: 'G_partner',
    messageId: 'M_text1',
    text: '@bot',
    mentionsBot: true,
    timestamp: T_EVENT,
    quotedRef: { quotedMessageId: 'M_img_quoted' },
    ...overrides,
  }
}

function makeInput(
  event: NormalizedLineEvent,
  overrides: Partial<PartnerGroupRespondInput> = {}
): PartnerGroupRespondInput {
  return {
    event,
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text: event.text ?? '',
    botDirected: true,
    quotedImage: true,
    ...overrides,
  }
}

interface ResponderFakes {
  fetchImage: ReturnType<typeof vi.fn>
  need: ReturnType<typeof vi.fn>
  agent: ReturnType<typeof vi.fn>
}

function makeResponder(
  overrides: Partial<Record<keyof ResponderFakes, ReturnType<typeof vi.fn>>> = {}
) {
  const fakes: ResponderFakes = {
    fetchImage:
      overrides.fetchImage ??
      vi.fn(async () => ({ base64: 'aGk=', mediaType: 'image/jpeg' })),
    need: overrides.need ?? vi.fn(async () => CONVERSATION_BRIEF),
    agent:
      overrides.agent ??
      vi.fn(
        async (): Promise<PartnerGroupRespondResult> => ({
          text: AGENT_TWO_SEGMENT,
          meta: { responder: 'llm', model: 'claude-x' },
        })
      ),
  }
  const responder = createVisionSmartReplyResponder({
    fetchImage: fakes.fetchImage as never,
    need: fakes.need as never,
    agent: fakes.agent as never,
  })
  return { responder, fakes }
}

describe('createVisionSmartReplyResponder', () => {
  it('1. normal: need → agent, returns the agent two-segment text', async () => {
    const { responder, fakes } = makeResponder()
    const result = await responder.respond(makeInput(makeEvent()))

    expect(fakes.fetchImage).toHaveBeenCalledWith('M_img_quoted')
    expect(fakes.need).toHaveBeenCalledTimes(1)
    expect(fakes.agent).toHaveBeenCalledTimes(1)
    expect(fakes.agent).toHaveBeenCalledWith(CONVERSATION_BRIEF, expect.anything())
    expect(result.text).toBe(AGENT_TWO_SEGMENT)
    expect(result.meta?.responder).toBe('llm')
  })

  it('2. non-conversation: fixed sentence, agent NOT called, degraded not_a_conversation', async () => {
    const need = vi.fn(async () => ({
      isConversation: false,
      summary: '',
      knownFacts: [],
      gaps: [],
    }))
    const { responder, fakes } = makeResponder({ need })
    const result = await responder.respond(makeInput(makeEvent()))

    expect(result.text).toBe(VISION_SMART_REPLY_NOT_A_CONVERSATION_REPLY)
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBe('not_a_conversation')
    expect(fakes.agent).not.toHaveBeenCalled()
  })

  it('3. fetchImage 404 → NO_IMAGE reply, agent not called', async () => {
    const notFound = vi.fn(async () => {
      throw new LineContentError('content_not_found', 404)
    })
    const { responder, fakes } = makeResponder({ fetchImage: notFound })
    const result = await responder.respond(makeInput(makeEvent()))

    expect(result.text).toBe(VISION_INTAKE_NO_IMAGE_REPLY)
    expect(result.meta?.degraded).toBe(true)
    expect(fakes.need).not.toHaveBeenCalled()
    expect(fakes.agent).not.toHaveBeenCalled()
  })

  it('4. need throws VisionIntakeError → UNAVAILABLE reply, agent NOT called', async () => {
    const need = vi.fn(async () => {
      throw new VisionIntakeError('anthropic_non_200')
    })
    const { responder, fakes } = makeResponder({ need })
    const result = await responder.respond(makeInput(makeEvent()))

    expect(result.text).toBe(VISION_INTAKE_UNAVAILABLE_REPLY)
    expect(result.meta?.error).toBe('anthropic_non_200')
    expect(fakes.agent).not.toHaveBeenCalled()
  })

  it('5. no quotedMessageId → NO_IMAGE reply, agent not called', async () => {
    const { responder, fakes } = makeResponder()
    const event = makeEvent({ kind: 'group_text', quotedRef: undefined })
    const result = await responder.respond(makeInput(event, { quotedImage: false }))

    expect(result.text).toBe(VISION_INTAKE_NO_IMAGE_REPLY)
    expect(result.meta?.degraded).toBe(true)
    expect(fakes.fetchImage).not.toHaveBeenCalled()
    expect(fakes.need).not.toHaveBeenCalled()
    expect(fakes.agent).not.toHaveBeenCalled()
  })
})
