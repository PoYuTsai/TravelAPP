/**
 * anthropic-responder.test.ts — real-model adapter via an INJECTED fake
 * transport (design 2026-06-03 §5 / §6 / §8 test 3).  Never hits a real API,
 * never needs a real key.
 *
 * Asserts the request contract (URL, headers, routed model, locked system
 * prompt, user text) and the safe-default error behavior: throw / non-200 /
 * parse-failure all fall back to stub text with meta.degraded=true and the
 * matching error code, and NEVER throw (a thrown error would 500 the webhook).
 */

import { describe, it, expect, vi } from 'vitest'
import { AnthropicPartnerGroupResponder } from '@/lib/line-agent/partner-group/anthropic-responder'
import { PARTNER_GROUP_SYSTEM_PROMPT } from '@/lib/line-agent/partner-group/system-prompt'
import type {
  PartnerGroupRespondInput,
} from '@/lib/line-agent/partner-group/responder'
import type { IntentAction } from '@/lib/line-agent/commands/intent'

const DEPS = {
  apiKey: 'sk-ant-test',
  defaultModel: 'claude-default',
  researchModel: 'claude-research',
}

function makeInput(action: IntentAction = 'analyze', text = '@bot 看一下這團'): PartnerGroupRespondInput {
  return {
    event: {
      kind: 'group_text',
      sourceChannel: 'line_partner_group',
      lineUserId: 'U_tsai',
      groupId: 'G_partner',
      messageId: 'M001',
      text,
      mentionsBot: true,
      timestamp: 1_700_000_000_000,
    },
    intent: { action, confidence: 'high', source: 'llm' },
    text,
  }
}

/** Build a fake transport that records its call and returns a canned response. */
function fakeTransport(response: Partial<Response> & { jsonValue?: unknown }) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const transport = (async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: (init ?? {}) as RequestInit })
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.jsonValue,
    } as unknown as Response
  }) as unknown as typeof fetch
  return { transport, calls }
}

const OK_BODY = { content: [{ type: 'text', text: '建議先確認人數與日期。' }] }

describe('AnthropicPartnerGroupResponder — request contract', () => {
  it('POSTs to the Anthropic messages endpoint with the injected key + version header', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })

    await responder.respond(makeInput())

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages')
    expect(calls[0].init.method).toBe('POST')
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-test')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['content-type']).toBe('application/json')
  })

  it('sends the locked system prompt, the user text, and a positive max_tokens', async () => {
    const { transport, calls } = fakeTransport({ jsonValue: OK_BODY })
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })

    await responder.respond(makeInput('analyze', '@bot 這團幾天'))

    const body = JSON.parse(calls[0].init.body as string)
    expect(body.system).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    expect(body.messages[0]).toEqual({ role: 'user', content: '@bot 這團幾天' })
    expect(typeof body.max_tokens).toBe('number')
    expect(body.max_tokens).toBeGreaterThan(0)
  })

  it('routes the model dynamically from intent (analyze→default, draft→research)', async () => {
    const a = fakeTransport({ jsonValue: OK_BODY })
    await new AnthropicPartnerGroupResponder({ transport: a.transport, ...DEPS }).respond(makeInput('analyze'))
    expect(JSON.parse(a.calls[0].init.body as string).model).toBe('claude-default')

    const d = fakeTransport({ jsonValue: OK_BODY })
    await new AnthropicPartnerGroupResponder({ transport: d.transport, ...DEPS }).respond(makeInput('draft'))
    expect(JSON.parse(d.calls[0].init.body as string).model).toBe('claude-research')
  })

  it('parses content[0].text into the result and tags meta.responder=llm + model', async () => {
    const { transport } = fakeTransport({ jsonValue: OK_BODY })
    const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })

    const result = await responder.respond(makeInput('analyze'))

    expect(result.text).toBe('建議先確認人數與日期。')
    expect(result.meta?.responder).toBe('llm')
    expect(result.meta?.model).toBe('claude-default')
    expect(result.meta?.degraded).toBeUndefined()
  })
})

describe('AnthropicPartnerGroupResponder — safe-default error paths (never throws)', () => {
  it('transport throw → stub text + degraded + error=anthropic_api_error', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const transport = (async () => {
        throw new Error('network down')
      }) as unknown as typeof fetch
      const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })

      const result = await responder.respond(makeInput('analyze'))

      expect(result.text).toContain('收到，我先記下來')
      expect(result.meta?.responder).toBe('stub')
      expect(result.meta?.degraded).toBe(true)
      expect(result.meta?.error).toBe('anthropic_api_error')
      expect(result.meta?.model).toBe('claude-default') // the attempted model
      expect(err).toHaveBeenCalled()
    } finally {
      err.mockRestore()
    }
  })

  it('non-200 → stub text + degraded + error=anthropic_non_200', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { transport } = fakeTransport({ ok: false, status: 500, jsonValue: {} })
      const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })

      const result = await responder.respond(makeInput('analyze'))

      expect(result.text).toContain('收到，我先記下來')
      expect(result.meta?.degraded).toBe(true)
      expect(result.meta?.error).toBe('anthropic_non_200')
    } finally {
      warn.mockRestore()
      errSpy.mockRestore()
    }
  })

  it('unparseable success body → stub text + degraded + error=anthropic_parse_error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { transport } = fakeTransport({ ok: true, status: 200, jsonValue: { content: [] } })
      const responder = new AnthropicPartnerGroupResponder({ transport, ...DEPS })

      const result = await responder.respond(makeInput('analyze'))

      expect(result.text).toContain('收到，我先記下來')
      expect(result.meta?.degraded).toBe(true)
      expect(result.meta?.error).toBe('anthropic_parse_error')
    } finally {
      warn.mockRestore()
      errSpy.mockRestore()
    }
  })
})
