import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createLifecycle } from '../lifecycle.mjs'
import { createInitialState, readCurrentState, writeCurrentState } from '../state-store.mjs'

let stateDir

beforeEach(async () => {
  stateDir = await mkdtemp(path.join(tmpdir(), 'ai-room-lifecycle-'))
})

afterEach(async () => {
  await rm(stateDir, { recursive: true, force: true })
})

function fakeTmux() {
  const calls = []
  return {
    calls,
    adapter: {
      async sendKeys(session, text) {
        calls.push({ method: 'sendKeys', session, text })
      },
      async capturePane(session) {
        calls.push({ method: 'capturePane', session })
        return 'Goal: keep context lean\nChanged files: tools/ai-room\nNext action: continue'
      },
      async interrupt(session) {
        calls.push({ method: 'interrupt', session })
      },
    },
  }
}

describe('AI room lifecycle', () => {
  it('round sends /round only to the active rc session and updates state', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()
    const lifecycle = createLifecycle({
      tmux: adapter,
      stateDir,
      now: () => new Date('2026-06-05T13:45:07.000Z'),
    })

    const result = await lifecycle.round()

    expect(calls).toEqual([
      { method: 'sendKeys', session: 'rc-travel', text: '/round' },
      { method: 'capturePane', session: 'rc-travel' },
    ])
    expect(result.roundPath).toBe(
      'tmp/ai-room/rounds/2026-06-05-134507-travel.md'
    )
    const state = await readCurrentState({ stateDir })
    expect(state.lastRoundPath).toBe(result.roundPath)
    expect(state.lastActor).toBe('cc')
    expect(state.nextAction).toBe('review round output before continuing')
  })

  it('round dry-run returns an action plan without touching tmux', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()
    const lifecycle = createLifecycle({ tmux: adapter, stateDir })

    const result = await lifecycle.round({ dryRun: true })

    expect(result).toEqual({
      action: 'round',
      dryRun: true,
      session: 'rc-travel',
      prompt: '/round',
      lockMode: 'write',
      writesRoundFile: true,
    })
    expect(calls).toEqual([])
  })

  it('clear dry-run refuses when no recent round exists', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const lifecycle = createLifecycle({ tmux: fakeTmux().adapter, stateDir })

    const result = await lifecycle.clear({ dryRun: true })

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('recent /round is required before /clear')
  })

  it('clear dry-run is allowed after a round exists', async () => {
    await writeCurrentState(
      createInitialState('travel', {
        lastRoundPath: 'tmp/ai-room/rounds/2026-06-05-134507-travel.md',
      }),
      { stateDir }
    )
    const lifecycle = createLifecycle({ tmux: fakeTmux().adapter, stateDir })

    const result = await lifecycle.clear({ dryRun: true })

    expect(result).toEqual({
      action: 'clear',
      dryRun: true,
      allowed: true,
      session: 'rc-travel',
      prompt: '/clear',
      lockMode: 'write',
      reason: undefined,
    })
  })

  it('clear sends /clear after a round exists and marks context cleared', async () => {
    await writeCurrentState(
      createInitialState('travel', {
        lastRoundPath: 'tmp/ai-room/rounds/2026-06-05-134507-travel.md',
      }),
      { stateDir }
    )
    const { adapter, calls } = fakeTmux()
    const lifecycle = createLifecycle({
      tmux: adapter,
      stateDir,
      now: () => new Date('2026-06-05T16:45:09.000Z'),
    })

    const result = await lifecycle.clear()

    expect(result).toEqual({
      action: 'clear',
      dryRun: false,
      allowed: true,
      session: 'rc-travel',
      prompt: '/clear',
      lockMode: 'write',
      contextClearedAt: '2026-06-05T16:45:09.000Z',
    })
    expect(calls).toEqual([
      { method: 'sendKeys', session: 'rc-travel', text: '/clear' },
      { method: 'capturePane', session: 'rc-travel' },
    ])
    const state = await readCurrentState({ stateDir })
    expect(state.contextClearedAt).toBe('2026-06-05T16:45:09.000Z')
    expect(state.lastActor).toBe('cc')
    expect(state.nextAction).toBe('context cleared; send the next concise task')
  })

  it('interrupt requires explicit confirmation', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const lifecycle = createLifecycle({ tmux: fakeTmux().adapter, stateDir })

    const result = await lifecycle.interrupt()

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('requires Eric confirmation')
  })

  it('interrupt sends C-c only after confirmation and marks state interrupted', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()
    const lifecycle = createLifecycle({
      tmux: adapter,
      stateDir,
      now: () => new Date('2026-06-06T02:50:00.000Z'),
    })

    const result = await lifecycle.interrupt({ confirm: true })

    expect(result).toEqual({
      action: 'interrupt',
      allowed: true,
      session: 'rc-travel',
      prompt: 'C-c',
      lockMode: 'write',
      interruptedAt: '2026-06-06T02:50:00.000Z',
    })
    expect(calls).toEqual([
      { method: 'interrupt', session: 'rc-travel' },
      { method: 'capturePane', session: 'rc-travel' },
    ])
    const state = await readCurrentState({ stateDir })
    expect(state.interruptedAt).toBe('2026-06-06T02:50:00.000Z')
    expect(state.lastActor).toBe('cc')
    expect(state.nextAction).toBe('interrupted; inspect session or run /round before continuing')
  })

  it('rebind returns a confirmation plan before kill/new actions', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })
    const { adapter, calls } = fakeTmux()
    const lifecycle = createLifecycle({ tmux: adapter, stateDir })

    const result = await lifecycle.rebind()

    expect(result).toEqual({
      action: 'rebind',
      dryRun: true,
      allowed: false,
      session: 'rc-travel',
      lockMode: 'exclusive',
      requiresEricConfirmation: true,
      steps: [
        'acquire exclusive lock on rc-travel',
        'run /round if the session can still respond',
        'kill stale tmux session after confirmation',
        'create rc-travel in C:/Users/eric1/OneDrive/Desktop/TravelAPP',
        'start Claude Code',
        'wait for Eric to confirm desktop app bind/session URL',
      ],
    })
    expect(calls).toEqual([])
  })
})
