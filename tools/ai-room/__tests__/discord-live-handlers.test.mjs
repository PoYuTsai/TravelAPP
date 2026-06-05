import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  handleDiscordInteraction,
  handleDiscordMessage,
  registerSlashCommands,
} from '../discord-live-handlers.mjs'
import { AI_ROOM_SLASH_COMMANDS } from '../discord-commands.mjs'
import { createInitialState, writeCurrentState } from '../state-store.mjs'

let stateDir

beforeEach(async () => {
  stateDir = await mkdtemp(path.join(tmpdir(), 'ai-room-live-handlers-'))
})

afterEach(async () => {
  await rm(stateDir, { recursive: true, force: true })
})

describe('Discord live handlers', () => {
  it('handles messageCreate events through the executor', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const replies = []

    const result = await handleDiscordMessage(
      {
        channelId: 'private-ai-room',
        author: { id: 'eric', bot: false },
        content: '可以陪我整理一下現在焦點嗎',
        reply: async (content) => replies.push(content),
      },
      {
        privateChannelId: 'private-ai-room',
        stateDir,
      }
    )

    expect(result.shouldReply).toBe(true)
    expect(replies[0]).toContain('[Codex]')
    expect(replies[0]).toContain('[CC]')
  })

  it('delivers messageCreate agent voices through webhooks when configured', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const replies = []
    const posts = []

    const result = await handleDiscordMessage(
      {
        channelId: 'private-ai-room',
        author: { id: 'eric', bot: false },
        content: '可以兩個都陪我看一下嗎',
        reply: async (content) => replies.push(content),
      },
      {
        privateChannelId: 'private-ai-room',
        stateDir,
        fetch: async (url, init) => {
          posts.push({ url, body: JSON.parse(init.body) })
          return { ok: true, status: 204 }
        },
        webhooks: {
          room: 'https://discord.example/room',
          codex: 'https://discord.example/codex',
          cc: 'https://discord.example/cc',
        },
        identities: {
          codex: { username: 'Codex', avatarUrl: 'https://official.example/openai.png' },
          cc: { username: 'Claude Code', avatarUrl: 'https://official.example/claude.png' },
          room: { username: 'AI Room' },
        },
      }
    )

    expect(result.delivery.deliveredVia).toBe('webhook')
    expect(replies).toEqual([])
    expect(posts.map((post) => post.url)).toEqual([
      'https://discord.example/room',
      'https://discord.example/codex',
      'https://discord.example/cc',
    ])
  })

  it('handles slash command interactions through the same executor', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const replies = []

    const result = await handleDiscordInteraction(
      fakeInteraction({
        commandName: 'mode',
        options: {
          mode: 'autopilot_dev',
        },
        reply: async (payload) => replies.push(payload),
      }),
      {
        privateChannelId: 'private-ai-room',
        stateDir,
      }
    )

    expect(result.shouldReply).toBe(true)
    expect(replies[0]).toEqual({
      content: expect.stringContaining('[Room/mode] autopilot_dev'),
      ephemeral: false,
    })
  })

  it('replies ephemerally when the executor returns an ephemeral result', async () => {
    const interaction = fakeInteraction({
      commandName: 'chat-clear',
      options: {
        count: 1,
      },
      channel: fakeDiscordChannel({
        messages: [discordMessage('m1', '2026-06-06T02:59:00.000Z')],
      }),
    })

    await handleDiscordInteraction(interaction, {
      privateChannelId: 'private-ai-room',
      stateDir,
      now: () => new Date('2026-06-06T03:00:00.000Z'),
    })

    expect(interaction.replies.at(-1)).toMatchObject({
      ephemeral: true,
    })
  })

  it('registers slash commands for the configured guild only', async () => {
    const calls = []
    const result = await registerSlashCommands(
      {
        application: {
          commands: {
            async set(commands, guildId) {
              calls.push({ commands, guildId })
            },
          },
        },
      },
      { guildId: 'guild-1' }
    )

    expect(result).toEqual({
      registered: true,
      guildId: 'guild-1',
      commandCount: AI_ROOM_SLASH_COMMANDS.length,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].commands.map((command) => command.name)).toContain('sessions')
  })
})

function fakeInteraction({ commandName = 'sessions', options = {}, reply, channel } = {}) {
  const replies = []
  return {
    channelId: 'private-ai-room',
    channel,
    replies,
    user: { id: 'eric' },
    commandName,
    isChatInputCommand: () => true,
    reply: reply ?? (async (payload) => replies.push(payload)),
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

function fakeDiscordChannel({ messages }) {
  const normalizedMessages = messages.map((item) => ({
    ...item,
    async delete() {},
  }))
  return {
    id: 'private-ai-room',
    messages: {
      async fetch(options) {
        return new Map(
          normalizedMessages.slice(0, options.limit).map((item) => [item.id, item])
        )
      },
    },
    async bulkDelete(messagesToDelete) {
      return new Map(messagesToDelete.map((item) => [item.id, item]))
    },
  }
}

function discordMessage(id, createdAt) {
  return {
    id,
    createdTimestamp: new Date(createdAt).getTime(),
    pinned: false,
  }
}
