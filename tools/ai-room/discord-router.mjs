import { routeRoomIntent } from './intent-router.mjs'

export function routeDiscordMessage(message, env) {
  const privateChannelId = env.privateChannelId
  const content = String(message.content ?? '').trim()
  const isPrivateRoom = message.channelId === privateChannelId

  if (!isPrivateRoom) {
    if (isWriteLike(content)) {
      return {
        allowed: false,
        intent: 'denied',
        reason: 'write commands are allowed only in the private AI room',
      }
    }
    return {
      allowed: false,
      intent: 'ignore',
      reason: 'message is outside the private AI room',
    }
  }

  if (content.startsWith('/')) {
    return routeSlash(content, message.authorId)
  }

  if (isSessionPeekQuestion(content)) {
    return roomDecision({
      actor: message.authorId,
      intent: 'session_peek',
      args: [content],
      requiresWrite: false,
    })
  }

  if (mentionsBothAgents(content) && isTwoAgentOpenQuestion(content)) {
    return {
      allowed: true,
      intent: 'two_agent_question',
      actor: message.authorId,
      targetAgent: 'ambient',
      args: [cleanTwoAgentBody(content)],
      requiresWrite: false,
    }
  }

  if (/^@cc\b/i.test(content)) {
    const routed = routeRoomIntent(content)
    return {
      allowed: true,
      intent: routed.intent,
      actor: message.authorId,
      targetAgent: 'cc',
      args: [routed.body],
      requiresWrite: true,
    }
  }

  if (/^@codex\b/i.test(content)) {
    const routed = routeRoomIntent(content)
    return {
      allowed: true,
      intent: routed.intent,
      actor: message.authorId,
      targetAgent: 'codex',
      args: [routed.body],
      requiresWrite: false,
    }
  }

  const routed = routeRoomIntent(content)
  if (routed.intent === 'ambient_chat') {
    return {
      allowed: true,
      intent: 'ambient_chat',
      actor: message.authorId,
      targetAgent: 'ambient',
      args: [routed.body],
      requiresWrite: false,
      maxAgentTurns: routed.maxAgentTurns,
    }
  }

  return {
    allowed: false,
    intent: 'ignore',
    reason: 'message does not address @cc, @codex, or a supported slash command',
  }
}

function routeSlash(content, actor) {
  const parts = content.slice(1).split(/\s+/).filter(Boolean)
  const [command, ...args] = parts
  if (command === 'sessions') {
    return roomDecision({ actor, intent: 'sessions', args, requiresWrite: false })
  }
  if (command === 'focus') {
    return roomDecision({
      actor,
      intent: args.length ? 'focus_switch' : 'focus_status',
      args,
      requiresWrite: false,
      requiresConfirmation: args.length > 0,
    })
  }
  if (command === 'health') {
    return roomDecision({ actor, intent: 'health_check', args, requiresWrite: false })
  }
  if (command === 'mode') {
    return roomDecision({
      actor,
      intent: args.length ? 'mode_switch' : 'mode_status',
      args,
      requiresWrite: false,
      requiresConfirmation: args[0] === 'autopilot_ship',
    })
  }
  if (command === 'chat-mode') {
    return roomDecision({
      actor,
      intent: args.length ? 'chat_mode_switch' : 'chat_mode_status',
      args,
      requiresWrite: false,
    })
  }
  if (command === 'codex') {
    const routed = routeRoomIntent(`@codex ${args.join(' ')}`.trim())
    return agentDecision({
      actor,
      targetAgent: 'codex',
      intent: routed.intent,
      args: [routed.body],
      requiresWrite: false,
    })
  }
  if (command === 'cc') {
    const routed = routeRoomIntent(`@cc ${args.join(' ')}`.trim())
    return agentDecision({
      actor,
      targetAgent: 'cc',
      intent: routed.intent,
      args: [routed.body],
      requiresWrite: true,
    })
  }
  if (['round', 'clear', 'interrupt', 'rebind'].includes(command)) {
    return roomDecision({
      actor,
      intent: command,
      args,
      requiresWrite: true,
    })
  }
  if (command === 'chat-clear') {
    return roomDecision({
      actor,
      intent: 'chat_clear',
      args,
      requiresWrite: false,
      ephemeral: true,
    })
  }
  return {
    allowed: false,
    intent: 'unknown',
    reason: `unsupported slash command /${command}`,
  }
}

function agentDecision({ actor, targetAgent, intent, args, requiresWrite }) {
  return {
    allowed: true,
    intent,
    actor,
    targetAgent,
    args,
    requiresWrite,
  }
}

function roomDecision({ actor, intent, args, requiresWrite, requiresConfirmation, ephemeral }) {
  return {
    allowed: true,
    intent,
    actor,
    targetAgent: 'room',
    args,
    requiresWrite,
    ...(requiresConfirmation !== undefined && { requiresConfirmation }),
    ...(ephemeral !== undefined && { ephemeral }),
  }
}

function isWriteLike(content) {
  return (
    /^@cc\b/i.test(content) ||
    /^\/(round|clear|chat-clear|interrupt|rebind)\b/i.test(content)
  )
}

function mentionsBothAgents(content) {
  return /@cc\b/i.test(content) && /@codex\b/i.test(content)
}

function isSessionPeekQuestion(content) {
  const text = String(content ?? '').trim()
  return (
    /\b(?:rc|tmux|session|pane|claude code)\b/i.test(text) &&
    /(看得到|在做|做什麼|現在|目前|狀態|status|current|doing)/i.test(text)
  )
}

function isTwoAgentOpenQuestion(content) {
  const body = cleanTwoAgentBody(content)
  return (
    /[?？]|什麼|如何|怎麼|優缺點|分工|建議|看法|比較|差異/.test(body) &&
    !/(--confirm|實作|修正|修 bug|fix|implement|build|test|lint|commit|push|跑|執行)/i.test(body)
  )
}

function cleanTwoAgentBody(content) {
  return String(content ?? '')
    .replace(/@cc\b/gi, '')
    .replace(/@codex\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(跟|和|與|及|and)\s*/i, '')
    .trim()
}
