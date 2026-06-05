const AGENT_PREFIXES = [
  { agent: 'codex', pattern: /^\[Codex(?:\/([^\]]+))?\]\s*/ },
  { agent: 'cc', pattern: /^\[CC(?:\/([^\]]+))?\]\s*/ },
  { agent: 'room', pattern: /^\[Room(?:\/([^\]]+))?\]\s*/ },
]

export function splitAgentContent(content) {
  const segments = []
  let current = null

  for (const line of String(content ?? '').split(/\r?\n/)) {
    const parsed = parseAgentLine(line)
    if (parsed) {
      current = parsed
      segments.push(current)
      continue
    }

    if (current && line.trim()) {
      current.content = `${current.content}\n${line}`
    } else if (line.trim()) {
      current = { agent: 'room', content: line }
      segments.push(current)
    }
  }

  return segments
}

export async function deliverDiscordResult(result, options = {}) {
  if (!result?.shouldReply) return { deliveredVia: 'none' }

  const segments = splitAgentContent(result.content)
  if (segments.length === 0) return { deliveredVia: 'none' }

  if (canUseWebhooks(segments, options.webhooks)) {
    for (const segment of segments) {
      await postWebhook(segment, options)
    }
    return {
      deliveredVia: 'webhook',
      segmentCount: segments.length,
    }
  }

  await options.fallbackReply(result.content)
  return {
    deliveredVia: 'fallback',
    segmentCount: segments.length,
  }
}

export function buildWebhookConfig(env = process.env) {
  return {
    webhooks: {
      codex: env.AI_ROOM_CODEX_WEBHOOK_URL,
      cc: env.AI_ROOM_CC_WEBHOOK_URL,
      room: env.AI_ROOM_ROOM_WEBHOOK_URL,
    },
    identities: {
      codex: {
        username: env.AI_ROOM_CODEX_USERNAME || 'Codex',
        avatarUrl: env.AI_ROOM_CODEX_AVATAR_URL,
      },
      cc: {
        username: env.AI_ROOM_CC_USERNAME || 'Claude Code',
        avatarUrl: env.AI_ROOM_CC_AVATAR_URL,
      },
      room: {
        username: env.AI_ROOM_ROOM_USERNAME || 'AI Room',
        avatarUrl: env.AI_ROOM_ROOM_AVATAR_URL,
      },
    },
  }
}

function parseAgentLine(line) {
  for (const { agent, pattern } of AGENT_PREFIXES) {
    const match = String(line).match(pattern)
    if (!match) continue

    if (agent === 'room') {
      return {
        agent,
        content: String(line).trim(),
      }
    }

    const label = match[1] ? `[${match[1]}] ` : ''
    return {
      agent,
      content: `${label}${String(line).slice(match[0].length)}`.trim(),
    }
  }
  return null
}

function canUseWebhooks(segments, webhooks = {}) {
  return segments.every((segment) => Boolean(webhooks[segment.agent]))
}

async function postWebhook(segment, options) {
  const fetchImpl = options.fetch ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is required for Discord webhook delivery')
  }

  const identity = options.identities?.[segment.agent] ?? {}
  const response = await fetchImpl(options.webhooks[segment.agent], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: identity.username,
      ...(identity.avatarUrl && { avatar_url: identity.avatarUrl }),
      content: segment.content,
    }),
  })

  if (!response.ok) {
    throw new Error(`Discord webhook delivery failed with HTTP ${response.status}`)
  }
}
