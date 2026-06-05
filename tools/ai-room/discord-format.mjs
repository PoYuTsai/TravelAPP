export function formatDiscordInventory({ focus, inventory }) {
  const lines = [`[Room/focus] ${focus}`]
  for (const item of inventory) {
    const marker = item.status === 'present' ? 'OK' : 'MISSING'
    lines.push(
      `${marker} ${item.session} | ${item.project} | ${item.role} | ${item.privateRoomAccess}`
    )
    if (item.warning) lines.push(`warning: ${item.warning}`)
  }
  return lines.join('\n')
}

export function formatDiscordHealth(report) {
  const lines = [`[Room/health] ${report.sessionHealth}`, report.summary]
  for (const blocker of report.blockers ?? []) {
    lines.push(`BLOCKER: ${blocker}`)
  }
  for (const warning of report.warnings ?? []) {
    lines.push(`warning: ${warning}`)
  }
  return lines.join('\n')
}

export function formatDiscordActionResult({ label, result }) {
  const lines = [`[${label}] ${result.action}`]
  if (result.dryRun) lines.push('mode: dry-run')
  if (result.allowed === false) lines.push('status: blocked')
  if (result.session) lines.push(`session: ${result.session}`)
  if (result.prompt) lines.push(`prompt: ${result.prompt}`)
  if (result.lockMode) lines.push(`lock: ${result.lockMode}`)
  if (result.roundPath) lines.push(`round: ${result.roundPath}`)
  if (result.contextClearedAt) lines.push(`clearedAt: ${result.contextClearedAt}`)
  if (result.interruptedAt) lines.push(`interruptedAt: ${result.interruptedAt}`)
  if (result.reason) lines.push(`reason: ${result.reason}`)
  if (result.warning) lines.push(`warning: ${result.warning}`)
  if (result.requiresEricConfirmation) lines.push('requires Eric confirmation')
  if (Array.isArray(result.steps)) {
    for (const step of result.steps) lines.push(`- ${step}`)
  }
  return lines.join('\n')
}
