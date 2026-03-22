import {
  buildIdempotencyKey,
  createMemoryIdempotencyStore,
} from '../storage/idempotency-store'
import type { InboundLineEventRecord } from '../types'
import { normalizeLineMessageEvents } from '../line/normalize-event'

let idempotencyStore = createMemoryIdempotencyStore()
const ingestedRecords = new Map<string, InboundLineEventRecord>()

export async function ingestLineEvents(rawBody: string): Promise<{
  acceptedCount: number
  ignoredCount: number
  records: InboundLineEventRecord[]
}> {
  const payload = JSON.parse(rawBody) as unknown
  const normalizedEvents = normalizeLineMessageEvents(payload)
  const records: InboundLineEventRecord[] = []

  for (const event of normalizedEvents) {
    const idempotencyKey = buildIdempotencyKey('line-event', event.lineEventId)
    const claimed = await idempotencyStore.claim(idempotencyKey, 3600)

    if (!claimed) {
      continue
    }

    const record: InboundLineEventRecord = {
      id: event.lineEventId,
      lineEventId: event.lineEventId,
      lineUserId: event.lineUserId,
      eventType: 'message',
      receivedAt: event.timestamp,
      status: 'received',
      payload: event.rawEvent,
    }

    ingestedRecords.set(record.lineEventId, record)
    records.push(record)
  }

  return {
    acceptedCount: records.length,
    ignoredCount: normalizedEvents.length - records.length,
    records,
  }
}

export function getIngestedLineEventRecords(): InboundLineEventRecord[] {
  return Array.from(ingestedRecords.values())
}

export function resetIngestedLineEvents(): void {
  idempotencyStore = createMemoryIdempotencyStore()
  ingestedRecords.clear()
}
