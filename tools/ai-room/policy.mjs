import { PROJECTS, listProjectKeys } from './projects.mjs'

const NO_LOCK = 'none'

export function assessSessionAccess({ focus, session, operation }) {
  const located = locateSession(session)
  if (!located) {
    return deny(`Unknown tmux session "${session}". Private room cannot write to it.`)
  }

  const warning = located.sessionConfig.warning

  if (operation === 'read') {
    return {
      allowed: true,
      requiresLock: false,
      lockMode: NO_LOCK,
      reason: undefined,
      warning,
    }
  }

  const focusProject = PROJECTS[focus]
  if (!focusProject) {
    return deny(
      `Unknown AI room focus "${focus}". Expected one of: ${listProjectKeys().join(', ')}.`,
      warning
    )
  }

  if (located.projectKey !== focus) {
    return deny(
      `Session "${session}" does not match current focus "${focus}". Switch focus before writing.`,
      warning
    )
  }

  if (operation === 'rebind') {
    if (session !== focusProject.activeSession) {
      return deny(
        'Rebind is allowed only for the active rc session of the current focus.',
        warning
      )
    }
    return {
      allowed: true,
      requiresLock: true,
      lockMode: 'exclusive',
      reason: undefined,
      warning: 'rebind requires Eric confirmation before kill/new tmux actions',
    }
  }

  if (operation === 'write') {
    if (
      session === focusProject.activeSession &&
      located.sessionConfig.privateRoomAccess === 'write'
    ) {
      return {
        allowed: true,
        requiresLock: true,
        lockMode: 'write',
        reason: undefined,
        warning: undefined,
      }
    }

    return deny(
      'private room writes only to the active rc session for the current focus.',
      warning
    )
  }

  return deny(`Unknown operation "${operation}".`, warning)
}

function deny(reason, warning) {
  return {
    allowed: false,
    requiresLock: false,
    lockMode: NO_LOCK,
    reason,
    warning,
  }
}

function locateSession(session) {
  for (const key of listProjectKeys()) {
    const project = PROJECTS[key]
    const sessionConfig = project.sessions[session]
    if (sessionConfig) {
      return {
        projectKey: key,
        project,
        sessionConfig,
      }
    }
  }
  return null
}
