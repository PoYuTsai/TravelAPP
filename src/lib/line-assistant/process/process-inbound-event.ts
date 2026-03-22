import type {
  Conversation,
  ConversationContentType,
  ConversationMessage,
  InboundLineEventRecord,
} from '../types'
import { createMemoryConversationStore, type ConversationStore } from '../storage/conversation-store'
import { createMemoryDraftStore, type DraftStore } from '../storage/draft-store'
import { createMemoryTopicMapper, type TopicMapper } from '../telegram/topic-mapper'
import { createMemoryTelegramClient, type TelegramClient } from '../telegram/client'
import { formatTelegramInquirySummary } from '../telegram/format-summary'
import { extractInquiryFromMessage } from '../ai/extract-inquiry'
import { generateDraftForConversation } from '../ai/generate-draft'
import { reduceConversation } from '../domain/conversation-reducer'

export interface LineProfileResolverResult {
  userId: string
  displayName: string
}

export interface ProcessInboundEventDependencies {
  conversationStore?: ConversationStore
  draftStore?: DraftStore
  topicMapper?: TopicMapper
  telegramClient?: TelegramClient
  resolveProfile?: (lineUserId: string) => Promise<LineProfileResolverResult | null>
}

const defaultConversationStore = createMemoryConversationStore()
const defaultDraftStore = createMemoryDraftStore()
const defaultTopicMapper = createMemoryTopicMapper()
const defaultTelegramClient = createMemoryTelegramClient()

function buildCustomerMessage(record: InboundLineEventRecord): ConversationMessage {
  const rawEvent = (record.payload ?? {}) as {
    message?: { id?: string; type?: string; text?: string }
    timestamp?: number
  }

  const contentType: ConversationContentType =
    rawEvent.message?.type === 'text' ? 'text' : 'system'

  return {
    id: rawEvent.message?.id ?? record.lineEventId,
    source: 'line',
    role: 'customer',
    content: rawEvent.message?.text ?? '',
    contentType,
    timestamp:
      typeof rawEvent.timestamp === 'number'
        ? new Date(rawEvent.timestamp).toISOString()
        : record.receivedAt,
    sourceEventId: record.lineEventId,
  }
}

export async function processInboundEvent(
  record: InboundLineEventRecord,
  dependencies: ProcessInboundEventDependencies = {}
): Promise<{ conversationId: string; topicId: string; draftId: string }> {
  const conversationStore = dependencies.conversationStore ?? defaultConversationStore
  const draftStore = dependencies.draftStore ?? defaultDraftStore
  const topicMapper = dependencies.topicMapper ?? defaultTopicMapper
  const telegramClient = dependencies.telegramClient ?? defaultTelegramClient
  const resolveProfile =
    dependencies.resolveProfile ??
    (async (lineUserId: string) => ({
      userId: lineUserId,
      displayName: 'LINE Customer',
    }))

  const profile = await resolveProfile(record.lineUserId)
  const customerName = profile?.displayName ?? 'LINE Customer'
  const message = buildCustomerMessage(record)
  const rawMessage = message.content
  const inquiry = extractInquiryFromMessage({
    lineUserId: record.lineUserId,
    customerName,
    rawMessage,
    sourceEventId: record.lineEventId,
    timestamp: record.receivedAt,
  })

  const existingConversation = await conversationStore.getByLineUserId(record.lineUserId)

  const nextConversation: Conversation = existingConversation
    ? reduceConversation(existingConversation, {
        type: 'customer_message',
        lineEventId: record.lineEventId,
        occurredAt: record.receivedAt,
        latestInquiry: inquiry,
        message,
      })
    : {
        id: `conv:${record.lineUserId}`,
        lineUserId: record.lineUserId,
        customerName,
        status: 'waiting_eric',
        lastActivityAt: record.receivedAt,
        lastProcessedLineEventId: record.lineEventId,
        pendingDraftId: null,
        latestInquiry: inquiry,
        tgTopicId: null,
        messages: [message],
        metadata: {},
      }

  const topicId = await topicMapper.ensureTopicForLineUser(record.lineUserId, customerName)
  nextConversation.tgTopicId = topicId

  const draft = await generateDraftForConversation(nextConversation, {
    draftStore,
  })
  nextConversation.pendingDraftId = draft.id
  await conversationStore.upsert(nextConversation)
  await telegramClient.sendTopicSummary(
    topicId,
    formatTelegramInquirySummary({
      customerName,
      inquiry,
      rawMessage,
    })
  )

  return {
    conversationId: nextConversation.id,
    topicId,
    draftId: draft.id,
  }
}
