import { describe, expect, it } from 'vitest'

import {
  AI_ROOM_SLASH_COMMANDS,
  discordInteractionToMessage,
  shouldHandleInteraction,
} from '../discord-commands.mjs'

describe('Discord slash commands', () => {
  it('defines the private room slash commands Discord should register', () => {
    const names = AI_ROOM_SLASH_COMMANDS.map((command) => command.name)

    expect(names).toEqual([
      'sessions',
      'focus',
      'health',
      'mode',
      'chat-mode',
      'codex',
      'cc',
      'round',
      'clear',
      'chat-clear',
      'interrupt',
      'rebind',
    ])
    expect(AI_ROOM_SLASH_COMMANDS.find((command) => command.name === 'focus')).toMatchObject({
      options: [
        {
          name: 'project',
          required: false,
        },
        {
          name: 'confirm',
          required: false,
        },
      ],
    })
    expect(AI_ROOM_SLASH_COMMANDS.find((command) => command.name === 'round')).toMatchObject({
      options: [
        {
          name: 'confirm',
          required: false,
        },
      ],
    })
    expect(AI_ROOM_SLASH_COMMANDS.find((command) => command.name === 'clear')).toMatchObject({
      options: [
        {
          name: 'force',
          required: false,
        },
        {
          name: 'confirm',
          required: false,
        },
      ],
    })
    expect(AI_ROOM_SLASH_COMMANDS.find((command) => command.name === 'chat-clear')).toMatchObject({
      options: [
        {
          name: 'count',
          required: true,
        },
        {
          name: 'confirm',
          required: false,
        },
      ],
    })
    expect(AI_ROOM_SLASH_COMMANDS.find((command) => command.name === 'chat-mode')).toMatchObject({
      options: [
        {
          name: 'mode',
          required: false,
        },
      ],
    })
    expect(AI_ROOM_SLASH_COMMANDS.find((command) => command.name === 'codex')).toMatchObject({
      options: [
        {
          name: 'prompt',
          required: false,
        },
      ],
    })
    expect(AI_ROOM_SLASH_COMMANDS.find((command) => command.name === 'cc')).toMatchObject({
      options: [
        {
          name: 'prompt',
          required: false,
        },
        {
          name: 'confirm',
          required: false,
        },
      ],
    })
  })

  it('converts slash interactions into the same message shape as text commands', () => {
    const message = discordInteractionToMessage(
      fakeInteraction({
        commandName: 'focus',
        options: {
          project: 'vibesync',
          confirm: true,
        },
      })
    )

    expect(message).toEqual({
      channelId: 'private-ai-room',
      authorId: 'eric',
      content: '/focus vibesync confirm',
    })
  })

  it('converts confirmed round slash interactions into /round confirm', () => {
    expect(
      discordInteractionToMessage(
        fakeInteraction({
          commandName: 'round',
          options: {
            confirm: true,
          },
        })
      )
    ).toEqual({
      channelId: 'private-ai-room',
      authorId: 'eric',
      content: '/round confirm',
    })
  })

  it('converts confirmed clear slash interactions into /clear force confirm', () => {
    expect(
      discordInteractionToMessage(
        fakeInteraction({
          commandName: 'clear',
          options: {
            force: true,
            confirm: true,
          },
        })
      )
    ).toEqual({
      channelId: 'private-ai-room',
      authorId: 'eric',
      content: '/clear force confirm',
    })
  })

  it('converts chat-clear slash interactions into /chat-clear count:100', () => {
    expect(
      discordInteractionToMessage(
        fakeInteraction({
          commandName: 'chat-clear',
          options: {
            count: 100,
          },
        })
      )
    ).toEqual({
      channelId: 'private-ai-room',
      authorId: 'eric',
      content: '/chat-clear count:100',
    })
  })

  it('converts chat-mode slash interactions into /chat-mode casual', () => {
    expect(
      discordInteractionToMessage(
        fakeInteraction({
          commandName: 'chat-mode',
          options: {
            mode: 'casual',
          },
        })
      )
    ).toEqual({
      channelId: 'private-ai-room',
      authorId: 'eric',
      content: '/chat-mode casual',
    })
  })

  it('converts codex slash interactions into /codex prompt text', () => {
    expect(
      discordInteractionToMessage(
        fakeInteraction({
          commandName: 'codex',
          options: {
            prompt: '你有什麼優缺點？',
          },
        })
      )
    ).toEqual({
      channelId: 'private-ai-room',
      authorId: 'eric',
      content: '/codex 你有什麼優缺點？',
    })
  })

  it('converts confirmed cc slash interactions into /cc prompt --confirm', () => {
    expect(
      discordInteractionToMessage(
        fakeInteraction({
          commandName: 'cc',
          options: {
            prompt: '實作目前計畫',
            confirm: true,
          },
        })
      )
    ).toEqual({
      channelId: 'private-ai-room',
      authorId: 'eric',
      content: '/cc 實作目前計畫 --confirm',
    })
  })

  it('marks only chat input interactions as handled', () => {
    expect(shouldHandleInteraction(fakeInteraction())).toBe(true)
    expect(
      shouldHandleInteraction({
        isChatInputCommand: () => false,
      })
    ).toBe(false)
  })
})

function fakeInteraction({ commandName = 'sessions', options = {} } = {}) {
  return {
    channelId: 'private-ai-room',
    user: { id: 'eric' },
    commandName,
    isChatInputCommand: () => true,
    options: {
      getString(name) {
        const value = options[name]
        return typeof value === 'string' ? value : null
      },
      getBoolean(name) {
        const value = options[name]
        return typeof value === 'boolean' ? value : null
      },
      getInteger(name) {
        const value = options[name]
        return Number.isInteger(value) ? value : null
      },
    },
  }
}
