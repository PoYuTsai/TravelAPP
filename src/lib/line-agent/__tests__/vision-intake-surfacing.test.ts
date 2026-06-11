/**
 * vision-intake-surfacing.test.ts — 圖片刀B 的 surfacing decision + responder.
 *
 * 鎖住（2026-06-11 真機煙測後改版：引用圖＋tag 即觸發、去關鍵詞）：
 *   - 觸發＝「引用一張圖片＋tag bot」：quotedImage 由 webhook 以 store 判定後
 *     傳入；無關鍵詞需求 — 夥伴零學習成本
 *   - shouldUseVisionIntake 走 M3-0 tool-gate（ocr）：OA 永不、未 tag 永不、
 *     AI_AGENT_OCR_ENABLED default off、cost cap 未設（0）也擋 — 雙閘
 *   - 「這張圖」解析：只認引用（無引用＝surfacing 不會觸發；responder 防衛性
 *     地回固定誠實回覆）
 *   - fail-closed：找不到圖／content 404／vision 失敗 → 固定誠實回覆，
 *     絕不腦補
 *   - 成功：抽取文字 → triageCaseIntake → 三分流回覆（與客需刀直接接軌）
 */

import { describe, expect, it, vi } from 'vitest'
import {
  shouldUseVisionIntake,
  createVisionIntakeResponder,
  VISION_INTAKE_NO_IMAGE_REPLY,
  VISION_INTAKE_UNAVAILABLE_REPLY,
} from '../partner-group/vision-intake-surfacing'
import { LineContentError } from '../line/content-client'
import { VisionIntakeError } from '../partner-group/vision-intake-adapter'
import type { PartnerGroupRespondInput } from '../partner-group/responder'
import type { NormalizedLineEvent } from '../line/event-normalizer'

const GATE_ON_ENV = {
  AI_AGENT_OCR_ENABLED: 'true',
  AI_AGENT_TOOL_COST_CAP_USD: '1',
}

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
  vision: ReturnType<typeof vi.fn>
}

function makeResponder(
  overrides: Partial<Record<keyof ResponderFakes, ReturnType<typeof vi.fn>>> = {}
) {
  const fakes: ResponderFakes = {
    fetchImage:
      overrides.fetchImage ??
      vi.fn(async () => ({ base64: 'aGk=', mediaType: 'image/jpeg' })),
    vision:
      overrides.vision ??
      vi.fn(
        async () =>
          '客人：12/20 出發，12/26 回，2大2小（5歲、8歲），航班 CI851 10:20 抵達清邁機場，住古城民宿'
      ),
  }
  const responder = createVisionIntakeResponder({
    fetchImage: fakes.fetchImage as never,
    vision: fakes.vision as never,
  })
  return { responder, fakes }
}

// ---------------------------------------------------------------------------
// Surfacing gate（M3-0 tool-gate 'ocr' 真消費者）
// ---------------------------------------------------------------------------

describe('shouldUseVisionIntake', () => {
  const base = {
    sourceChannel: 'line_partner_group' as const,
    botDirected: true,
    quotedImage: true,
  }

  it('true only with partner group + tag + quoted image + BOTH gates on', () => {
    expect(shouldUseVisionIntake({ ...base, env: GATE_ON_ENV })).toBe(true)
  })

  it('no quoted image never fires（關鍵詞已除役 — 引用是唯一觸發）', () => {
    expect(
      shouldUseVisionIntake({ ...base, quotedImage: false, env: GATE_ON_ENV })
    ).toBe(false)
  })

  it('OA customer plane never fires (even with gates on)', () => {
    expect(
      shouldUseVisionIntake({ ...base, sourceChannel: 'line_oa', env: GATE_ON_ENV })
    ).toBe(false)
  })

  it('untagged message never fires', () => {
    expect(shouldUseVisionIntake({ ...base, botDirected: false, env: GATE_ON_ENV })).toBe(false)
  })

  it('default env (gate off) never fires', () => {
    expect(shouldUseVisionIntake({ ...base, env: {} })).toBe(false)
  })

  it('ocr enabled but cost cap unset (0) still never fires — 雙閘紀律', () => {
    expect(
      shouldUseVisionIntake({ ...base, env: { AI_AGENT_OCR_ENABLED: 'true' } })
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Responder — resolution + fail-closed + triage handoff
// ---------------------------------------------------------------------------

describe('createVisionIntakeResponder', () => {
  it('fetches the QUOTED messageId', async () => {
    const { responder, fakes } = makeResponder()
    const result = await responder.respond(makeInput(makeEvent()))

    expect(fakes.fetchImage).toHaveBeenCalledWith('M_img_quoted')
    expect(result.meta?.responder).toBe('vision_intake')
    // 抽取文字有進回覆，且三分流結果接在後面（sufficient: 摘要句式）
    expect(result.text).toContain('12/20')
  })

  it('no quote（防衛性：surfacing 不該放行）→ honest no-image reply, zero spend', async () => {
    const { responder, fakes } = makeResponder()
    const event = makeEvent({ kind: 'group_text', quotedRef: undefined })
    const result = await responder.respond(makeInput(event, { quotedImage: false }))
    expect(result.text).toBe(VISION_INTAKE_NO_IMAGE_REPLY)
    expect(result.meta?.degraded).toBe(true)
    expect(fakes.fetchImage).not.toHaveBeenCalled()
    expect(fakes.vision).not.toHaveBeenCalled()
  })

  it('content 404 (quoted message expired / not an image) → honest no-image reply', async () => {
    const notFound = vi.fn(async () => {
      throw new LineContentError('content_not_found', 404)
    })
    const { responder, fakes } = makeResponder({ fetchImage: notFound })
    const result = await responder.respond(makeInput(makeEvent()))
    expect(result.text).toBe(VISION_INTAKE_NO_IMAGE_REPLY)
    expect(fakes.vision).not.toHaveBeenCalled()
  })

  it('other content failures → fixed unavailable reply (code in meta, never raw error)', async () => {
    const tooBig = vi.fn(async () => {
      throw new LineContentError('content_too_large')
    })
    const { responder } = makeResponder({ fetchImage: tooBig })
    const result = await responder.respond(makeInput(makeEvent()))
    expect(result.text).toBe(VISION_INTAKE_UNAVAILABLE_REPLY)
    expect(result.meta?.degraded).toBe(true)
    expect(result.meta?.error).toBe('content_too_large')
  })

  it('vision failure → fixed unavailable reply with the fixed code', async () => {
    const fail = vi.fn(async () => {
      throw new VisionIntakeError('anthropic_non_200')
    })
    const { responder } = makeResponder({ vision: fail })
    const result = await responder.respond(makeInput(makeEvent()))
    expect(result.text).toBe(VISION_INTAKE_UNAVAILABLE_REPLY)
    expect(result.meta?.error).toBe('anthropic_non_200')
  })

  it('success hands the EXTRACTED text to triageCaseIntake (sufficient flow)', async () => {
    const { responder } = makeResponder()
    const result = await responder.respond(makeInput(makeEvent()))
    // 充分案例：三分流摘要把關鍵欄位整理出來
    expect(result.meta?.confidence).toBe('sufficient')
    expect(result.text).toContain('截圖')
    expect(result.text).toContain('2大2小')
  })

  it('insufficient extraction flows into the 缺項 triage branch', async () => {
    const thin = vi.fn(async () => '客人：請問清邁好玩嗎')
    const { responder } = makeResponder({ vision: thin })
    const result = await responder.respond(makeInput(makeEvent()))
    expect(result.meta?.confidence).toBe('insufficient')
  })

  it('caps the echoed extraction length in the reply', async () => {
    const long = vi.fn(async () => 'x'.repeat(5000))
    const { responder } = makeResponder({ vision: long })
    const result = await responder.respond(makeInput(makeEvent()))
    expect(result.text.length).toBeLessThan(3000)
  })
})
