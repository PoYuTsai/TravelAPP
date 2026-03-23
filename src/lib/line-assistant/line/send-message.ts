import { getLineAssistantConfig } from '../config'

export interface LineSendResult {
  requestId: string | null
}

export interface LineMessageSender {
  sendTextMessage(input: { lineUserId: string; text: string }): Promise<LineSendResult>
  sendImageMessage(input: {
    lineUserId: string
    originalContentUrl: string
    previewImageUrl: string
  }): Promise<LineSendResult>
}

export interface MemorySentLineMessage {
  lineUserId: string
  text: string
}

export interface MemorySentLineImageMessage {
  lineUserId: string
  originalContentUrl: string
  previewImageUrl: string
}

export function createLineMessageSender(): LineMessageSender {
  return {
    async sendTextMessage({ lineUserId, text }) {
      return sendPushMessage({
        lineUserId,
        messages: [
          {
            type: 'text',
            text,
          },
        ],
      })
    },
    async sendImageMessage({ lineUserId, originalContentUrl, previewImageUrl }) {
      return sendPushMessage({
        lineUserId,
        messages: [
          {
            type: 'image',
            originalContentUrl,
            previewImageUrl,
          },
        ],
      })
    },
  }
}

export function createMemoryLineMessageSender(): LineMessageSender & {
  getSentMessages(): MemorySentLineMessage[]
  getSentImageMessages(): MemorySentLineImageMessage[]
} {
  const sentMessages: MemorySentLineMessage[] = []
  const sentImageMessages: MemorySentLineImageMessage[] = []

  return {
    async sendTextMessage({ lineUserId, text }) {
      sentMessages.push({ lineUserId, text })
      return {
        requestId: `memory-${sentMessages.length}`,
      }
    },
    async sendImageMessage({ lineUserId, originalContentUrl, previewImageUrl }) {
      sentImageMessages.push({ lineUserId, originalContentUrl, previewImageUrl })
      return {
        requestId: `memory-image-${sentImageMessages.length}`,
      }
    },
    getSentMessages() {
      return [...sentMessages]
    },
    getSentImageMessages() {
      return [...sentImageMessages]
    },
  }
}

async function sendPushMessage(input: {
  lineUserId: string
  messages: Array<Record<string, unknown>>
}): Promise<LineSendResult> {
  const config = getLineAssistantConfig(process.env)

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.line.channelAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: input.lineUserId,
      messages: input.messages,
    }),
  })

  if (!response.ok) {
    throw new Error(`LINE push failed with status ${response.status}`)
  }

  return {
    requestId: response.headers.get('x-line-request-id'),
  }
}
