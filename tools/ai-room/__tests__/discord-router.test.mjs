import { describe, expect, it } from 'vitest'

import { routeDiscordMessage } from '../discord-router.mjs'

const ENV = {
  privateChannelId: 'private-ai-room',
}

describe('Discord AI room router', () => {
  it('routes /sessions from the private room to the sessions command', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'private-ai-room',
          authorId: 'eric',
          content: '/sessions',
        },
        ENV
      )
    ).toEqual({
      allowed: true,
      intent: 'sessions',
      actor: 'eric',
      targetAgent: 'room',
      args: [],
      requiresWrite: false,
    })
  })

  it('routes /focus travel as a focus switch that requires confirmation', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'private-ai-room',
          authorId: 'eric',
          content: '/focus travel',
        },
        ENV
      )
    ).toEqual({
      allowed: true,
      intent: 'focus_switch',
      actor: 'eric',
      targetAgent: 'room',
      args: ['travel'],
      requiresWrite: false,
      requiresConfirmation: true,
    })
  })

  it('routes @cc messages to the implementation agent and marks them as writes', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'private-ai-room',
          authorId: 'eric',
          content: '@cc implement the current plan',
        },
        ENV
      )
    ).toEqual({
      allowed: true,
      intent: 'implement',
      actor: 'eric',
      targetAgent: 'cc',
      args: ['implement the current plan'],
      requiresWrite: true,
    })
  })

  it('routes @codex review messages to the review agent without tmux write', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'private-ai-room',
          authorId: 'eric',
          content: '@codex review current diff',
        },
        ENV
      )
    ).toEqual({
      allowed: true,
      intent: 'review',
      actor: 'eric',
      targetAgent: 'codex',
      args: ['review current diff'],
      requiresWrite: false,
    })
  })

  it('blocks write-like commands outside the private room', () => {
    const decision = routeDiscordMessage(
      {
        channelId: 'legacy-vibesync',
        authorId: 'partner',
        content: '@cc fix this bug',
      },
      ENV
    )

    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('private AI room')
  })

  it('ignores ordinary chatter outside the private room', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'legacy-vibesync',
          authorId: 'partner',
          content: 'thanks',
        },
        ENV
      )
    ).toEqual({
      allowed: false,
      intent: 'ignore',
      reason: 'message is outside the private AI room',
    })
  })

  it('routes ordinary chatter inside the private room to ambient chat', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'private-ai-room',
          authorId: 'eric',
          content: '我覺得這個系統有點複雜，怕失控',
        },
        ENV
      )
    ).toEqual({
      allowed: true,
      intent: 'ambient_chat',
      actor: 'eric',
      targetAgent: 'ambient',
      args: ['我覺得這個系統有點複雜，怕失控'],
      requiresWrite: false,
      maxAgentTurns: 2,
    })
  })

  it('routes lifecycle commands through room intent', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'private-ai-room',
          authorId: 'eric',
          content: '/round',
        },
        ENV
      )
    ).toMatchObject({
      allowed: true,
      intent: 'round',
      targetAgent: 'room',
      requiresWrite: true,
    })
  })

  it('routes /mode autopilot_ship as a confirmed room state change', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'private-ai-room',
          authorId: 'eric',
          content: '/mode autopilot_ship',
        },
        ENV
      )
    ).toEqual({
      allowed: true,
      intent: 'mode_switch',
      actor: 'eric',
      targetAgent: 'room',
      args: ['autopilot_ship'],
      requiresWrite: false,
      requiresConfirmation: true,
    })
  })

  it('routes /chat-clear as a Discord channel cleanup command', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'private-ai-room',
          authorId: 'eric',
          content: '/chat-clear count:100',
        },
        ENV
      )
    ).toEqual({
      allowed: true,
      intent: 'chat_clear',
      actor: 'eric',
      targetAgent: 'room',
      args: ['count:100'],
      requiresWrite: false,
      ephemeral: true,
    })
  })

  it('routes /chat-mode casual as a room state change', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'private-ai-room',
          authorId: 'eric',
          content: '/chat-mode casual',
        },
        ENV
      )
    ).toEqual({
      allowed: true,
      intent: 'chat_mode_switch',
      actor: 'eric',
      targetAgent: 'room',
      args: ['casual'],
      requiresWrite: false,
    })
  })

  it('routes /codex prompts to the Codex role without tmux write', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'private-ai-room',
          authorId: 'eric',
          content: '/codex 你有什麼優缺點？',
        },
        ENV
      )
    ).toEqual({
      allowed: true,
      intent: 'plan',
      actor: 'eric',
      targetAgent: 'codex',
      args: ['你有什麼優缺點？'],
      requiresWrite: false,
    })
  })

  it('routes /cc prompts to the Claude Code role as guarded writes', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'private-ai-room',
          authorId: 'eric',
          content: '/cc 實作目前計畫 --confirm',
        },
        ENV
      )
    ).toEqual({
      allowed: true,
      intent: 'implement',
      actor: 'eric',
      targetAgent: 'cc',
      args: ['實作目前計畫 --confirm'],
      requiresWrite: true,
    })
  })

  it('routes two-agent open questions as non-writing roundtable chat', () => {
    expect(
      routeDiscordMessage(
        {
          channelId: 'private-ai-room',
          authorId: 'eric',
          content: '@cc 跟@codex 你們有什麼優缺點？如何分工',
        },
        ENV
      )
    ).toEqual({
      allowed: true,
      intent: 'two_agent_question',
      actor: 'eric',
      targetAgent: 'ambient',
      args: ['你們有什麼優缺點？如何分工'],
      requiresWrite: false,
    })
  })
})
