import { describe, expect, it } from 'vitest'

import { createLiveAmbientReply } from '../ai-responder.mjs'

const STATE = {
  focus: 'travel',
  project: 'TravelAPP',
  activeSession: 'rc-travel',
  sessionHealth: 'tmux_only',
}

describe('live AI room responder', () => {
  it('stays disabled unless explicitly enabled', async () => {
    const calls = []
    const reply = await createLiveAmbientReply(
      { state: STATE, body: '各位晚上好' },
      {
        env: { OPENAI_API_KEY: 'secret' },
        fetch: fakeFetch(calls),
      }
    )

    expect(reply).toBeNull()
    expect(calls).toEqual([])
  })

  it('returns separate Codex and CC messages from an OpenAI JSON response', async () => {
    const calls = []
    const reply = await createLiveAmbientReply(
      { state: STATE, body: '今天有點累，想閒聊一下' },
      {
        env: {
          AI_ROOM_LIVE_AI_ENABLED: 'true',
          OPENAI_API_KEY: 'secret-openai-key',
          AI_ROOM_OPENAI_MODEL: 'gpt-test',
        },
        fetch: fakeFetch(calls, {
          output_text: JSON.stringify({
            room: '',
            codex: '我在，今天辛苦了，先不用急著產出。',
            cc: '我也在旁邊待命，今晚可以慢慢聊。',
          }),
        }),
      }
    )

    expect(reply).toBe(
      [
        '[Codex] 我在，今天辛苦了，先不用急著產出。',
        '[CC] 我也在旁邊待命，今晚可以慢慢聊。',
      ].join('\n')
    )
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.openai.com/v1/responses')
    expect(calls[0].headers.Authorization).toBe('Bearer secret-openai-key')
    expect(JSON.parse(calls[0].body)).toMatchObject({
      model: 'gpt-test',
      max_output_tokens: 650,
    })
    expect(JSON.parse(calls[0].body).input).toContain('message=今天有點累')
  })

  it('falls back to templates when the provider response is unavailable', async () => {
    const reply = await createLiveAmbientReply(
      { state: STATE, body: '幫我想一下下一步' },
      {
        env: {
          AI_ROOM_LIVE_AI_ENABLED: 'true',
          OPENAI_API_KEY: 'secret-openai-key',
        },
        fetch: async () => ({ ok: false, status: 500 }),
      }
    )

    expect(reply).toBeNull()
  })
})

function fakeFetch(calls, json = {}) {
  return async (url, options) => {
    calls.push({
      url,
      method: options.method,
      headers: options.headers,
      body: options.body,
    })
    return {
      ok: true,
      async json() {
        return json
      },
    }
  }
}
