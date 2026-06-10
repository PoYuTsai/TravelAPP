/**
 * vision-intake-surfacing.test.ts — 圖片刀B 的 surfacing decision + responder.
 *
 * 鎖住：
 *   - 觸發詞：讀取這張圖／看圖／截圖系自然語（與 客需/RAG 詞彙不重疊）
 *   - shouldUseVisionIntake 走 M3-0 tool-gate（ocr）：OA 永不、未 tag 永不、
 *     AI_AGENT_OCR_ENABLED default off、cost cap 未設（0）也擋 — 雙閘
 *   - 「這張圖」解析：引用優先 → 群內最近一張（30 分鐘 freshness 窗）
 *   - fail-closed：找不到圖／content 404／vision 失敗 → 固定誠實回覆，
 *     絕不腦補；store 讀取失敗視同沒圖
 *   - 成功：抽取文字 → triageCaseIntake → 三分流回覆（與客需刀直接接軌）
 */

import { describe, expect, it, vi } from 'vitest'
import {
  detectVisionIntakeIntent,
  shouldUseVisionIntake,
  createVisionIntakeResponder,
  VISION_INTAKE_NO_IMAGE_REPLY,
  VISION_INTAKE_UNAVAILABLE_REPLY,
  VISION_IMAGE_FRESHNESS_MS,
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
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_chun',
    groupId: 'G_partner',
    messageId: 'M_text1',
    text: '@bot 讀取這張圖',
    mentionsBot: true,
    timestamp: T_EVENT,
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
    ...overrides,
  }
}

interface ResponderFakes {
  fetchImage: ReturnType<typeof vi.fn>
  vision: ReturnType<typeof vi.fn>
  getLatestImage: ReturnType<typeof vi.fn>
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
    getLatestImage:
      overrides.getLatestImage ??
      vi.fn(async () => ({ messageId: 'M_img_latest', timestamp: T_EVENT - 60_000 })),
  }
  const responder = createVisionIntakeResponder({
    fetchImage: fakes.fetchImage as never,
    vision: fakes.vision as never,
    getLatestImage: fakes.getLatestImage as never,
  })
  return { responder, fakes }
}

// ---------------------------------------------------------------------------
// Intent lexicon
// ---------------------------------------------------------------------------

describe('detectVisionIntakeIntent', () => {
  it.each([
    '@bot 讀取這張圖',
    '@bot 幫我看一下這張圖',
    '@bot 看圖整理一下',
    '@bot 這張截圖的客人需求',
    '@bot 讀取圖片',
    'bot 讀一下截圖',
  ])('fires on %s', (text) => {
    expect(detectVisionIntakeIntent(text)).toBe(true)
  })

  it.each([
    '@bot 客需 12/20 2大2小',
    '@bot 查內部案例 清萊一日遊',
    '@bot 你是誰',
    '我傳了一張圖給客人',
    '',
  ])('stays silent on %s', (text) => {
    expect(detectVisionIntakeIntent(text)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Surfacing gate（M3-0 tool-gate 'ocr' 真消費者）
// ---------------------------------------------------------------------------

describe('shouldUseVisionIntake', () => {
  const base = {
    sourceChannel: 'line_partner_group' as const,
    botDirected: true,
    text: '@bot 讀取這張圖',
  }

  it('true only with partner group + tag + intent + BOTH gates on', () => {
    expect(shouldUseVisionIntake({ ...base, env: GATE_ON_ENV })).toBe(true)
  })

  it('OA customer plane never fires (even with gates on)', () => {
    expect(
      shouldUseVisionIntake({ ...base, sourceChannel: 'line_oa', env: GATE_ON_ENV })
    ).toBe(false)
  })

  it('untagged message never fires', () => {
    expect(shouldUseVisionIntake({ ...base, botDirected: false, env: GATE_ON_ENV })).toBe(false)
  })

  it('no vision intent never fires', () => {
    expect(
      shouldUseVisionIntake({ ...base, text: '@bot 客需 整理一下', env: GATE_ON_ENV })
    ).toBe(false)
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
  it('quoted image wins: fetches the QUOTED messageId, never reads the store', async () => {
    const { responder, fakes } = makeResponder()
    const event = makeEvent({
      kind: 'group_quoted',
      quotedRef: { quotedMessageId: 'M_img_quoted' },
    })
    const result = await responder.respond(makeInput(event))

    expect(fakes.fetchImage).toHaveBeenCalledWith('M_img_quoted')
    expect(fakes.getLatestImage).not.toHaveBeenCalled()
    expect(result.meta?.responder).toBe('vision_intake')
    // 抽取文字有進回覆，且三分流結果接在後面（sufficient: 摘要句式）
    expect(result.text).toContain('12/20')
  })

  it('no quote: falls back to the latest fresh group image', async () => {
    const { responder, fakes } = makeResponder()
    await responder.respond(makeInput(makeEvent()))
    expect(fakes.getLatestImage).toHaveBeenCalledWith('G_partner')
    expect(fakes.fetchImage).toHaveBeenCalledWith('M_img_latest')
  })

  it('stale latest image (outside the freshness window) → honest no-image reply, zero spend', async () => {
    const stale = vi.fn(async () => ({
      messageId: 'M_old',
      timestamp: T_EVENT - VISION_IMAGE_FRESHNESS_MS - 1,
    }))
    const { responder, fakes } = makeResponder({ getLatestImage: stale })
    const result = await responder.respond(makeInput(makeEvent()))
    expect(result.text).toBe(VISION_INTAKE_NO_IMAGE_REPLY)
    expect(result.meta?.degraded).toBe(true)
    expect(fakes.fetchImage).not.toHaveBeenCalled()
    expect(fakes.vision).not.toHaveBeenCalled()
  })

  it('no image recorded → honest no-image reply', async () => {
    const none = vi.fn(async () => null)
    const { responder } = makeResponder({ getLatestImage: none })
    const result = await responder.respond(makeInput(makeEvent()))
    expect(result.text).toBe(VISION_INTAKE_NO_IMAGE_REPLY)
  })

  it('store read failure is fail-safe: treated as no image, never throws', async () => {
    const boom = vi.fn(async () => {
      throw new Error('kv down')
    })
    const { responder } = makeResponder({ getLatestImage: boom })
    const result = await responder.respond(makeInput(makeEvent()))
    expect(result.text).toBe(VISION_INTAKE_NO_IMAGE_REPLY)
  })

  it('content 404 (quoted a text message / expired) → honest no-image reply', async () => {
    const notFound = vi.fn(async () => {
      throw new LineContentError('content_not_found', 404)
    })
    const { responder, fakes } = makeResponder({ fetchImage: notFound })
    const event = makeEvent({
      kind: 'group_quoted',
      quotedRef: { quotedMessageId: 'M_textmsg' },
    })
    const result = await responder.respond(makeInput(event))
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
