import type { ConversationDraft } from '../types'

export interface DraftStore {
  getById(id: string): Promise<ConversationDraft | null>
  listByConversationId(conversationId: string): Promise<ConversationDraft[]>
  getPendingByConversationId(conversationId: string): Promise<ConversationDraft | null>
  upsert(draft: ConversationDraft): Promise<void>
}

export function createMemoryDraftStore(initialDrafts: ConversationDraft[] = []): DraftStore {
  const store = new Map(initialDrafts.map((draft) => [draft.id, draft]))

  return {
    async getById(id) {
      return store.get(id) ?? null
    },
    async listByConversationId(conversationId) {
      return Array.from(store.values()).filter((draft) => draft.conversationId === conversationId)
    },
    async getPendingByConversationId(conversationId) {
      return (
        Array.from(store.values()).find(
          (draft) => draft.conversationId === conversationId && draft.status === 'pending'
        ) ?? null
      )
    },
    async upsert(draft) {
      store.set(draft.id, draft)
    },
  }
}
