import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { appendEvent, DEFAULT_STATE_DIR } from './events.mjs'
import { getProjectConfig } from './projects.mjs'

const CURRENT_STATE_FILE = 'current-state.json'
export const ROOM_MODES = Object.freeze([
  'supervised',
  'autopilot_dev',
  'autopilot_ship',
])
export const CHAT_MODES = Object.freeze(['balanced', 'casual', 'work'])

function statePath(stateDir) {
  return path.join(stateDir, CURRENT_STATE_FILE)
}

export function createInitialState(focus = 'travel', overrides = {}) {
  const project = getProjectConfig(focus)
  return {
    focus,
    project: project.project,
    workspace: project.workspace,
    activeSession: project.activeSession,
    legacySession: project.legacySession,
    mode: 'autopilot_dev',
    chatMode: 'balanced',
    shipMode: 'manual',
    sessionHealth: 'tmux_only',
    currentGoal: '',
    lastRoundPath: null,
    lastActor: null,
    nextAction: 'run /health before writing to the active session',
    blockers: [],
    ...overrides,
  }
}

export async function readCurrentState(options = {}) {
  const stateDir = options.stateDir ?? DEFAULT_STATE_DIR
  let raw
  try {
    raw = await readFile(statePath(stateDir), 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return createInitialState('travel')
    }
    throw error
  }

  const parsed = JSON.parse(raw)
  return createInitialState(parsed.focus ?? 'travel', parsed)
}

export async function writeCurrentState(state, options = {}) {
  const stateDir = options.stateDir ?? DEFAULT_STATE_DIR
  await mkdir(stateDir, { recursive: true })
  await writeFile(
    statePath(stateDir),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8'
  )
  return state
}

export async function switchFocus(focus, options = {}) {
  const stateDir = options.stateDir ?? DEFAULT_STATE_DIR
  const previous = await readCurrentState({ stateDir })
  const next = createInitialState(focus, {
    chatMode: previous.chatMode ?? 'balanced',
  })

  await writeCurrentState(next, { stateDir })

  if (options.actor) {
    await appendEvent(
      {
        type: 'focus_switch',
        actor: options.actor,
        from: previous.focus,
        to: focus,
      },
      { stateDir, now: options.now }
    )
  }

  return next
}

export async function switchChatMode(chatMode, options = {}) {
  assertChatMode(chatMode)

  const stateDir = options.stateDir ?? DEFAULT_STATE_DIR
  const previous = await readCurrentState({ stateDir })
  const next = {
    ...previous,
    chatMode,
    nextAction: nextActionForChatMode(chatMode),
  }

  await writeCurrentState(next, { stateDir })

  if (options.actor) {
    await appendEvent(
      {
        type: 'chat_mode_switch',
        actor: options.actor,
        from: previous.chatMode ?? 'balanced',
        to: chatMode,
      },
      { stateDir, now: options.now }
    )
  }

  return next
}

export async function switchMode(mode, options = {}) {
  assertRoomMode(mode)

  const stateDir = options.stateDir ?? DEFAULT_STATE_DIR
  const previous = await readCurrentState({ stateDir })
  const next = {
    ...previous,
    mode,
    shipMode: mode === 'autopilot_ship' ? 'autopilot_ship' : 'manual',
    nextAction: nextActionForMode(mode),
  }

  await writeCurrentState(next, { stateDir })

  if (options.actor) {
    await appendEvent(
      {
        type: 'mode_switch',
        actor: options.actor,
        from: previous.mode,
        to: mode,
      },
      { stateDir, now: options.now }
    )
  }

  return next
}

function assertRoomMode(mode) {
  if (!ROOM_MODES.includes(mode)) {
    throw new Error(
      `Unknown AI room mode "${mode}". Expected one of: ${ROOM_MODES.join(', ')}.`
    )
  }
}

function assertChatMode(chatMode) {
  if (!CHAT_MODES.includes(chatMode)) {
    throw new Error(
      `Unknown AI room chat mode "${chatMode}". Expected one of: ${CHAT_MODES.join(', ')}.`
    )
  }
}

function nextActionForMode(mode) {
  if (mode === 'autopilot_ship') {
    return 'review and verification may proceed to commit/push only within the active focus'
  }
  if (mode === 'supervised') {
    return 'ask Eric before large autonomous steps'
  }
  return 'ready for private-room rc-only development'
}

function nextActionForChatMode(chatMode) {
  if (chatMode === 'casual') {
    return 'untagged messages default to warm local chat/support'
  }
  if (chatMode === 'work') {
    return 'untagged messages default to work roundtable'
  }
  return 'untagged messages auto-route between chat/support and work roundtable'
}
