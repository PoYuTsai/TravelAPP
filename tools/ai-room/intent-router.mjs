export function routeRoomIntent(input) {
  const text = String(input ?? '').trim()
  const mentionsCc = /@cc\b/i.test(text)
  const mentionsCodex = /@codex\b/i.test(text)

  if (!mentionsCc && !mentionsCodex) {
    return {
      responder: 'ambient',
      intent: 'ambient_chat',
      body: text,
      startsLoop: false,
      maxAgentTurns: 2,
      requiresWrite: false,
    }
  }

  if (mentionsCc && mentionsCodex) {
    const body = cleanBody(text)
    return {
      responder: 'loop',
      intent: /review/i.test(text) || /review|實作完請|小問題/.test(text)
        ? 'implement_review_fix'
        : 'discuss',
      body,
      startsLoop: true,
      maxAgentTurns: extractMaxTurns(text),
    }
  }

  if (mentionsCodex) {
    const body = cleanBody(text)
    return {
      responder: 'codex',
      intent: inferCodexIntent(body),
      body,
      startsLoop: false,
    }
  }

  const body = cleanBody(text)
  return {
    responder: 'cc',
    intent: inferCcIntent(body),
    body,
    startsLoop: false,
  }
}

function cleanBody(text) {
  return text
    .replace(/@cc\b/gi, '')
    .replace(/@codex\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractMaxTurns(text) {
  const match = String(text).match(/最多\s*(\d+)\s*輪/)
  const requested = match ? Number(match[1]) : 3
  return Math.max(1, Math.min(requested, 5))
}

function inferCodexIntent(body) {
  if (/review|檢查/i.test(body)) return 'review'
  return 'plan'
}

function inferCcIntent(body) {
  if (/implement|實作|開發|新增|修改|完成/i.test(body)) return 'implement'
  if (/status|狀態|目前|現在/i.test(body)) return 'status'
  if (/fix|修/i.test(body)) return 'fix'
  if (/test|lint|build|驗證/i.test(body)) return 'verify'
  return 'implement'
}
