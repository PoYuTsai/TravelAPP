import type { Conversation } from '../types'

export interface ConversationStore {
  getByLineUserId(lineUserId: string): Promise<Conversation | null>
  upsert(conversation: Conversation): Promise<void>
  delete(lineUserId: string): Promise<void>
  list(): Promise<Conversation[]>
}

export function createMemoryConversationStore(
  initialRecords: Conversation[] = []
): ConversationStore {
  const store = new Map(initialRecords.map((record) => [record.lineUserId, record]))

  return {
    async getByLineUserId(lineUserId) {
      return store.get(lineUserId) ?? null
    },
    async upsert(conversation) {
      store.set(conversation.lineUserId, conversation)
    },
    async delete(lineUserId) {
      store.delete(lineUserId)
    },
    async list() {
      return Array.from(store.values())
    },
  }
}
