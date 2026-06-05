import { acquireLock, releaseLock } from './locks.mjs'
import { assessSessionAccess } from './policy.mjs'
import { buildHealthReport } from './health.mjs'
import { readCurrentState, writeCurrentState } from './state-store.mjs'
import { createTmuxAdapter } from './tmux-adapter.mjs'

export async function dispatchCcRequest(input, options = {}) {
  const state = await readCurrentState({ stateDir: options.stateDir })
  const tmux = options.tmux ?? createTmuxAdapter({ mode: options.tmuxMode })
  const access = assessSessionAccess({
    focus: state.focus,
    session: state.activeSession,
    operation: 'write',
  })

  if (!access.allowed) {
    return denied(state, access.reason, access.warning)
  }

  const liveSessions = await tmux.listSessions()
  const cwdBySession = await readKnownCwds(tmux, liveSessions)
  const health = buildHealthReport({
    focus: state.focus,
    liveSessions,
    cwdBySession,
    desktopBindConfirmed: state.desktopBindConfirmed === true,
  })

  if (health.blockers.length > 0) {
    return denied(state, health.blockers.join('; '), health.warnings.join('; '))
  }

  const prompt = buildCcPrompt({
    actor: input.actor,
    body: input.body,
    state,
    warnings: health.warnings,
  })
  const now = options.now ?? (() => new Date())

  await acquireLock(
    {
      session: state.activeSession,
      owner: 'private-room',
      actor: 'cc',
      task: 'discord-dispatch',
      mode: access.lockMode,
      ttlMs: 60_000,
    },
    { stateDir: options.stateDir, now }
  )

  try {
    await tmux.sendKeys(state.activeSession, prompt)
    await writeCurrentState(
      {
        ...state,
        lastActor: 'cc',
        nextAction: 'wait for Claude Code to report, then run /round or ask @codex to review',
      },
      { stateDir: options.stateDir }
    )
  } finally {
    await releaseLock(state.activeSession, { stateDir: options.stateDir })
  }

  return {
    action: 'dispatch',
    allowed: true,
    session: state.activeSession,
    prompt,
    lockMode: access.lockMode,
    warnings: health.warnings,
  }
}

export function buildCcPrompt({ actor, body, state, warnings = [] }) {
  return [
    `AI Room request from ${actor ?? 'eric'}`,
    `Focus: ${state.focus} (${state.project})`,
    `Active session: ${state.activeSession}`,
    'Rules: stay in the active focus; do not commit, push, deploy, edit secrets, write dc-* sessions, or send external messages unless Eric explicitly authorizes it.',
    warnings.length ? `Warnings: ${warnings.join(' | ')}` : 'Warnings: none',
    '',
    'Task:',
    String(body ?? '').trim(),
  ].join('\n')
}

function denied(state, reason, warning) {
  return {
    action: 'dispatch',
    allowed: false,
    session: state.activeSession,
    reason,
    warning,
  }
}

async function readKnownCwds(tmux, liveSessions) {
  const cwdBySession = {}
  for (const session of liveSessions) {
    try {
      cwdBySession[session] = await tmux.getCurrentPath(session)
    } catch {
      // Health report explains missing cwd and unknown session state.
    }
  }
  return cwdBySession
}
