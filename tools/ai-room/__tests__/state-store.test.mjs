import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createInitialState,
  readCurrentState,
  switchChatMode,
  switchFocus,
  switchMode,
  writeCurrentState,
} from '../state-store.mjs'
import { appendEvent, readEvents } from '../events.mjs'

let stateDir

beforeEach(async () => {
  stateDir = await mkdtemp(path.join(tmpdir(), 'ai-room-state-'))
})

afterEach(async () => {
  await rm(stateDir, { recursive: true, force: true })
})

describe('AI room state store', () => {
  it('creates a default TravelAPP state when no state file exists', async () => {
    const state = await readCurrentState({ stateDir })

    expect(state.focus).toBe('travel')
    expect(state.project).toBe('TravelAPP')
    expect(state.activeSession).toBe('rc-travel')
    expect(state.legacySession).toBe('dc-travel')
    expect(state.mode).toBe('autopilot_dev')
    expect(state.chatMode).toBe('balanced')
    expect(state.shipMode).toBe('manual')
    expect(state.sessionHealth).toBe('tmux_only')
    expect(state.blockers).toEqual([])
  })

  it('persists current state as pretty JSON', async () => {
    const state = createInitialState('travel', {
      currentGoal: 'review LINE agent MVP',
      sessionHealth: 'healthy',
    })

    await writeCurrentState(state, { stateDir })

    const raw = await readFile(path.join(stateDir, 'current-state.json'), 'utf8')
    expect(raw).toContain('\n  "focus": "travel"')
    expect(JSON.parse(raw).currentGoal).toBe('review LINE agent MVP')
  })

  it('switches focus to VibeSync and records project/session mapping', async () => {
    const state = await switchFocus('vibesync', {
      stateDir,
      actor: 'eric',
    })

    expect(state.focus).toBe('vibesync')
    expect(state.project).toBe('VibeSync')
    expect(state.activeSession).toBe('rc-vibesync')
    expect(state.legacySession).toBe('dc-vibesync')
    expect(state.nextAction).toBe('run /health before writing to the active session')
  })

  it('appends focus-switch events as NDJSON records', async () => {
    await appendEvent(
      {
        type: 'focus_switch',
        actor: 'eric',
        from: 'travel',
        to: 'vibesync',
      },
      { stateDir, now: () => '2026-06-05T13:30:00.000Z' }
    )

    const events = await readEvents({ stateDir })
    expect(events).toEqual([
      {
        ts: '2026-06-05T13:30:00.000Z',
        type: 'focus_switch',
        actor: 'eric',
        from: 'travel',
        to: 'vibesync',
      },
    ])
  })

  it('switches room mode and keeps commit/push manual outside autopilot ship', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })

    const dev = await switchMode('autopilot_dev', {
      stateDir,
      actor: 'eric',
      now: () => '2026-06-05T14:00:00.000Z',
    })

    expect(dev.mode).toBe('autopilot_dev')
    expect(dev.shipMode).toBe('manual')

    const ship = await switchMode('autopilot_ship', {
      stateDir,
      actor: 'eric',
      now: () => '2026-06-05T14:01:00.000Z',
    })

    expect(ship.mode).toBe('autopilot_ship')
    expect(ship.shipMode).toBe('autopilot_ship')

    const events = await readEvents({ stateDir })
    expect(events.at(-1)).toMatchObject({
      type: 'mode_switch',
      actor: 'eric',
      from: 'autopilot_dev',
      to: 'autopilot_ship',
    })
  })

  it('switches local chat mode without changing engineering autonomy mode', async () => {
    await writeCurrentState(createInitialState('travel'), { stateDir })

    const next = await switchChatMode('casual', {
      stateDir,
      actor: 'eric',
      now: () => '2026-06-06T04:20:00.000Z',
    })

    expect(next.chatMode).toBe('casual')
    expect(next.mode).toBe('autopilot_dev')
    expect(next.nextAction).toBe('untagged messages default to warm local chat/support')

    const events = await readEvents({ stateDir })
    expect(events.at(-1)).toMatchObject({
      type: 'chat_mode_switch',
      actor: 'eric',
      from: 'balanced',
      to: 'casual',
    })
  })
})
