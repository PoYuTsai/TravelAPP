import { randomUUID } from 'crypto'
import type {
  Conversation,
  ConversationContentType,
  DraftTextGenerator,
  ConversationMessage,
  InboundLineEventRecord,
} from '../types'
import { createMemoryConversationStore, type ConversationStore } from '../storage/conversation-store'
import { createMemoryDraftStore, type DraftStore } from '../storage/draft-store'
import {
  createMemoryTelegramActionStore,
  type TelegramActionStore,
} from '../storage/telegram-action-store'
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
  telegramActionStore?: TelegramActionStore
  topicMapper?: TopicMapper
  telegramClient?: TelegramClient
  draftTextGenerator?: DraftTextGenerator
  resolveProfile?: (lineUserId: string) => Promise<LineProfileResolverResult | null>
}

const defaultConversationStore = createMemoryConversationStore()
const defaultDraftStore = createMemoryDraftStore()
const defaultTelegramActionStore = createMemoryTelegramActionStore()
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

function buildDraftActionToken(): string {
  return randomUUID().replace(/-/g, '').slice(0, 24)
}

function buildDraftActionPromptText(draftText: string): string {
  const trimmedDraft = draftText.trim()
  const preview = trimmedDraft.length > 500 ? `${trimmedDraft.slice(0, 500)}...` : trimmedDraft
  return ['📝 AI 草稿已準備好', preview].filter(Boolean).join('\n\n')
}

export async function processInboundEvent(
  record: InboundLineEventRecord,
  dependencies: ProcessInboundEventDependencies = {}
): Promise<{ conversationId: string; topicId: string; draftId: string }> {
  const conversationStore = dependencies.conversationStore ?? defaultConversationStore
  const draftStore = dependencies.draftStore ?? defaultDraftStore
  const telegramActionStore = dependencies.telegramActionStore ?? defaultTelegramActionStore
  const topicMapper = dependencies.topicMapper ?? defaultTopicMapper
  const telegramClient = dependencies.telegramClient ?? defaultTelegramClient
  const draftTextGenerator = dependencies.draftTextGenerator
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
    draftTextGenerator,
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
  const sendToken = buildDraftActionToken()
  const dismissToken = buildDraftActionToken()

  await telegramActionStore.upsert({
    token: sendToken,
    action: {
      actionId: `${draft.id}:send`,
      type: 'send',
      conversationId: nextConversation.id,
      draftId: draft.id,
      lineUserId: nextConversation.lineUserId,
      receivedAt: record.receivedAt,
      tgTopicId: topicId,
    },
    createdAt: record.receivedAt,
  })
  await telegramActionStore.upsert({
    token: dismissToken,
    action: {
      actionId: `${draft.id}:dismiss`,
      type: 'dismiss',
      conversationId: nextConversation.id,
      draftId: draft.id,
      lineUserId: nextConversation.lineUserId,
      receivedAt: record.receivedAt,
      tgTopicId: topicId,
    },
    createdAt: record.receivedAt,
  })

  await telegramClient.sendTopicActionPrompt(topicId, buildDraftActionPromptText(draft.originalDraft), [
    { text: '✅ 送出', callbackData: `la:${sendToken}` },
    { text: '🗑️ 略過', callbackData: `la:${dismissToken}` },
  ])

  return {
    conversationId: nextConversation.id,
    topicId,
    draftId: draft.id,
  }
}
