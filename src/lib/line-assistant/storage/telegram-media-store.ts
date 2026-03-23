export interface StoredTelegramMedia {
  token: string
  telegramFileId: string
  telegramFileUniqueId?: string
  contentType: string
  fileSize: number | null
  caption?: string
  createdAt: string
}

export interface TelegramMediaStore {
  get(token: string): Promise<StoredTelegramMedia | null>
  upsert(record: StoredTelegramMedia): Promise<void>
  delete(token: string): Promise<void>
  list(): Promise<StoredTelegramMedia[]>
}

export function createMemoryTelegramMediaStore(
  initialRecords: StoredTelegramMedia[] = []
): TelegramMediaStore {
  const store = new Map(initialRecords.map((record) => [record.token, record]))

  return {
    async get(token) {
      return store.get(token) ?? null
    },
    async upsert(record) {
      store.set(record.token, record)
    },
    async delete(token) {
      store.delete(token)
    },
    async list() {
      return Array.from(store.values())
    },
  }
}
