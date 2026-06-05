import { describe, expect, it } from 'vitest'

import {
  deliverDiscordResult,
  splitAgentContent,
} from '../discord-delivery.mjs'

describe('Discord agent identity delivery', () => {
  it('splits Room, Codex, and CC content into agent-addressable segments', () => {
    expect(
      splitAgentContent(
        [
          '[Room/ambient] focus: travel (TravelAPP)',
          '[Codex] I can narrow the decision. no tmux write.',
          '[CC] I can turn the next step into rc-travel. no tmux write.',
        ].join('\n')
      )
    ).toEqual([
      {
        agent: 'room',
        content: '[Room/ambient] focus: travel (TravelAPP)',
      },
      {
        agent: 'codex',
        content: 'I can narrow the decision. no tmux write.',
      },
      {
        agent: 'cc',
        content: 'I can turn the next step into rc-travel. no tmux write.',
      },
    ])
  })

  it('uses agent webhooks when they are configured and avoids fallback bot reply', async () => {
    const posts = []
    const fallback = []

    const result = await deliverDiscordResult(
      {
        shouldReply: true,
        content: [
          '[Codex] scope first. no tmux write.',
          '[CC] then implement. no tmux write.',
        ].join('\n'),
      },
      {
        fallbackReply: async (content) => fallback.push(content),
        fetch: async (url, init) => {
          posts.push({ url, body: JSON.parse(init.body) })
          return { ok: true, status: 204 }
        },
        webhooks: {
          codex: 'https://discord.example/codex',
          cc: 'https://discord.example/cc',
        },
        identities: {
          codex: {
            username: 'Codex',
            avatarUrl: 'https://official.example/openai.png',
          },
          cc: {
            username: 'Claude Code',
            avatarUrl: 'https://official.example/claude.png',
          },
        },
      }
    )

    expect(result.deliveredVia).toBe('webhook')
    expect(fallback).toEqual([])
    expect(posts).toEqual([
      {
        url: 'https://discord.example/codex',
        body: {
          username: 'Codex',
          avatar_url: 'https://official.example/openai.png',
          content: 'scope first. no tmux write.',
        },
      },
      {
        url: 'https://discord.example/cc',
        body: {
          username: 'Claude Code',
          avatar_url: 'https://official.example/claude.png',
          content: 'then implement. no tmux write.',
        },
      },
    ])
  })

  it('falls back to the normal bot reply when an agent webhook is missing', async () => {
    const replies = []

    const result = await deliverDiscordResult(
      {
        shouldReply: true,
        content: '[Codex] no webhook yet.',
      },
      {
        fallbackReply: async (content) => replies.push(content),
        webhooks: {},
      }
    )

    expect(result.deliveredVia).toBe('fallback')
    expect(replies).toEqual(['[Codex] no webhook yet.'])
  })
})
