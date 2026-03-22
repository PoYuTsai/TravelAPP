import type { InboundLineEventRecord } from '../types'

export interface InboundEventStore {
  getByLineEventId(lineEventId: string): Promise<InboundLineEventRecord | null>
  list(): Promise<InboundLineEventRecord[]>
  listPending(limit?: number): Promise<InboundLineEventRecord[]>
  upsert(record: InboundLineEventRecord): Promise<void>
}

export function createMemoryInboundEventStore(
  initialRecords: InboundLineEventRecord[] = []
): InboundEventStore {
  const store = new Map(initialRecords.map((record) => [record.lineEventId, record]))

  return {
    async getByLineEventId(lineEventId) {
      return store.get(lineEventId) ?? null
    },
    async list() {
      return Array.from(store.values())
    },
    async listPending(limit) {
      const pending = Array.from(store.values()).filter((record) =>
        record.status === 'received' || record.status === 'failed'
      )
      return typeof limit === 'number' ? pending.slice(0, limit) : pending
    },
    async upsert(record) {
      store.set(record.lineEventId, record)
    },
  }
}
