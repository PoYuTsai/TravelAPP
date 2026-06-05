import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { executeDiscordDecision } from '../discord-executor.mjs'
import { routeDiscordMessage } from '../discord-router.mjs'
import {
  createInitialState,
  readCurrentState,
  writeCurrentState,
} from '../state-store.mjs'

const ENV = {
  privateChannelId: 'private-ai-room',
}

let stateDir

beforeEach(async () => {
  stateDir = await mkdtemp(path.join(tmpdir(), 'ai-room-discord-executor-'))
})

afterEach(async () => {
  await rm(stateDir, { recursive: true, force: true })
})

describe('Discord executor', () => {
  it('executes /sessions as a read-only inventory reply', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux({
      sessions: ['rc-travel', 'dc-travel', 'dc-vibesync'],
    })

    const result = await executeDiscordDecision(decision('/sessions'), {
      stateDir,
      tmux: adapter,
    })

    expect(result.shouldReply).toBe(true)
    expect(result.content).toContain('[Room/focus] travel')
    expect(result.content).toContain('OK rc-travel | TravelAPP | active | write')
    expect(result.content).toContain('warning:')
    expect(calls).toEqual([{ method: 'listSessions' }])
  })

  it('executes /health and stores the latest health summary', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter } = fakeTmux({
      sessions: ['rc-travel', 'dc-travel'],
      cwdBySession: {
        'rc-travel': '/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP',
        'dc-travel': '/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP',
      },
    })

    const result = await executeDiscordDecision(decision('/health'), {
      stateDir,
      tmux: adapter,
    })

    expect(result.content).toContain('[Room/health] tmux_only')
    expect(result.content).toContain('rc-travel present for TravelAPP')
    expect(result.content).toContain('desktop Claude Code bind is not confirmed')
    const state = await readCurrentState({ stateDir })
    expect(state.sessionHealth).toBe('tmux_only')
    expect(state.nextAction).toContain('confirm desktop Claude Code bind')
  })

  it('answers ordinary private-room chatter as a two-agent roundtable with no tmux write', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()

    const result = await executeDiscordDecision(
      decision('我想做一個開放性的規格討論，你們怎麼看？'),
      { stateDir, tmux: adapter }
    )

    expect(result.content).toContain('[Room/roundtable]')
    expect(result.content).toContain('[Codex]')
    expect(result.content).toContain('[CC]')
    expect(result.content).toContain('焦點: travel')
    expect(result.content).toContain('不會寫入 tmux')
    expect(result.content).toContain('你的問題: 我想做一個開放性的規格討論，你們怎麼看？')
    expect(result.content).toContain('Codex 視角')
    expect(result.content).toContain('Claude Code 視角')
    expect(result.content).toContain('兩種觀點')
    expect(calls).toEqual([])
  })

  it('answers short casual greetings warmly without starting a roundtable', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()

    const result = await executeDiscordDecision(decision('各位晚安'), {
      stateDir,
      tmux: adapter,
    })

    expect(result.content).not.toContain('[Room/roundtable]')
    expect(result.content).toContain('[Codex]')
    expect(result.content).toContain('[CC]')
    expect(result.content).toContain('晚安')
    expect(result.content).toContain('今天辛苦了')
    expect(result.content).not.toContain('規格')
    expect(result.content).not.toContain('tmux')
    expect(calls).toEqual([])
  })

  it('treats evening greetings as casual chat instead of a roundtable', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()

    const result = await executeDiscordDecision(decision('各位晚上好'), {
      stateDir,
      tmux: adapter,
    })

    expect(result.content).not.toContain('[Room/roundtable]')
    expect(result.content).toContain('[Codex]')
    expect(result.content).toContain('[CC]')
    expect(result.content).toContain('晚上好')
    expect(result.content).toContain('今天辛苦了')
    expect(result.content).not.toContain('規格')
    expect(result.content).not.toContain('tmux')
    expect(calls).toEqual([])
  })

  it('answers emotional small talk with warmth instead of engineering analysis', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()

    const result = await executeDiscordDecision(
      decision('今天有點累，想跟你們閒聊一下'),
      { stateDir, tmux: adapter }
    )

    expect(result.content).not.toContain('[Room/roundtable]')
    expect(result.content).toContain('[Codex]')
    expect(result.content).toContain('[CC]')
    expect(result.content).toContain('我在')
    expect(result.content).toContain('先不用急著產出')
    expect(result.content).toContain('今天辛苦了')
    expect(result.content).not.toContain('規格')
    expect(result.content).not.toContain('tmux')
    expect(calls).toEqual([])
  })

  it('uses casual chat mode for untagged event sharing without starting work analysis', async () => {
    await writeCurrentState(createInitialState('travel', { chatMode: 'casual' }), {
      stateDir,
    })
    const { adapter, calls } = fakeTmux()

    const result = await executeDiscordDecision(
      decision('今天帶小孩出去玩，有點累但滿開心的'),
      { stateDir, tmux: adapter }
    )

    expect(result.content).not.toContain('[Room/roundtable]')
    expect(result.content).toContain('[Codex]')
    expect(result.content).toContain('[CC]')
    expect(result.content).toContain('聽起來')
    expect(result.content).toContain('不用轉成任務')
    expect(result.content).not.toContain('tmux')
    expect(calls).toEqual([])
  })

  it('switches chat mode from Discord', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })

    const result = await executeDiscordDecision(decision('/chat-mode casual'), {
      stateDir,
    })

    expect(result.content).toContain('[Room/chat-mode] casual')
    expect(result.content).toContain('寒暄、閒聊、心情、事件分享')
    expect((await readCurrentState({ stateDir })).chatMode).toBe('casual')
  })

  it('answers two-agent open questions as role perspectives without queuing work', async () => {
    await writeCurrentState(createInitialState('travel', { chatMode: 'casual' }), {
      stateDir,
    })
    const { adapter, calls } = fakeTmux()
    const routed = routeDiscordMessage(
      {
        channelId: 'private-ai-room',
        authorId: 'eric',
        content: '@cc 跟@codex 你們有什麼優缺點？如何分工',
      },
      ENV
    )

    const result = await executeDiscordDecision(routed, {
      stateDir,
      tmux: adapter,
    })

    expect(result.content).toContain('[Codex]')
    expect(result.content).toContain('[CC]')
    expect(result.content).toContain('優勢')
    expect(result.content).toContain('分工')
    expect(result.content).not.toContain('[Room/dev-loop]')
    expect(result.content).not.toContain('tmux')
    expect(calls).toEqual([])
  })

  it('answers @codex role questions in Traditional Chinese without tmux writes', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()

    const result = await executeDiscordDecision(
      decision('@codex 你現在負責什麼？'),
      { stateDir, tmux: adapter }
    )

    expect(result.content).toContain('[Codex/plan]')
    expect(result.content).toContain('焦點: travel -> rc-travel')
    expect(result.content).toContain('我負責幫你收斂目標')
    expect(result.content).toContain('不會寫入 tmux')
    expect(calls).toEqual([])
  })

  it('answers @cc status in Traditional Chinese without tmux writes', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()

    const result = await executeDiscordDecision(decision('@cc status'), {
      stateDir,
      tmux: adapter,
    })

    expect(result.content).toContain('[CC/status]')
    expect(result.content).toContain('焦點: travel -> rc-travel')
    expect(result.content).toContain('我目前待命')
    expect(result.content).toContain('不會寫入 tmux')
    expect(calls).toEqual([])
  })

  it('turns @cc work into a bounded dry-run dev loop instead of writing immediately', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()

    const result = await executeDiscordDecision(
      decision('@cc implement the plan, then ask @codex to review'),
      { stateDir, tmux: adapter }
    )

    expect(result.content).toContain('[Room/dev-loop] queued')
    expect(result.content).toContain('cc: implement -> rc-travel')
    expect(result.content).toContain('codex: review')
    expect(result.content).toContain('tmux write pending Eric confirmation')
    expect(calls).toEqual([])
  })

  it('dispatches @cc to the active rc session only when --confirm is present', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux({
      sessions: ['rc-travel', 'dc-travel'],
      cwdBySession: {
        'rc-travel': '/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP',
        'dc-travel': '/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP',
      },
    })

    const result = await executeDiscordDecision(
      decision('@cc implement the plan --confirm'),
      { stateDir, tmux: adapter }
    )

    expect(result.content).toContain('[CC/rc-travel] dispatch')
    expect(result.content).toContain('status: sent')
    expect(result.content).toContain('desktop Claude Code bind is not confirmed')
    expect(calls.at(-1)).toMatchObject({
      method: 'sendKeys',
      session: 'rc-travel',
    })
    expect(calls.at(-1).text).toContain('implement the plan')
    expect(calls.at(-1).text).not.toContain('--confirm')
  })

  it('keeps /round as a dry-run action plan from Discord', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()

    const result = await executeDiscordDecision(decision('/round'), {
      stateDir,
      tmux: adapter,
    })

    expect(result.content).toContain('[CC/rc-travel] round')
    expect(result.content).toContain('dry-run')
    expect(result.content).toContain('prompt: /round')
    expect(calls).toEqual([])
  })

  it('runs /round against the active rc session when confirm is present', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()

    const result = await executeDiscordDecision(decision('/round confirm'), {
      stateDir,
      tmux: adapter,
      now: () => new Date('2026-06-05T16:10:07.000Z'),
    })

    expect(result.content).toContain('[CC/rc-travel] round')
    expect(result.content).not.toContain('dry-run')
    expect(result.content).toContain(
      'round: tmp/ai-room/rounds/2026-06-05-161007-travel.md'
    )
    expect(calls).toEqual([
      { method: 'sendKeys', session: 'rc-travel', text: '/round' },
      { method: 'capturePane', session: 'rc-travel' },
    ])
    const state = await readCurrentState({ stateDir })
    expect(state.lastRoundPath).toBe(
      'tmp/ai-room/rounds/2026-06-05-161007-travel.md'
    )
  })

  it('runs /clear against the active rc session only when confirm and recent round exist', async () => {
    await writeCurrentState(
      createInitialState('travel', {
        lastRoundPath: 'tmp/ai-room/rounds/2026-06-05-161007-travel.md',
      }),
      { stateDir }
    )
    const { adapter, calls } = fakeTmux()

    const result = await executeDiscordDecision(decision('/clear confirm'), {
      stateDir,
      tmux: adapter,
      now: () => new Date('2026-06-05T16:50:00.000Z'),
    })

    expect(result.content).toContain('[CC/rc-travel] clear')
    expect(result.content).not.toContain('dry-run')
    expect(result.content).toContain('clearedAt: 2026-06-05T16:50:00.000Z')
    expect(calls).toEqual([
      { method: 'sendKeys', session: 'rc-travel', text: '/clear' },
      { method: 'capturePane', session: 'rc-travel' },
    ])
    const state = await readCurrentState({ stateDir })
    expect(state.contextClearedAt).toBe('2026-06-05T16:50:00.000Z')
  })

  it('executes /chat-clear against the Discord channel without touching tmux', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()
    const channel = fakeDiscordChannel({
      messages: [
        discordMessage('m1', '2026-06-06T02:59:00.000Z'),
        discordMessage('m2', '2026-06-06T02:58:00.000Z'),
      ],
    })

    const result = await executeDiscordDecision(decision('/chat-clear count:2'), {
      stateDir,
      tmux: adapter,
      discordChannel: channel,
      now: () => new Date('2026-06-06T03:00:00.000Z'),
    })

    expect(result.shouldReply).toBe(true)
    expect(result.ephemeral).toBe(true)
    expect(result.content).toContain('[Room/chat-clear]')
    expect(result.content).toContain('deleted: 2')
    expect(channel.calls).toEqual([
      { method: 'fetch', options: { limit: 2 } },
      { method: 'bulkDelete', ids: ['m1', 'm2'], filterOld: true },
    ])
    expect(calls).toEqual([])
  })

  it('keeps /chat-clear errors ephemeral', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })

    const result = await executeDiscordDecision(decision('/chat-clear count:1'), {
      stateDir,
      discordChannel: {
        id: 'private-ai-room',
        messages: {
          async fetch() {
            throw new Error('Missing Permissions')
          },
        },
      },
    })

    expect(result.ephemeral).toBe(true)
    expect(result.content).toContain('[Room/error] 缺少 Discord「管理訊息」權限')
    expect(result.content).toContain('頻道設定')
  })

  it('runs /interrupt against the active rc session only when confirm is present', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()

    const result = await executeDiscordDecision(decision('/interrupt confirm'), {
      stateDir,
      tmux: adapter,
      now: () => new Date('2026-06-06T02:55:00.000Z'),
    })

    expect(result.content).toContain('[CC/rc-travel] interrupt')
    expect(result.content).toContain('interruptedAt: 2026-06-06T02:55:00.000Z')
    expect(calls).toEqual([
      { method: 'interrupt', session: 'rc-travel' },
      { method: 'capturePane', session: 'rc-travel' },
    ])
    const state = await readCurrentState({ stateDir })
    expect(state.interruptedAt).toBe('2026-06-06T02:55:00.000Z')
  })

  it('requires confirmation before switching the shared focus', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })

    const preview = await executeDiscordDecision(decision('/focus vibesync'), {
      stateDir,
    })

    expect(preview.content).toContain('[Room/focus] confirmation required')
    expect(preview.content).toContain('/focus vibesync confirm')
    expect((await readCurrentState({ stateDir })).focus).toBe('travel')

    const switched = await executeDiscordDecision(
      decision('/focus vibesync confirm'),
      { stateDir }
    )

    expect(switched.content).toContain('[Room/focus] switched to vibesync')
    expect(switched.content).toContain('active: rc-vibesync')
    expect((await readCurrentState({ stateDir })).focus).toBe('vibesync')
  })

  it('requires confirmation before enabling autopilot ship mode', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })

    const preview = await executeDiscordDecision(decision('/mode autopilot_ship'), {
      stateDir,
    })

    expect(preview.content).toContain('[Room/mode] confirmation required')
    expect(preview.content).toContain('/mode autopilot_ship confirm')
    expect((await readCurrentState({ stateDir })).shipMode).toBe('manual')

    const switched = await executeDiscordDecision(
      decision('/mode autopilot_ship confirm'),
      { stateDir }
    )

    expect(switched.content).toContain('[Room/mode] autopilot_ship')
    expect(switched.content).toContain('shipMode: autopilot_ship')
    expect((await readCurrentState({ stateDir })).shipMode).toBe('autopilot_ship')
  })
})

function decision(content, channelId = 'private-ai-room') {
  return routeDiscordMessage(
    {
      channelId,
      authorId: 'eric',
      content,
    },
    ENV
  )
}

function fakeDiscordChannel({ messages }) {
  const calls = []
  return {
    id: 'private-ai-room',
    calls,
    messages: {
      async fetch(options) {
        calls.push({ method: 'fetch', options })
        return new Map(messages.map((item) => [item.id, item]))
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

function discordMessage(id, createdAt) {
  return {
    id,
    createdTimestamp: new Date(createdAt).getTime(),
    pinned: false,
  }
}

function fakeTmux({ sessions = ['rc-travel'], cwdBySession = {} } = {}) {
  const calls = []
  return {
    calls,
    adapter: {
      async listSessions() {
        calls.push({ method: 'listSessions' })
        return sessions
      },
      async getCurrentPath(session) {
        calls.push({ method: 'getCurrentPath', session })
        return cwdBySession[session] ?? ''
      },
      async sendKeys(session, text) {
        calls.push({ method: 'sendKeys', session, text })
      },
      async capturePane(session) {
        calls.push({ method: 'capturePane', session })
        return 'captured output'
      },
      async interrupt(session) {
        calls.push({ method: 'interrupt', session })
      },
    },
  }
}
