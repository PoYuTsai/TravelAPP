import { routeRoomIntent } from './intent-router.mjs'

export const HARD_GATE_REASONS = {
  production: 'production/deploy requires Eric confirmation',
  commitPush: 'commit/push requires Eric authorization',
}

export function createDevLoop({
  focus,
  activeSession,
  request,
  maxAgentTurns = 3,
  shipMode = 'manual',
}) {
  const blockers = detectHardGates(request, shipMode)
  if (blockers.length > 0) {
    return {
      state: 'blocked',
      focus,
      activeSession,
      maxAgentTurns,
      blockers,
      steps: [],
    }
  }

  const routed = routeRoomIntent(request)
  const turns = Math.max(1, Math.min(maxAgentTurns, 5))
  const steps = buildSteps(routed, activeSession)

  if (shipMode === 'autopilot_ship' && wantsCommitPush(request)) {
    steps.push({
      actor: 'cc',
      action: 'commit_push',
      targetSession: activeSession,
      requiresWrite: true,
    })
  }

  return {
    state: 'queued',
    focus,
    activeSession,
    maxAgentTurns: turns,
    blockers: [],
    steps,
  }
}

function buildSteps(routed, activeSession) {
  if (routed.intent === 'implement_review_fix') {
    return [
      {
        actor: 'cc',
        action: 'implement',
        targetSession: activeSession,
        requiresWrite: true,
      },
      {
        actor: 'cc',
        action: 'round',
        targetSession: activeSession,
        requiresWrite: true,
      },
      {
        actor: 'codex',
        action: 'review',
        targetSession: null,
        requiresWrite: false,
      },
      {
        actor: 'cc',
        action: 'fix_minor_issues',
        targetSession: activeSession,
        requiresWrite: true,
      },
    ]
  }

  if (routed.intent === 'discuss') {
    return [
      { actor: 'cc', action: 'perspective', targetSession: null, requiresWrite: false },
      { actor: 'codex', action: 'review_perspective', targetSession: null, requiresWrite: false },
      { actor: 'codex', action: 'converge', targetSession: null, requiresWrite: false },
    ]
  }

  if (routed.intent === 'ambient_chat') {
    return [
      {
        actor: 'codex',
        action: 'ambient_support',
        targetSession: null,
        requiresWrite: false,
      },
      {
        actor: 'cc',
        action: 'practical_reassurance',
        targetSession: null,
        requiresWrite: false,
      },
    ]
  }

  if (routed.responder === 'cc') {
    return [
      {
        actor: 'cc',
        action: routed.intent,
        targetSession: activeSession,
        requiresWrite: true,
      },
    ]
  }

  if (routed.responder === 'codex') {
    return [
      {
        actor: 'codex',
        action: routed.intent,
        targetSession: null,
        requiresWrite: false,
      },
    ]
  }

  return []
}

function detectHardGates(request, shipMode) {
  const blockers = []
  if (/deploy|production|上線/i.test(request)) {
    blockers.push(HARD_GATE_REASONS.production)
  }
  if (wantsCommitPush(request) && shipMode !== 'autopilot_ship') {
    blockers.push(HARD_GATE_REASONS.commitPush)
  }
  return blockers
}

function wantsCommitPush(request) {
  return /commit|push/i.test(request)
}
