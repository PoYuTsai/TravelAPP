/**
 * vision-intake-dispatch.test.ts — 圖片刀B dispatcher 接線：
 * createPartnerGroupResponderWithRagDraft 在 quoted_draft 之後、case_intake
 * 之前插 vision_intake 路徑；M3-0 ocr 雙閘 default off ⇒ 行為與現行完全相同
 * （gate off 落回 base，刀A 誠實條款負責回「讀不到圖片」）。
 */

import { describe, expect, it, vi } from 'vitest'
import { createPartnerGroupResponderWithRagDraft } from '../partner-group/responder-factory'
import {
  stubPartnerGroupResponder,
  STUB_PARTNER_GROUP_REPLY,
} from '../partner-group/responder'
import { createVisionIntakeResponder } from '../partner-group/vision-intake-surfacing'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { CommandIntent } from '../commands/intent'

const INTENT: CommandIntent = { action: 'analyze', confidence: 'high', source: 'deterministic' }

const VISION_ON = {
  AI_AGENT_OCR_ENABLED: 'true',
  AI_AGENT_TOOL_COST_CAP_USD: '1',
}

function makeEvent(
  text: string,
  sourceChannel: 'line_partner_group' | 'line_oa' = 'line_partner_group'
): NormalizedLineEvent {
  return {
    kind: sourceChannel === 'line_oa' ? 'oa_text' : 'group_text',
    sourceChannel,
    lineUserId: 'U-partner',
    groupId: sourceChannel === 'line_partner_group' ? 'G-partner' : undefined,
    messageId: 'msg-1',
    timestamp: 1_760_000_000_000,
    text,
    mentionsBot: true,
  } as NormalizedLineEvent
}

function makeDispatcher(env: Record<string, string | undefined>) {
  const visionIntake = createVisionIntakeResponder({
    fetchImage: vi.fn(async () => ({ base64: 'aGk=', mediaType: 'image/jpeg' as const })),
    vision: vi.fn(async () => '客人：12/20 出發 2大2小'),
    getLatestImage: vi.fn(async () => ({
      messageId: 'M-img',
      timestamp: 1_760_000_000_000 - 1000,
    })),
  })
  return createPartnerGroupResponderWithRagDraft({
    base: stubPartnerGroupResponder,
    answerSource: async () => ({ text: 'RAG 草稿內容' }),
    env,
    visionIntake,
  })
}

describe('vision-intake dispatch', () => {
  it('routes a 讀圖 message to the vision responder when both gates are on', async () => {
    const dispatcher = makeDispatcher(VISION_ON)
    const text = '@bot 讀取這張圖'
    const result = await dispatcher.respond({ event: makeEvent(text), intent: INTENT, text })
    expect(result.meta?.responder).toBe('vision_intake')
    expect(result.text).toContain('【截圖內容整理】')
  })

  it('falls back to base when the gates are off（default off 不影響現行）', async () => {
    const dispatcher = makeDispatcher({})
    const text = '@bot 讀取這張圖'
    const result = await dispatcher.respond({ event: makeEvent(text), intent: INTENT, text })
    expect(result.text).toBe(STUB_PARTNER_GROUP_REPLY)
    expect(result.meta?.responder).toBe('stub')
  })

  it('vision wins over case_intake when a message carries BOTH lexicons（讀圖更具體）', async () => {
    const dispatcher = makeDispatcher({
      ...VISION_ON,
      AI_AGENT_CASE_INTAKE_ENABLED: 'true',
    })
    const text = '@bot 客需 讀取這張圖'
    const result = await dispatcher.respond({ event: makeEvent(text), intent: INTENT, text })
    expect(result.meta?.responder).toBe('vision_intake')
  })

  it('case_intake path is not regressed（客需 without 讀圖 still routes to intake）', async () => {
    const dispatcher = makeDispatcher({
      ...VISION_ON,
      AI_AGENT_CASE_INTAKE_ENABLED: 'true',
    })
    const text = '客需：客人說 12 月想去清邁玩'
    const result = await dispatcher.respond({ event: makeEvent(text), intent: INTENT, text })
    expect(result.meta?.responder).toBe('intake')
  })

  it('never fires for OA events even with gates on（tool-gate 第 1 道）', async () => {
    const dispatcher = makeDispatcher(VISION_ON)
    const text = '讀取這張圖'
    const result = await dispatcher.respond({
      event: makeEvent(text, 'line_oa'),
      intent: INTENT,
      text,
    })
    expect(result.meta?.responder).toBe('stub')
  })

  it('never fires without botDirected', async () => {
    const dispatcher = makeDispatcher(VISION_ON)
    const text = '讀取這張圖'
    const result = await dispatcher.respond({
      event: { ...makeEvent(text), mentionsBot: false },
      intent: INTENT,
      text,
      botDirected: false,
    })
    expect(result.meta?.responder).toBe('stub')
  })

  it('omitting visionIntake keeps the dispatcher byte-identical to today', async () => {
    const dispatcher = createPartnerGroupResponderWithRagDraft({
      base: stubPartnerGroupResponder,
      answerSource: async () => ({ text: 'RAG 草稿內容' }),
      env: VISION_ON,
    })
    const text = '@bot 讀取這張圖'
    const result = await dispatcher.respond({ event: makeEvent(text), intent: INTENT, text })
    expect(result.meta?.responder).toBe('stub')
  })
})
