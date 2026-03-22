import { buildIdempotencyKey } from '../storage/idempotency-store'
import type { LineAssistantRuntime } from '../runtime'
import type { InboundLineEventRecord } from '../types'
import { processInboundEvent } from './process-inbound-event'

export interface ProcessPendingInboundEventsResult {
  processedCount: number
  failedCount: number
}

function buildFailureReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function markEvent(
  runtime: Pick<LineAssistantRuntime, 'inboundEventStore'>,
  record: InboundLineEventRecord
): Promise<void> {
  await runtime.inboundEventStore.upsert(record)
}

export async function processPendingInboundEvents(
  runtime: Pick<
    LineAssistantRuntime,
    | 'inboundEventStore'
    | 'conversationStore'
    | 'draftStore'
    | 'idempotencyStore'
    | 'topicMapper'
    | 'telegramClient'
    | 'resolveProfile'
  > & { limit?: number }
): Promise<ProcessPendingInboundEventsResult> {
  const pendingEvents = await runtime.inboundEventStore.listPending(runtime.limit)
  let processedCount = 0
  let failedCount = 0

  for (const event of pendingEvents) {
    const processingKey = buildIdempotencyKey('line-event-processing', event.lineEventId)
    const claimed = await runtime.idempotencyStore.claim(processingKey, 300)

    if (!claimed) {
      continue
    }

    await markEvent(runtime, {
      ...event,
      status: 'processing',
    })

    try {
      await processInboundEvent(event, {
        conversationStore: runtime.conversationStore,
        draftStore: runtime.draftStore,
        topicMapper: runtime.topicMapper,
        telegramClient: runtime.telegramClient,
        resolveProfile: runtime.resolveProfile,
      })

      await markEvent(runtime, {
        ...event,
        status: 'processed',
        processedAt: new Date().toISOString(),
        failureReason: undefined,
      })
      processedCount += 1
    } catch (error) {
      await markEvent(runtime, {
        ...event,
        status: 'failed',
        failureReason: buildFailureReason(error),
      })
      failedCount += 1
    }
  }

  return {
    processedCount,
    failedCount,
  }
}
