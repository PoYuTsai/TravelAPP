/**
 * vision-intake-dispatch.test.ts — 圖片刀B dispatcher 接線：
 * createPartnerGroupResponderWithRagDraft 在 quoted_draft 之後、case_intake
 * 之前插 vision_intake 路徑；M3-0 ocr 雙閘 default off ⇒ 行為與現行完全相同
 * （gate off 落回 base，刀A 誠實條款負責回「讀不到圖片」）。
 *
 * 2026-06-11 改版：觸發＝引用圖＋tag（respondInput.quotedImage，由 webhook
 * 以 store 判定）；關鍵詞除役 — 純文字「讀取這張圖」不再進 vision 路徑。
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

function makeQuotedImageEvent(
  text: string,
  sourceChannel: 'line_partner_group' | 'line_oa' = 'line_partner_group'
): NormalizedLineEvent {
  return {
    kind: sourceChannel === 'line_oa' ? 'oa_text' : 'group_quoted',
    sourceChannel,
    lineUserId: 'U-partner',
    groupId: sourceChannel === 'line_partner_group' ? 'G-partner' : undefined,
    messageId: 'msg-1',
    timestamp: 1_760_000_000_000,
    text,
    mentionsBot: true,
    quotedRef: { quotedMessageId: 'M-img' },
  } as NormalizedLineEvent
}

function makeDispatcher(env: Record<string, string | undefined>) {
  const visionIntake = createVisionIntakeResponder({
    fetchImage: vi.fn(async () => ({ base64: 'aGk=', mediaType: 'image/jpeg' as const })),
    vision: vi.fn(async () => '客人：12/20 出發 2大2小'),
  })
  return createPartnerGroupResponderWithRagDraft({
    base: stubPartnerGroupResponder,
    answerSource: async () => ({ text: 'RAG 草稿內容' }),
    env,
    visionIntake,
  })
}

describe('vision-intake dispatch', () => {
  it('routes a quoted-image + tag message to the vision responder when both gates are on（無需任何關鍵詞）', async () => {
    const dispatcher = makeDispatcher(VISION_ON)
    const text = '@bot'
    const result = await dispatcher.respond({
      event: makeQuotedImageEvent(text),
      intent: INTENT,
      text,
      quotedImage: true,
    })
    expect(result.meta?.responder).toBe('vision_intake')
    expect(result.text).toContain('【截圖內容整理】')
  })

  it('keyword text WITHOUT a quoted image falls back to base（關鍵詞已除役）', async () => {
    const dispatcher = makeDispatcher(VISION_ON)
    const text = '@bot 讀取這張圖'
    const result = await dispatcher.respond({
      event: { ...makeQuotedImageEvent(text), kind: 'group_text', quotedRef: undefined },
      intent: INTENT,
      text,
    })
    expect(result.text).toBe(STUB_PARTNER_GROUP_REPLY)
    expect(result.meta?.responder).toBe('stub')
  })

  it('falls back to base when the gates are off（default off 不影響現行）', async () => {
    const dispatcher = makeDispatcher({})
    const text = '@bot'
    const result = await dispatcher.respond({
      event: makeQuotedImageEvent(text),
      intent: INTENT,
      text,
      quotedImage: true,
    })
    expect(result.text).toBe(STUB_PARTNER_GROUP_REPLY)
    expect(result.meta?.responder).toBe('stub')
  })

  it('vision wins over case_intake when a quoted image carries 客需 text（讀圖更具體）', async () => {
    const dispatcher = makeDispatcher({
      ...VISION_ON,
      AI_AGENT_CASE_INTAKE_ENABLED: 'true',
    })
    const text = '@bot 客需 整理一下'
    const result = await dispatcher.respond({
      event: makeQuotedImageEvent(text),
      intent: INTENT,
      text,
      quotedImage: true,
    })
    expect(result.meta?.responder).toBe('vision_intake')
  })

  it('case_intake path is not regressed（客需 without quoted image still routes to intake）', async () => {
    const dispatcher = makeDispatcher({
      ...VISION_ON,
      AI_AGENT_CASE_INTAKE_ENABLED: 'true',
    })
    const text = '客需：客人說 12 月想去清邁玩'
    const result = await dispatcher.respond({
      event: { ...makeQuotedImageEvent(text), kind: 'group_text', quotedRef: undefined },
      intent: INTENT,
      text,
    })
    expect(result.meta?.responder).toBe('intake')
  })

  it('never fires for OA events even with gates on（tool-gate 第 1 道）', async () => {
    const dispatcher = makeDispatcher(VISION_ON)
    const text = '看一下'
    const result = await dispatcher.respond({
      event: makeQuotedImageEvent(text, 'line_oa'),
      intent: INTENT,
      text,
      quotedImage: true,
    })
    expect(result.meta?.responder).toBe('stub')
  })

  it('never fires without botDirected', async () => {
    const dispatcher = makeDispatcher(VISION_ON)
    const text = '看一下'
    const result = await dispatcher.respond({
      event: { ...makeQuotedImageEvent(text), mentionsBot: false },
      intent: INTENT,
      text,
      botDirected: false,
      quotedImage: true,
    })
    expect(result.meta?.responder).toBe('stub')
  })

  it('omitting visionIntake keeps the dispatcher byte-identical to today', async () => {
    const dispatcher = createPartnerGroupResponderWithRagDraft({
      base: stubPartnerGroupResponder,
      answerSource: async () => ({ text: 'RAG 草稿內容' }),
      env: VISION_ON,
    })
    const text = '@bot'
    const result = await dispatcher.respond({
      event: makeQuotedImageEvent(text),
      intent: INTENT,
      text,
      quotedImage: true,
    })
    expect(result.meta?.responder).toBe('stub')
  })
})
