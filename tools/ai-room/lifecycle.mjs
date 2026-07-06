import { acquireLock, releaseLock } from './locks.mjs'
import { assessSessionAccess } from './policy.mjs'
import { readCurrentState, writeCurrentState } from './state-store.mjs'
import { writeRoundFile } from './round-writer.mjs'

export function createLifecycle({ tmux, stateDir, now = () => new Date() }) {
  async function current() {
    return readCurrentState({ stateDir })
  }

  async function round(options = {}) {
    const state = await current()
    const access = assessSessionAccess({
      focus: state.focus,
      session: state.activeSession,
      operation: 'write',
    })
    if (!access.allowed) return denied('round', state, access)

    if (options.dryRun) {
      return {
        action: 'round',
        dryRun: true,
        session: state.activeSession,
        prompt: '/round',
        lockMode: access.lockMode,
        writesRoundFile: true,
      }
    }

    await acquireLock(lockInput(state, 'cc', 'round', access.lockMode), {
      stateDir,
      now,
    })
    try {
      await tmux.sendKeys(state.activeSession, '/round')
      const capturedText = await tmux.capturePane(state.activeSession)
      const roundFile = await writeRoundFile(
        {
          focus: state.focus,
          project: state.project,
          session: state.activeSession,
          capturedText,
        },
        { stateDir, now: isoNow(now) }
      )
      await writeCurrentState(
        {
          ...state,
          lastRoundPath: roundFile.relativePath,
          lastActor: 'cc',
          nextAction: 'review round output before continuing',
        },
        { stateDir }
      )
      return {
        action: 'round',
        dryRun: false,
        session: state.activeSession,
        roundPath: roundFile.relativePath,
      }
    } finally {
      await releaseLock(state.activeSession, { stateDir })
    }
  }

  async function clear(options = {}) {
    const state = await current()
    const access = assessSessionAccess({
      focus: state.focus,
      session: state.activeSession,
      operation: 'write',
    })
    if (!access.allowed) return denied('clear', state, access)

    if (!options.force && !state.lastRoundPath) {
      return {
        action: 'clear',
        dryRun: options.dryRun === true,
        allowed: false,
        session: state.activeSession,
        lockMode: access.lockMode,
        reason: 'recent /round is required before /clear',
      }
    }

    if (options.dryRun) {
      return {
        action: 'clear',
        dryRun: true,
        allowed: true,
        session: state.activeSession,
        prompt: '/clear',
        lockMode: access.lockMode,
        reason: undefined,
      }
    }

    await acquireLock(lockInput(state, 'cc', 'clear', access.lockMode), {
      stateDir,
      now,
    })
    try {
      await tmux.sendKeys(state.activeSession, '/clear')
      await tmux.capturePane(state.activeSession)
      const clearedAt = isoValue(now)
      await writeCurrentState(
        {
          ...state,
          contextClearedAt: clearedAt,
          lastActor: 'cc',
          nextAction: 'context cleared; send the next concise task',
        },
        { stateDir }
      )
      return {
        action: 'clear',
        dryRun: false,
        allowed: true,
        session: state.activeSession,
        prompt: '/clear',
        lockMode: access.lockMode,
        contextClearedAt: clearedAt,
      }
    } finally {
      await releaseLock(state.activeSession, { stateDir })
    }
  }

  async function interrupt(options = {}) {
    const state = await current()
    if (!options.confirm) {
      return {
        action: 'interrupt',
        allowed: false,
        session: state.activeSession,
        reason: 'interrupt requires Eric confirmation',
      }
    }

    const access = assessSessionAccess({
      focus: state.focus,
      session: state.activeSession,
      operation: 'write',
    })
    if (!access.allowed) return denied('interrupt', state, access)

    await acquireLock(lockInput(state, 'cc', 'interrupt', access.lockMode), {
      stateDir,
      now,
    })
    try {
      await tmux.interrupt(state.activeSession)
      await tmux.capturePane(state.activeSession)
      const interruptedAt = isoValue(now)
      await writeCurrentState(
        {
          ...state,
          interruptedAt,
          lastActor: 'cc',
          nextAction: 'interrupted; inspect session or run /round before continuing',
        },
        { stateDir }
      )
      return {
        action: 'interrupt',
        allowed: true,
        session: state.activeSession,
        prompt: 'C-c',
        lockMode: access.lockMode,
        interruptedAt,
      }
    } finally {
      await releaseLock(state.activeSession, { stateDir })
    }
  }

  async function rebind() {
    const state = await current()
    const access = assessSessionAccess({
      focus: state.focus,
      session: state.activeSession,
      operation: 'rebind',
    })
    return {
      action: 'rebind',
      dryRun: true,
      allowed: false,
      session: state.activeSession,
      lockMode: access.lockMode,
      requiresEricConfirmation: true,
      steps: [
        `acquire exclusive lock on ${state.activeSession}`,
        'run /round if the session can still respond',
        'kill stale tmux session after confirmation',
        `create ${state.activeSession} in ${state.workspace}`,
        'start Claude Code',
        'wait for Eric to confirm desktop app bind/session URL',
      ],
    }
  }

  return { round, clear, interrupt, rebind }
}

function denied(action, state, access) {
  return {
    action,
    allowed: false,
    session: state.activeSession,
    reason: access.reason,
    warning: access.warning,
  }
}

function lockInput(state, actor, task, mode) {
  return {
    session: state.activeSession,
    owner: 'private-room',
    actor,
    task,
    mode,
    ttlMs: 60_000,
  }
}

function isoNow(now) {
  return () => {
    return isoValue(now)
  }
}

function isoValue(now) {
  const value = now()
  return value instanceof Date ? value.toISOString() : String(value)
}
