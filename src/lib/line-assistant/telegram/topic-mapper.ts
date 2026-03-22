export interface TopicMapper {
  ensureTopicForLineUser(lineUserId: string, title: string): Promise<string>
  getTopicIdForLineUser(lineUserId: string): Promise<string | null>
}

export function createMemoryTopicMapper(): TopicMapper {
  const lineUserToTopicId = new Map<string, string>()
  let counter = 1

  return {
    async ensureTopicForLineUser(lineUserId) {
      const existing = lineUserToTopicId.get(lineUserId)
      if (existing) {
        return existing
      }

      const topicId = `topic-${counter++}`
      lineUserToTopicId.set(lineUserId, topicId)
      return topicId
    },
    async getTopicIdForLineUser(lineUserId) {
      return lineUserToTopicId.get(lineUserId) ?? null
    },
  }
}
