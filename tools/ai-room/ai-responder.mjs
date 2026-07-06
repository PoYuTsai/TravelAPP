const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_OPENAI_MODEL = 'gpt-5-mini'
const MAX_OUTPUT_TOKENS = 650

export async function createLiveAmbientReply(input, options = {}) {
  return createLiveBrainReply(
    {
      ...input,
      intent: input.intent ?? 'ambient_chat',
      targetAgent: input.targetAgent ?? 'ambient',
    },
    options
  )
}

export async function createLiveBrainReply(input, options = {}) {
  const env = options.env ?? process.env
  if (!isEnabled(env.AI_ROOM_LIVE_AI_ENABLED)) return null

  const apiKey = firstValue(env.AI_ROOM_OPENAI_API_KEY, env.OPENAI_API_KEY)
  if (!apiKey) return null

  const fetchImpl = options.fetch ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') return null

  const model = firstValue(env.AI_ROOM_OPENAI_MODEL, env.AI_ROOM_MODEL, DEFAULT_OPENAI_MODEL)
  const response = await safeOpenAiResponse({
    fetchImpl,
    apiKey,
    model,
    input,
  })
  if (!response) return null

  return formatLiveReply(response, input)
}

function isEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase())
}

function firstValue(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

async function safeOpenAiResponse({ fetchImpl, apiKey, model, input }) {
  let response
  try {
    response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions: buildSystemInstructions(),
        input: buildUserInput(input),
        max_output_tokens: MAX_OUTPUT_TOKENS,
      }),
    })
  } catch {
    return null
  }

  if (!response?.ok) return null

  let data
  try {
    data = await response.json()
  } catch {
    return null
  }

  return parseModelJson(extractResponseText(data))
}

function buildSystemInstructions() {
  return [
    'You are the real live brain for Eric private Discord AI Engineering Room.',
    'Return exactly one compact JSON object with keys: room, codex, cc.',
    'Use Traditional Chinese. Be warm, natural, and specific to Eric message.',
    'Understand ordinary natural language. Do not rely on keyword templates.',
    'Codex is the architecture, product, scope, review, edge-case, and decision partner.',
    'Claude Code is the implementation, execution, testing, debugging, and concrete next-step partner.',
    'If the user is greeting, small-talking, tired, anxious, or asking for emotional support, set room to an empty string and let Codex and Claude Code reply like supportive teammates.',
    'If the user asks an open work question, set room to a short focus/context line, make Codex give the product/spec/architecture/review view, and make Claude Code give the implementation/testing/next-step view.',
    'If targetAgent is codex, still return all keys but make codex the only necessary final voice.',
    'If targetAgent is cc, still return all keys but make cc the only necessary final voice.',
    'Do not claim to be the desktop Codex thread or the real Claude app. Do not say anything was written to tmux unless the provided context explicitly says a confirmed dispatch happened.',
    'Never instruct destructive actions. Keep each agent reply under 90 Traditional Chinese characters unless the user asks for depth.',
  ].join('\n')
}

function buildUserInput({ state, body, intent, targetAgent }) {
  return [
    `focus=${state.focus}`,
    `project=${state.project}`,
    `activeSession=${state.activeSession}`,
    `sessionHealth=${state.sessionHealth}`,
    `intent=${intent ?? ''}`,
    `targetAgent=${targetAgent ?? ''}`,
    `message=${body}`,
  ].join('\n')
}

function extractResponseText(data) {
  if (typeof data?.output_text === 'string') return data.output_text
  const chunks = []
  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === 'string') chunks.push(content.text)
    }
  }
  return chunks.join('\n')
}

function parseModelJson(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return null

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const raw = fenced ? fenced[1] : trimmed
  try {
    const parsed = JSON.parse(raw)
    const codex = cleanText(parsed.codex)
    const cc = cleanText(parsed.cc)
    if (!codex || !cc) return null
    return {
      room: cleanText(parsed.room),
      codex,
      cc,
    }
  } catch {
    return null
  }
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function formatLiveReply(response, input = {}) {
  if (input.targetAgent === 'codex') {
    return `[Codex] ${response.codex}`
  }
  if (input.targetAgent === 'cc') {
    return `[CC] ${response.cc}`
  }

  const lines = []
  if (response.room) lines.push(`[Room/roundtable] ${response.room}`)
  lines.push(`[Codex] ${response.codex}`)
  lines.push(`[CC] ${response.cc}`)
  return lines.join('\n')
}
