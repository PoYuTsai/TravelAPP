import { loadLocalEnv } from './env-loader.mjs'
import { buildHealthReport } from './health.mjs'
import { readCurrentState } from './state-store.mjs'
import { createTmuxAdapter } from './tmux-adapter.mjs'

const REQUIRED_ENV = Object.freeze([
  'AI_ROOM_DISCORD_TOKEN',
  'AI_ROOM_PRIVATE_CHANNEL_ID',
  'AI_ROOM_DISCORD_GUILD_ID',
])

export async function buildDoctorReport(options = {}) {
  const env = options.env ?? process.env
  await loadLocalEnv({
    cwd: options.cwd ?? process.cwd(),
    env,
  })

  const missingEnv = REQUIRED_ENV.filter((key) => !env[key])
  const state = await readCurrentState({ stateDir: options.stateDir })
  const tmux = options.tmux ?? createTmuxAdapter({ mode: env.AI_ROOM_TMUX_MODE })
  const liveSessions = await safeListSessions(tmux)
  const cwdBySession = await readKnownCwds(tmux, liveSessions)
  const health = buildHealthReport({
    focus: state.focus,
    liveSessions,
    cwdBySession,
    desktopBindConfirmed: state.desktopBindConfirmed === true,
  })
  const identityWarnings = buildIdentityWarnings(env)

  const blockers = [
    ...missingEnv.map((key) => `missing env ${key}`),
    ...health.blockers,
  ]

  return {
    ready: blockers.length === 0,
    missingEnv,
    focus: state.focus,
    activeSession: state.activeSession,
    health,
    blockers,
    identityWarnings,
  }
}

export function formatDoctorReport(report) {
  const lines = [
    `[Room/doctor] ${report.ready ? 'ready' : 'not ready'}`,
    `focus: ${report.focus} -> ${report.activeSession}`,
    `health: ${report.health.sessionHealth}`,
  ]

  if (report.missingEnv.length > 0) {
    lines.push(`missing env: ${report.missingEnv.join(', ')}`)
  }
  for (const blocker of report.health.blockers) {
    lines.push(`BLOCKER: ${blocker}`)
  }
  for (const warning of report.health.warnings) {
    lines.push(`warning: ${warning}`)
  }
  for (const warning of report.identityWarnings ?? []) {
    lines.push(`identity warning: ${warning}`)
  }

  return lines.join('\n')
}

function buildIdentityWarnings(env) {
  const warnings = []
  if (!env.AI_ROOM_CODEX_WEBHOOK_URL) {
    warnings.push('AI_ROOM_CODEX_WEBHOOK_URL is missing; @codex will use the fallback bot reply.')
  }
  if (!env.AI_ROOM_CC_WEBHOOK_URL) {
    warnings.push('AI_ROOM_CC_WEBHOOK_URL is missing; @cc will use the fallback bot reply.')
  }
  return warnings
}

async function safeListSessions(tmux) {
  try {
    return await tmux.listSessions()
  } catch (error) {
    return []
  }
}

async function readKnownCwds(tmux, liveSessions) {
  const cwdBySession = {}
  for (const session of liveSessions) {
    try {
      cwdBySession[session] = await tmux.getCurrentPath(session)
    } catch {
      // Health report will still explain missing or unknown session state.
    }
  }
  return cwdBySession
}
