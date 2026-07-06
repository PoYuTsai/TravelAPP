import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { dispatchCcRequest } from '../cc-dispatch.mjs'
import { createInitialState, writeCurrentState } from '../state-store.mjs'

let stateDir

beforeEach(async () => {
  stateDir = await mkdtemp(path.join(tmpdir(), 'ai-room-cc-dispatch-'))
})

afterEach(async () => {
  await rm(stateDir, { recursive: true, force: true })
})

describe('confirmed CC dispatch', () => {
  it('sends a confirmed request only to the active rc session and releases the lock', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux({
      sessions: ['rc-travel', 'dc-travel'],
      cwdBySession: {
        'rc-travel': '/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP',
      },
    })

    const result = await dispatchCcRequest(
      {
        actor: 'eric',
        body: 'implement the current plan',
      },
      {
        stateDir,
        tmux: adapter,
        now: () => new Date('2026-06-05T15:00:00.000Z'),
      }
    )

    expect(result.allowed).toBe(true)
    expect(result.session).toBe('rc-travel')
    expect(result.prompt).toContain('AI Room request from eric')
    expect(result.prompt).toContain('implement the current plan')
    expect(calls).toEqual([
      { method: 'listSessions' },
      { method: 'getCurrentPath', session: 'rc-travel' },
      { method: 'getCurrentPath', session: 'dc-travel' },
      {
        method: 'sendKeys',
        session: 'rc-travel',
        text: result.prompt,
      },
    ])
  })

  it('blocks dispatch when the active rc session is missing', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux({ sessions: ['dc-travel'] })

    const result = await dispatchCcRequest(
      {
        actor: 'eric',
        body: 'implement the current plan',
      },
      {
        stateDir,
        tmux: adapter,
      }
    )

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('active session rc-travel is missing')
    expect(calls).toEqual([
      { method: 'listSessions' },
      { method: 'getCurrentPath', session: 'dc-travel' },
    ])
  })
})

function fakeTmux({ sessions = [], cwdBySession = {} } = {}) {
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
    },
  }
}
