import { getLineAssistantConfig } from '../config'

export interface LineSendResult {
  requestId: string | null
}

export interface LineMessageSender {
  sendTextMessage(input: { lineUserId: string; text: string }): Promise<LineSendResult>
}

export interface MemorySentLineMessage {
  lineUserId: string
  text: string
}

export function createLineMessageSender(): LineMessageSender {
  return {
    async sendTextMessage({ lineUserId, text }) {
      const config = getLineAssistantConfig(process.env)

      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.line.channelAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: lineUserId,
          messages: [
            {
              type: 'text',
              text,
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error(`LINE push failed with status ${response.status}`)
      }

      return {
        requestId: response.headers.get('x-line-request-id'),
      }
    },
  }
}

export function createMemoryLineMessageSender(): LineMessageSender & {
  getSentMessages(): MemorySentLineMessage[]
} {
  const sentMessages: MemorySentLineMessage[] = []

  return {
    async sendTextMessage({ lineUserId, text }) {
      sentMessages.push({ lineUserId, text })
      return {
        requestId: `memory-${sentMessages.length}`,
      }
    },
    getSentMessages() {
      return [...sentMessages]
    },
  }
}
