#!/usr/bin/env node

import { buildHealthReport } from './health.mjs'
import { formatDiscordInviteSetup } from './invite.mjs'
import { createLifecycle } from './lifecycle.mjs'
import { loadLocalEnv } from './env-loader.mjs'
import { buildSessionInventory } from './session-inventory.mjs'
import {
  readCurrentState,
  switchChatMode,
  switchFocus,
  writeCurrentState,
} from './state-store.mjs'
import { createTmuxAdapter } from './tmux-adapter.mjs'

const adapter = createTmuxAdapter()

async function main(argv = process.argv.slice(2)) {
  const [command, arg] = argv

  if (!command || command === 'help' || command === '--help') {
    printHelp()
    return
  }

  if (command === 'sessions') {
    const state = await readCurrentState()
    const liveSessions = await adapter.listSessions()
    const inventory = buildSessionInventory({
      focus: state.focus,
      liveSessions,
    })
    printSessionInventory(state.focus, inventory)
    return
  }

  if (command === 'focus') {
    if (!arg) {
      const state = await readCurrentState()
      console.log(`Focus: ${state.focus} (${state.project}) -> ${state.activeSession}`)
      return
    }
    const next = await switchFocus(arg, { actor: 'eric' })
    console.log(`Focus switched to ${next.focus} (${next.project})`)
    console.log(`Active rc: ${next.activeSession}`)
    console.log(`Legacy dc: ${next.legacySession} (read-only by default)`)
    return
  }

  if (command === 'health') {
    const state = await readCurrentState()
    const liveSessions = await adapter.listSessions()
    const cwdBySession = await readKnownCwds(liveSessions)
    const report = buildHealthReport({
      focus: state.focus,
      liveSessions,
      cwdBySession,
      desktopBindConfirmed: state.desktopBindConfirmed === true,
    })

    await writeCurrentState({
      ...state,
      sessionHealth: report.sessionHealth,
      blockers: report.blockers,
      nextAction: nextActionForHealth(report),
    })

    printHealth(report)
    return
  }

  if (command === 'chat-mode') {
    if (!arg) {
      const state = await readCurrentState()
      console.log(`Chat mode: ${state.chatMode ?? 'balanced'}`)
      console.log(chatModeDescription(state.chatMode ?? 'balanced'))
      return
    }
    const next = await switchChatMode(arg, { actor: 'eric' })
    console.log(`Chat mode switched to ${next.chatMode}`)
    console.log(chatModeDescription(next.chatMode))
    return
  }

  if (command === 'invite') {
    await loadLocalEnv()
    console.log(formatDiscordInviteSetup({ clientId: process.env.AI_ROOM_DISCORD_CLIENT_ID }))
    return
  }

  if (command === 'round') {
    const lifecycle = createLifecycle({ tmux: adapter })
    const result = await lifecycle.round({ dryRun: argv.includes('--dry-run') })
    printActionResult(result)
    return
  }

  if (command === 'clear') {
    const lifecycle = createLifecycle({ tmux: adapter })
    const result = await lifecycle.clear({
      dryRun: argv.includes('--dry-run'),
      force: argv.includes('--force') || argv.includes('force'),
    })
    printActionResult(result)
    return
  }

  if (command === 'interrupt') {
    const lifecycle = createLifecycle({ tmux: adapter })
    const result = await lifecycle.interrupt({
      confirm: argv.includes('--confirm') || argv.includes('confirm'),
    })
    printActionResult(result)
    return
  }

  if (command === 'rebind') {
    const lifecycle = createLifecycle({ tmux: adapter })
    const result = await lifecycle.rebind()
    printActionResult(result)
    return
  }

  throw new Error(`Unknown ai-room command "${command}". Run: npm run ai-room -- help`)
}

function nextActionForHealth(report) {
  if (report.blockers.length) {
    return 'resolve health blockers before writing to the active session'
  }
  if (report.sessionHealth === 'tmux_only') {
    return 'confirm desktop Claude Code bind before long autonomous work'
  }
  return 'ready for private-room rc-only work'
}

async function readKnownCwds(liveSessions) {
  const cwdBySession = {}
  for (const session of liveSessions) {
    try {
      cwdBySession[session] = await adapter.getCurrentPath(session)
    } catch {
      // Unknown sessions or tmux failures are reported by inventory/health.
    }
  }
  return cwdBySession
}

function printHelp() {
  console.log(`AI Room commands:
  sessions
  focus [travel|vibesync]
  health
  chat-mode [balanced|casual|work]
  invite
  round [--dry-run]
  clear [--dry-run|force]
  interrupt [confirm]
  rebind`)
}

function chatModeDescription(chatMode) {
  if (chatMode === 'casual') {
    return 'casual: untagged greetings, small talk, moods, and event sharing get warm local support.'
  }
  if (chatMode === 'work') {
    return 'work: untagged messages default to the Codex + Claude Code work roundtable.'
  }
  return 'balanced: untagged messages auto-route between chat/support and work roundtable.'
}

function printSessionInventory(focus, inventory) {
  console.log(`Focus: ${focus}`)
  for (const item of inventory) {
    const marker = item.status === 'present' ? 'OK' : 'MISSING'
    console.log(
      `${marker} ${item.session} | ${item.project} | ${item.role} | ${item.privateRoomAccess}`
    )
    if (item.warning) console.log(`  warning: ${item.warning}`)
  }
}

function printHealth(report) {
  console.log(`Health: ${report.sessionHealth}`)
  console.log(report.summary)
  for (const blocker of report.blockers) {
    console.log(`BLOCKER: ${blocker}`)
  }
  for (const warning of report.warnings) {
    console.log(`warning: ${warning}`)
  }
}

function printActionResult(result) {
  console.log(`${result.action}: ${result.allowed === false ? 'blocked' : 'ok'}`)
  if (result.session) console.log(`session: ${result.session}`)
  if (result.prompt) console.log(`prompt: ${result.prompt}`)
  if (result.lockMode) console.log(`lock: ${result.lockMode}`)
  if (result.roundPath) console.log(`round: ${result.roundPath}`)
  if (result.reason) console.log(`reason: ${result.reason}`)
  if (result.warning) console.log(`warning: ${result.warning}`)
  if (result.requiresEricConfirmation) {
    console.log('requires Eric confirmation')
  }
  if (Array.isArray(result.steps)) {
    for (const step of result.steps) console.log(`- ${step}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
