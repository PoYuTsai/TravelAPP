/**
 * vision-draft-agent.test.ts — Task 6.
 *
 * createVisionDraftAgent({ responder }) 回一個與 SmartReplyAgent 同型的函式
 * (brief, input) => Promise<result>。內部：
 *   1. 把 brief（summary + knownFacts）組成 need 文字。
 *   2. 以 intent.action='draft' 呼叫注入的 draft responder（＝已含 golden 注入/gate/降級）。
 *   3. 對外段用 ensureTwoSegments 收尾，再補一個 INTERNAL_HEADER 段（列 brief.gaps）。
 *
 * 鎖住：
 *   1. responder 收到 intent.action='draft' 且 need 文字含 knownFacts；輸出兩段含 gaps。
 *   2. responder 降級時仍回兩段、不 throw。
 */

import { describe, expect, it, vi } from 'vitest'
import { OUTBOUND_HEADER, INTERNAL_HEADER } from '../partner-group/smart-reply-agent'
import { createVisionDraftAgent } from '../partner-group/vision-draft-agent'
import type {
  PartnerGroupRespondInput,
  PartnerGroupRespondResult,
} from '../partner-group/responder'
import type { VisionNeedBrief } from '../partner-group/vision-need-extraction'
import type { NormalizedLineEvent } from '../line/event-normalizer'

const T_EVENT = 1_700_000_600_000

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
  overrides: Partial<PartnerGroupRespondInput> = {}
): PartnerGroupRespondInput {
  const event = makeEvent()
  return {
    event,
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text: event.text ?? '',
    botDirected: true,
    quotedImage: true,
    ...overrides,
  }
}

describe('createVisionDraftAgent', () => {
  it('draftAgent：以 draft intent 呼叫 responder 並包成兩段', async () => {
    const responder = {
      respond: vi.fn(
        async (_input: PartnerGroupRespondInput): Promise<PartnerGroupRespondResult> => ({
          text: '<清邁5天4夜>\nDay 1｜...',
          meta: { responder: 'llm' },
        })
      ),
    }
    const draftAgent = createVisionDraftAgent({ responder })
    const out = await draftAgent(
      {
        isConversation: true,
        summary: '清邁親子五天',
        knownFacts: ['日期：7/1-7/5'],
        gaps: ['航班', '住宿'],
      },
      makeInput()
    )

    const calledInput = responder.respond.mock.calls[0][0]
    expect(calledInput.intent.action).toBe('draft')
    expect(calledInput.text).toContain('7/1-7/5')
    expect(calledInput.text).toContain('清邁親子五天')
    expect(out.text).toContain(OUTBOUND_HEADER)
    expect(out.text).toContain(INTERNAL_HEADER)
    expect(out.text).toContain('航班')
    expect(out.text).toContain('住宿')
  })

  it('responder 降級時仍回兩段、不 throw', async () => {
    const responder = {
      respond: vi.fn(
        async (): Promise<PartnerGroupRespondResult> => ({
          text: '草稿⚠️',
          meta: { responder: 'llm', degraded: true, error: 'itinerary_gate_failed' },
        })
      ),
    }
    const out = await createVisionDraftAgent({ responder })(
      { isConversation: true, summary: 's', knownFacts: [], gaps: [] },
      makeInput()
    )
    expect(out.text).toContain(OUTBOUND_HEADER)
    expect(out.text).toContain(INTERNAL_HEADER)
    // 降級 meta 應透傳，不被本檔吞掉。
    expect(out.meta?.degraded).toBe(true)
    expect(out.meta?.error).toBe('itinerary_gate_failed')
  })

  it('無 gaps 時內部段寫「無」', async () => {
    const responder = {
      respond: vi.fn(
        async (): Promise<PartnerGroupRespondResult> => ({
          text: '草稿內容',
          meta: { responder: 'llm' },
        })
      ),
    }
    const out = await createVisionDraftAgent({ responder })(
      { isConversation: true, summary: 's', knownFacts: [], gaps: [] },
      makeInput()
    )
    expect(out.text).toContain(INTERNAL_HEADER)
    // 鎖內部段本體：gaps 空 → 內部段以「無」收尾（不靠整串碰巧含「無」）。
    const internalSegment = out.text.split(INTERNAL_HEADER)[1]
    expect(internalSegment).toContain('待確認（截圖未提及、報價/排程需要）：\n無')
    expect(out.text.endsWith('無')).toBe(true)
  })

  it('responder 正文已自帶 INTERNAL_HEADER 時不重複補（idempotent）', async () => {
    const responder = {
      respond: vi.fn(
        async (): Promise<PartnerGroupRespondResult> => ({
          text: `${OUTBOUND_HEADER}\n草稿內容\n\n${INTERNAL_HEADER}\n待確認：航班`,
          meta: { responder: 'llm' },
        })
      ),
    }
    const out = await createVisionDraftAgent({ responder })(
      { isConversation: true, summary: 's', knownFacts: [], gaps: ['住宿'] },
      makeInput()
    )
    // 只能有一個 INTERNAL_HEADER —— 不因本檔補段而重複。
    expect(out.text.split(INTERNAL_HEADER).length - 1).toBe(1)
  })
})
