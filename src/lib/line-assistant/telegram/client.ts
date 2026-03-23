const TELEGRAM_API_BASE_URL = 'https://api.telegram.org'

type FetchLike = typeof fetch

interface TelegramApiResponse<T> {
  ok: boolean
  result: T
  description?: string
}

export interface TelegramSummaryMessage {
  topicId: string
  text: string
}

export interface TelegramInlineButton {
  text: string
  callbackData: string
}

export interface TelegramActionPrompt {
  topicId: string
  text: string
  buttons: TelegramInlineButton[]
}

export interface CreatedTelegramTopic {
  topicId: string
  title: string
}

export interface AnsweredTelegramCallbackQuery {
  callbackQueryId: string
  text?: string
}

export interface TelegramClient {
  createForumTopic(title: string): Promise<string>
  sendTopicSummary(topicId: string, text: string): Promise<void>
  sendTopicActionPrompt(
    topicId: string,
    text: string,
    buttons: TelegramInlineButton[]
  ): Promise<void>
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>
}

function normalizeTopicTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) {
    return 'LINE Customer'
  }

  return trimmed.slice(0, 128)
}

function parseMessageThreadId(topicId: string): number | string {
  const parsed = Number(topicId)
  return Number.isSafeInteger(parsed) ? parsed : topicId
}

export function createTelegramBotClient(input: {
  botToken: string
  groupId: string
  fetchImpl?: FetchLike
}): TelegramClient {
  const fetchImpl = input.fetchImpl ?? fetch
  const baseUrl = `${TELEGRAM_API_BASE_URL}/bot${input.botToken}`

  async function callTelegramMethod<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetchImpl(`${baseUrl}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Telegram ${method} failed with status ${response.status}`)
    }

    const payload = (await response.json()) as TelegramApiResponse<T>
    if (!payload.ok) {
      throw new Error(payload.description || `Telegram ${method} failed`)
    }

    return payload.result
  }

  return {
    async createForumTopic(title) {
      const result = await callTelegramMethod<{ message_thread_id: number }>('createForumTopic', {
        chat_id: input.groupId,
        name: normalizeTopicTitle(title),
      })

      return String(result.message_thread_id)
    },
    async sendTopicSummary(topicId, text) {
      await callTelegramMethod('sendMessage', {
        chat_id: input.groupId,
        message_thread_id: parseMessageThreadId(topicId),
        text,
      })
    },
    async sendTopicActionPrompt(topicId, text, buttons) {
      await callTelegramMethod('sendMessage', {
        chat_id: input.groupId,
        message_thread_id: parseMessageThreadId(topicId),
        text,
        reply_markup: {
          inline_keyboard: [buttons.map((button) => ({
            text: button.text,
            callback_data: button.callbackData,
          }))],
        },
      })
    },
    async answerCallbackQuery(callbackQueryId, text) {
      await callTelegramMethod('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        ...(text ? { text } : {}),
      })
    },
  }
}

export function createMemoryTelegramClient(): TelegramClient & {
  getSentSummaries(): TelegramSummaryMessage[]
  getActionPrompts(): TelegramActionPrompt[]
  getCreatedTopics(): CreatedTelegramTopic[]
  getAnsweredCallbackQueries(): AnsweredTelegramCallbackQuery[]
} {
  const sentSummaries: TelegramSummaryMessage[] = []
  const actionPrompts: TelegramActionPrompt[] = []
  const createdTopics: CreatedTelegramTopic[] = []
  const answeredCallbackQueries: AnsweredTelegramCallbackQuery[] = []
  let topicCounter = 1

  return {
    async createForumTopic(title) {
      const topicId = String(topicCounter++)
      createdTopics.push({
        topicId,
        title: normalizeTopicTitle(title),
      })
      return topicId
    },
    async sendTopicSummary(topicId, text) {
      sentSummaries.push({ topicId, text })
    },
    async sendTopicActionPrompt(topicId, text, buttons) {
      actionPrompts.push({ topicId, text, buttons })
    },
    async answerCallbackQuery(callbackQueryId, text) {
      answeredCallbackQueries.push({ callbackQueryId, text })
    },
    getSentSummaries() {
      return [...sentSummaries]
    },
    getActionPrompts() {
      return [...actionPrompts]
    },
    getCreatedTopics() {
      return [...createdTopics]
    },
    getAnsweredCallbackQueries() {
      return [...answeredCallbackQueries]
    },
  }
}
