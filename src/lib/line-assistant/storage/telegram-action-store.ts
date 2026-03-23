import type { TelegramAction } from '../types'

export interface StoredTelegramAction {
  token: string
  action: TelegramAction
  createdAt: string
}

export interface TelegramActionStore {
  get(token: string): Promise<StoredTelegramAction | null>
  upsert(record: StoredTelegramAction): Promise<void>
  delete(token: string): Promise<void>
  list(): Promise<StoredTelegramAction[]>
}

export function createMemoryTelegramActionStore(
  initialRecords: StoredTelegramAction[] = []
): TelegramActionStore {
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
