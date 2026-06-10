/**
 * vision-intake-adapter.test.ts — 圖片刀B 的 Claude vision adapter.
 *
 * 鎖住：
 *   - request 形狀：Anthropic image block（base64 + media_type）＋固定抽取指令
 *   - prompt 誠實邊界：只整理截圖出現的文字、不得腦補、不得提價格
 *   - cost cap 紀律：非 ok 一律不打 transport；打完必 recordSpend
 *   - 錯誤一律 fixed-code VisionIntakeError（永不帶 key / 圖片內容）
 *   - model resolution：explicit > env > default（Haiku vision）
 */

import { describe, expect, it, vi } from 'vitest'
import {
  createAnthropicVisionIntakeSource,
  resolveVisionIntakeModel,
  VISION_INTAKE_MODEL_DEFAULT,
  VISION_EXTRACTION_SYSTEM_INSTRUCTION,
  VisionIntakeError,
} from '../partner-group/vision-intake-adapter'
import type { DailyCostCap } from '../observability/daily-cost-cap'

const IMAGE = { base64: 'aGVsbG8=', mediaType: 'image/jpeg' }

function okCostCap(): DailyCostCap & { spends: number[] } {
  const spends: number[] = []
  return {
    spends,
    async checkBudget() {
      return { outcome: 'ok' as const, dailySpendMicroUsd: 0 }
    },
    async recordSpend(usd: number) {
      spends.push(usd)
      return { recorded: true }
    },
  }
}

function blockedCostCap(outcome: 'over_cap' | 'disabled' | 'kv_unavailable'): DailyCostCap {
  return {
    async checkBudget() {
      return { outcome }
    },
    async recordSpend() {
      return { recorded: false }
    },
  }
}

function anthropicOkResponse(text: string, withUsage = true): Response {
  return new Response(
    JSON.stringify({
      content: [{ text }],
      ...(withUsage ? { usage: { input_tokens: 1500, output_tokens: 200 } } : {}),
    }),
    { status: 200 }
  )
}

describe('resolveVisionIntakeModel', () => {
  it('explicit > env > default', () => {
    expect(resolveVisionIntakeModel({ model: 'claude-x' })).toBe('claude-x')
    expect(
      resolveVisionIntakeModel({ env: { AI_AGENT_VISION_INTAKE_MODEL: 'claude-y' } })
    ).toBe('claude-y')
    expect(resolveVisionIntakeModel()).toBe(VISION_INTAKE_MODEL_DEFAULT)
  })
})

describe('VISION_EXTRACTION_SYSTEM_INSTRUCTION — 誠實邊界', () => {
  it('only transcribes what the screenshot shows; no fabrication, no prices', () => {
    expect(VISION_EXTRACTION_SYSTEM_INSTRUCTION).toContain('截圖')
    expect(VISION_EXTRACTION_SYSTEM_INSTRUCTION).toContain('不得')
    expect(VISION_EXTRACTION_SYSTEM_INSTRUCTION).toContain('腦補')
    expect(VISION_EXTRACTION_SYSTEM_INSTRUCTION).toContain('無法辨識')
    expect(VISION_EXTRACTION_SYSTEM_INSTRUCTION).toContain('繁體中文')
  })
})

describe('createAnthropicVisionIntakeSource', () => {
  it('POSTs an Anthropic image block and returns the extracted text + records spend', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () => anthropicOkResponse('客人：12/20 出發 2大2小'))
    const source = createAnthropicVisionIntakeSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k-test',
      costCap,
    })

    const text = await source(IMAGE)
    expect(text).toBe('客人：12/20 出發 2大2小')
    expect(costCap.spends).toHaveLength(1)

    expect(transport).toHaveBeenCalledTimes(1)
    const [url, init] = transport.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('k-test')
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe(VISION_INTAKE_MODEL_DEFAULT)
    const imageBlock = body.messages[0].content.find((b: { type: string }) => b.type === 'image')
    expect(imageBlock.source).toEqual({
      type: 'base64',
      media_type: 'image/jpeg',
      data: 'aGVsbG8=',
    })
  })

  it('never calls the transport when the budget is not ok (fixed code per outcome)', async () => {
    for (const outcome of ['over_cap', 'disabled', 'kv_unavailable'] as const) {
      const transport = vi.fn()
      const source = createAnthropicVisionIntakeSource({
        transport: transport as unknown as typeof fetch,
        apiKey: 'k',
        costCap: blockedCostCap(outcome),
      })
      await expect(source(IMAGE)).rejects.toMatchObject({
        name: 'VisionIntakeError',
        message: expect.stringContaining(`cost_cap_${outcome}`),
      })
      expect(transport).not.toHaveBeenCalled()
    }
  })

  it('maps transport rejection to fixed code anthropic_api_error (key never leaks)', async () => {
    const transport = vi.fn(async () => {
      throw new Error('boom with secret k-test')
    })
    const source = createAnthropicVisionIntakeSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k-test',
      costCap: okCostCap(),
    })
    const err = await source(IMAGE).then(
      () => null,
      (e) => e as VisionIntakeError
    )
    expect(err?.name).toBe('VisionIntakeError')
    expect(err?.message).toContain('anthropic_api_error')
    expect(err?.message).not.toContain('k-test')
  })

  it('maps non-200 to fixed code anthropic_non_200', async () => {
    const transport = vi.fn(async () => new Response('{}', { status: 429 }))
    const source = createAnthropicVisionIntakeSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap: okCostCap(),
    })
    await expect(source(IMAGE)).rejects.toMatchObject({
      message: expect.stringContaining('anthropic_non_200'),
    })
  })

  it('records a conservative spend even when usage is missing', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () => anthropicOkResponse('文字', false))
    const source = createAnthropicVisionIntakeSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await source(IMAGE)
    expect(costCap.spends).toHaveLength(1)
    expect(costCap.spends[0]).toBeGreaterThan(0)
  })

  it('maps an empty extraction to fixed code anthropic_parse_error (spend still recorded)', async () => {
    const costCap = okCostCap()
    const transport = vi.fn(async () => anthropicOkResponse('   '))
    const source = createAnthropicVisionIntakeSource({
      transport: transport as unknown as typeof fetch,
      apiKey: 'k',
      costCap,
    })
    await expect(source(IMAGE)).rejects.toMatchObject({
      message: expect.stringContaining('anthropic_parse_error'),
    })
    expect(costCap.spends).toHaveLength(1)
  })
})
