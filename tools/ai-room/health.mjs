import { buildSessionInventory } from './session-inventory.mjs'
import { getProjectConfig } from './projects.mjs'

export function normalizeWorkspacePath(value) {
  const normalized = String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/^([A-Za-z]):\//, (_, drive) => `/mnt/${drive.toLowerCase()}/`)
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .toLowerCase()
  return normalized
}

export function buildHealthReport({
  focus,
  liveSessions,
  cwdBySession = {},
  desktopBindConfirmed = false,
}) {
  const project = getProjectConfig(focus)
  const inventory = buildSessionInventory({ focus, liveSessions })
  const warnings = []
  const blockers = []

  const activePresent = liveSessions.includes(project.activeSession)
  if (!activePresent) {
    blockers.push(`active session ${project.activeSession} is missing`)
  }

  const actualCwd = cwdBySession[project.activeSession]
  if (activePresent && actualCwd) {
    const expected = normalizeWorkspacePath(project.workspace)
    const actual = normalizeWorkspacePath(actualCwd)
    if (expected !== actual) {
      blockers.push(
        `cwd mismatch for ${project.activeSession}: expected ${project.workspace}, got ${actualCwd}`
      )
    }
  } else if (activePresent) {
    warnings.push(`cwd for ${project.activeSession} is unknown`)
  }

  if (activePresent && !desktopBindConfirmed) {
    warnings.push('desktop Claude Code bind is not confirmed')
  }

  for (const item of inventory) {
    if (item.warning && item.role.includes('legacy')) {
      warnings.push(item.warning)
    }
  }

  const sessionHealth = blockers.length
    ? 'needs_rebind'
    : desktopBindConfirmed
      ? 'healthy'
      : 'tmux_only'

  return {
    focus,
    project: project.project,
    activeSession: project.activeSession,
    legacySession: project.legacySession,
    sessionHealth,
    summary: `${project.activeSession} ${activePresent ? 'present' : 'missing'} for ${project.project}`,
    warnings,
    blockers,
    inventory,
  }
}
