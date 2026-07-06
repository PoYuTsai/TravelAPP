import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildDoctorReport, formatDoctorReport } from '../doctor.mjs'
import { createInitialState, writeCurrentState } from '../state-store.mjs'

let stateDir
let cwd

beforeEach(async () => {
  stateDir = await mkdtemp(path.join(tmpdir(), 'ai-room-doctor-state-'))
  cwd = await mkdtemp(path.join(tmpdir(), 'ai-room-doctor-cwd-'))
})

afterEach(async () => {
  await rm(stateDir, { recursive: true, force: true })
  await rm(cwd, { recursive: true, force: true })
})

describe('AI room doctor', () => {
  it('reports missing Discord env without leaking configured secrets', async () => {
    await writeFile(
      path.join(cwd, '.env.local'),
      'AI_ROOM_DISCORD_TOKEN=secret-token\n',
      'utf8'
    )

    const report = await buildDoctorReport({
      cwd,
      stateDir,
      env: {},
      tmux: fakeTmux({ sessions: [] }),
    })
    const text = formatDoctorReport(report)

    expect(report.ready).toBe(false)
    expect(report.missingEnv).toEqual([
      'AI_ROOM_PRIVATE_CHANNEL_ID',
      'AI_ROOM_DISCORD_GUILD_ID',
    ])
    expect(text).toContain('missing env: AI_ROOM_PRIVATE_CHANNEL_ID, AI_ROOM_DISCORD_GUILD_ID')
    expect(text).not.toContain('secret-token')
  })

  it('reports ready when env and active rc health are present', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })

    const report = await buildDoctorReport({
      cwd,
      stateDir,
      env: {
        AI_ROOM_DISCORD_TOKEN: 'token',
        AI_ROOM_PRIVATE_CHANNEL_ID: 'private-ai-room',
        AI_ROOM_DISCORD_GUILD_ID: 'guild-1',
      },
      tmux: fakeTmux({
        sessions: ['rc-travel', 'dc-travel'],
        cwdBySession: {
          'rc-travel': '/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP',
          'dc-travel': '/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP',
        },
      }),
    })

    expect(report.ready).toBe(true)
    expect(formatDoctorReport(report)).toContain('[Room/doctor] ready')
  })

  it('warns only for missing webhook identities and accepts webhook-configured avatars', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })

    const report = await buildDoctorReport({
      cwd,
      stateDir,
      env: {
        AI_ROOM_DISCORD_TOKEN: 'token',
        AI_ROOM_PRIVATE_CHANNEL_ID: 'private-ai-room',
        AI_ROOM_DISCORD_GUILD_ID: 'guild-1',
        AI_ROOM_CODEX_WEBHOOK_URL: 'https://discord.example/codex',
      },
      tmux: fakeTmux({
        sessions: ['rc-travel'],
        cwdBySession: {
          'rc-travel': '/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP',
        },
      }),
    })
    const text = formatDoctorReport(report)

    expect(report.ready).toBe(true)
    expect(report.identityWarnings).toEqual([
      'AI_ROOM_CC_WEBHOOK_URL is missing; @cc will use the fallback bot reply.',
    ])
    expect(text).toContain('identity warning: AI_ROOM_CC_WEBHOOK_URL is missing')
  })

  it('does not require avatar URL env values when all webhooks are configured', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })

    const report = await buildDoctorReport({
      cwd,
      stateDir,
      env: {
        AI_ROOM_DISCORD_TOKEN: 'token',
        AI_ROOM_PRIVATE_CHANNEL_ID: 'private-ai-room',
        AI_ROOM_DISCORD_GUILD_ID: 'guild-1',
        AI_ROOM_CODEX_WEBHOOK_URL: 'https://discord.example/codex',
        AI_ROOM_CC_WEBHOOK_URL: 'https://discord.example/cc',
        AI_ROOM_ROOM_WEBHOOK_URL: 'https://discord.example/room',
      },
      tmux: fakeTmux({
        sessions: ['rc-travel'],
        cwdBySession: {
          'rc-travel': '/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP',
        },
      }),
    })

    expect(report.ready).toBe(true)
    expect(report.identityWarnings).toEqual([])
  })
})

function fakeTmux({ sessions = [], cwdBySession = {} } = {}) {
  return {
    async listSessions() {
      return sessions
    },
    async getCurrentPath(session) {
      return cwdBySession[session] ?? ''
    },
  }
}
