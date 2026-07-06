import { PROJECTS, listProjectKeys } from './projects.mjs'

export function buildSessionInventory({ focus, liveSessions }) {
  const live = new Set(liveSessions)
  const knownSessions = new Set()
  const inventory = []

  for (const key of listProjectKeys()) {
    const project = PROJECTS[key]
    for (const sessionName of [project.activeSession, project.legacySession]) {
      const session = project.sessions[sessionName]
      knownSessions.add(sessionName)
      inventory.push({
        session: sessionName,
        project: project.project,
        role: roleFor({ focus, projectKey: key, sessionName, project }),
        status: live.has(sessionName) ? 'present' : 'missing',
        privateRoomAccess: session.privateRoomAccess,
        warning: session.warning,
      })
    }
  }

  for (const sessionName of liveSessions) {
    if (knownSessions.has(sessionName)) continue
    inventory.push({
      session: sessionName,
      project: 'unknown',
      role: 'unknown',
      status: 'present',
      privateRoomAccess: 'none',
      warning: 'unknown tmux session; private room must not write to it',
    })
  }

  return inventory
}

function roleFor({ focus, projectKey, sessionName, project }) {
  const sameProject = focus === projectKey
  const isActive = sessionName === project.activeSession
  if (sameProject && isActive) return 'active'
  if (sameProject) return 'legacy'
  if (isActive) return 'other-project-active'
  return 'other-project-legacy'
}
