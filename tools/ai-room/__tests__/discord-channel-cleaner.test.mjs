import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clearDiscordChannelMessages } from '../discord-channel-cleaner.mjs'
import { readEvents } from '../events.mjs'

let stateDir

beforeEach(async () => {
  stateDir = await mkdtemp(path.join(tmpdir(), 'ai-room-chat-clear-'))
})

afterEach(async () => {
  await rm(stateDir, { recursive: true, force: true })
})

describe('Discord channel cleaner', () => {
  it('bulk deletes recent unpinned messages and records a chat_clear event', async () => {
    const now = new Date('2026-06-06T03:00:00.000Z')
    const channel = fakeChannel({
      messages: [
        message('m1', '2026-06-06T02:59:00.000Z'),
        message('m2', '2026-06-06T02:58:00.000Z', { pinned: true }),
        message('m3', '2026-06-06T02:57:00.000Z'),
      ],
    })

    const result = await clearDiscordChannelMessages({
      channel,
      actorId: 'eric',
      count: 3,
      stateDir,
      now: () => now,
    })

    expect(result).toEqual({
      action: 'chat-clear',
      channelId: 'private-ai-room',
      requested: 3,
      deleted: 2,
      skippedPinned: 1,
      skippedTooOld: 0,
      dryRun: false,
    })
    expect(channel.calls).toEqual([
      { method: 'fetch', options: { limit: 3 } },
      { method: 'bulkDelete', ids: ['m1', 'm3'], filterOld: true },
    ])
    expect(await readEvents({ stateDir })).toMatchObject([
      {
        type: 'chat_clear',
        actor: 'eric',
        channelId: 'private-ai-room',
        requested: 3,
        deleted: 2,
        skippedPinned: 1,
        skippedTooOld: 0,
      },
    ])
  })

  it('requires confirmation before clearing more than 100 recent messages', async () => {
    const channel = fakeChannel({
      messages: [message('m1', '2026-06-06T02:59:00.000Z')],
    })

    const result = await clearDiscordChannelMessages({
      channel,
      actorId: 'eric',
      count: 300,
      stateDir,
      now: () => new Date('2026-06-06T03:00:00.000Z'),
    })

    expect(result).toMatchObject({
      action: 'chat-clear',
      requested: 300,
      deleted: 0,
      dryRun: true,
      confirmationRequired: true,
    })
    expect(result.nextCommand).toBe('/chat-clear count:300 confirm:true')
    expect(channel.calls).toEqual([])
  })

  it('skips messages older than Discord bulk delete allows', async () => {
    const channel = fakeChannel({
      messages: [
        message('fresh', '2026-06-05T03:00:00.000Z'),
        message('old', '2026-05-01T03:00:00.000Z'),
      ],
    })

    const result = await clearDiscordChannelMessages({
      channel,
      actorId: 'eric',
      count: 2,
      stateDir,
      now: () => new Date('2026-06-06T03:00:00.000Z'),
    })

    expect(result.deleted).toBe(1)
    expect(result.skippedTooOld).toBe(1)
    expect(channel.calls).toEqual([
      { method: 'fetch', options: { limit: 2 } },
      { method: 'deleteMessage', id: 'fresh' },
    ])
  })
})

function fakeChannel({ messages }) {
  const calls = []
  const normalizedMessages = messages.map((item) => ({
    ...item,
    async delete() {
      calls.push({ method: 'deleteMessage', id: item.id })
    },
  }))
  return {
    id: 'private-ai-room',
    calls,
    messages: {
      async fetch(options) {
        calls.push({ method: 'fetch', options })
        return new Map(normalizedMessages.map((item) => [item.id, item]))
      },
    },
    async bulkDelete(messagesToDelete, filterOld) {
      calls.push({
        method: 'bulkDelete',
        ids: Array.from(messagesToDelete, (item) => item.id),
        filterOld,
      })
      return new Map(messagesToDelete.map((item) => [item.id, item]))
    },
  }
}

function message(id, createdAt, options = {}) {
  return {
    id,
    createdTimestamp: new Date(createdAt).getTime(),
    pinned: options.pinned === true,
    async delete() {
      options.calls?.push({ method: 'deleteMessage', id })
    },
  }
}
