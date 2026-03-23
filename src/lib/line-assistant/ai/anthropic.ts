import type { DraftGenerationContext, DraftTextGenerator } from '../types'

const ANTHROPIC_MESSAGES_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_ANTHROPIC_DRAFT_MODEL = 'claude-sonnet-4-20250514'

interface AnthropicContentBlock {
  type?: string
  text?: string
}

interface AnthropicMessagesResponse {
  content?: AnthropicContentBlock[]
  error?: {
    message?: string
  }
}

function buildRecentMessagesText(context: DraftGenerationContext): string {
  if (context.recentMessages.length === 0) {
    return '- No recent messages captured'
  }

  return context.recentMessages
    .map((message) => `- [${message.role}] ${message.content}`)
    .join('\n')
}

function buildUserPrompt(context: DraftGenerationContext): string {
  return [
    'Customer inquiry context:',
    `Customer name: ${context.customerName}`,
    `Travel dates: ${context.travelDates ?? 'unknown'}`,
    `People summary: ${context.peopleSummary}`,
    `Attractions summary: ${context.attractionsSummary}`,
    `Special needs summary: ${context.specialNeedsSummary}`,
    'Recent messages:',
    buildRecentMessagesText(context),
    '',
    'Write one warm Traditional Chinese LINE reply draft for Eric to review.',
    'Constraints:',
    '- Sound like Chiangway Travel, not like a generic travel agent.',
    '- Be warm, practical, and concise.',
    '- Do not invent unavailable prices or guarantees.',
    '- Acknowledge missing details when needed.',
    '- Output only the reply text with no headings or labels.',
  ].join('\n')
}

export function createAnthropicDraftTextGenerator(input: {
  apiKey: string
  fetchImpl?: typeof fetch
  model?: string
}): DraftTextGenerator {
  const fetchImpl = input.fetchImpl ?? fetch
  const model = input.model ?? DEFAULT_ANTHROPIC_DRAFT_MODEL

  return async (context: DraftGenerationContext) => {
    const response = await fetchImpl(ANTHROPIC_MESSAGES_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': input.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        temperature: 0.3,
        system: [
          '你是清微旅行 Chiangway Travel 的客服草稿助手，協助 Eric 生成可人工審核的 LINE 回覆。',
          '品牌背景：台灣爸爸 Eric + 泰國媽媽 Min，人在清邁，主打親子包車與客製行程，司機與導遊分工。',
          '語氣要求：溫暖、務實、像真人，不要官腔，不要過度推銷。',
          '安全要求：不要捏造價格、車型、保證名額、景點營業資訊；不確定就明講需要再確認。',
        ].join('\n'),
        messages: [
          {
            role: 'user',
            content: buildUserPrompt(context),
          },
        ],
      }),
    })

    const data = (await response.json().catch(() => ({}))) as AnthropicMessagesResponse

    if (!response.ok) {
      throw new Error(data.error?.message || `Anthropic request failed with ${response.status}`)
    }

    const text = (data.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text?.trim() || '')
      .filter(Boolean)
      .join('\n')

    if (!text) {
      throw new Error('Anthropic returned an empty draft response')
    }

    return text
  }
}
