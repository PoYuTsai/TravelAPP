import { buildIdempotencyKey } from '../storage/idempotency-store'
import { getLineAssistantRuntime, resetLineAssistantRuntimeForTests } from '../runtime'
import type { InboundLineEventRecord } from '../types'
import { normalizeLineMessageEvents } from '../line/normalize-event'

let ingestedRecordsSnapshot: InboundLineEventRecord[] = []

export async function ingestLineEvents(rawBody: string): Promise<{
  acceptedCount: number
  ignoredCount: number
  records: InboundLineEventRecord[]
}> {
  const runtime = getLineAssistantRuntime()
  const payload = JSON.parse(rawBody) as unknown
  const normalizedEvents = normalizeLineMessageEvents(payload)
  const records: InboundLineEventRecord[] = []

  for (const event of normalizedEvents) {
    const idempotencyKey = buildIdempotencyKey('line-event', event.lineEventId)
    const claimed = await runtime.idempotencyStore.claim(idempotencyKey, 3600)

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

    await runtime.inboundEventStore.upsert(record)
    records.push(record)
  }

  ingestedRecordsSnapshot = records

  return {
    acceptedCount: records.length,
    ignoredCount: normalizedEvents.length - records.length,
    records,
  }
}

export function getIngestedLineEventRecords(): InboundLineEventRecord[] {
  return [...ingestedRecordsSnapshot]
}

export async function getIngestedLineEventRecordsAsync(): Promise<InboundLineEventRecord[]> {
  return getLineAssistantRuntime().inboundEventStore.list()
}

export function resetIngestedLineEvents(): void {
  ingestedRecordsSnapshot = []
  resetLineAssistantRuntimeForTests()
}
