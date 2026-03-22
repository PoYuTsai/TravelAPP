export interface TelegramSummaryMessage {
  topicId: string
  text: string
}

export interface TelegramClient {
  sendTopicSummary(topicId: string, text: string): Promise<void>
}

export function createMemoryTelegramClient(): TelegramClient & {
  getSentSummaries(): TelegramSummaryMessage[]
} {
  const sentSummaries: TelegramSummaryMessage[] = []

  return {
    async sendTopicSummary(topicId, text) {
      sentSummaries.push({ topicId, text })
    },
    getSentSummaries() {
      return sentSummaries
    },
  }
}
