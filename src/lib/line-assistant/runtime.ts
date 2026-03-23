import { createMemoryAuditLog, type AuditLog } from './audit-log'
import { createAnthropicDraftTextGenerator } from './ai/anthropic'
import { getLineAssistantConfig } from './config'
import { createLineMessageSender, type LineMessageSender } from './line/send-message'
import { type LineProfileResolverResult } from './process/process-inbound-event'
import { createMemoryConversationStore, type ConversationStore } from './storage/conversation-store'
import { createMemoryDraftStore, type DraftStore } from './storage/draft-store'
import { createMemoryIdempotencyStore, type IdempotencyStore } from './storage/idempotency-store'
import { createMemoryInboundEventStore, type InboundEventStore } from './storage/inbound-event-store'
import { createKvLineAssistantStores } from './storage/kv-stores'
import {
  createMemoryTelegramClient,
  createTelegramBotClient,
  type TelegramClient,
} from './telegram/client'
import { createMemoryTopicMapper, type TopicMapper } from './telegram/topic-mapper'
import type { DraftTextGenerator, LineAssistantConfig } from './types'

export interface LineAssistantRuntime {
  conversationStore: ConversationStore
  draftStore: DraftStore
  inboundEventStore: InboundEventStore
  idempotencyStore: IdempotencyStore
  topicMapper: TopicMapper
  telegramClient: TelegramClient
  auditLog: AuditLog
  lineSender: LineMessageSender
  draftTextGenerator?: DraftTextGenerator
  resolveProfile?: (lineUserId: string) => Promise<LineProfileResolverResult | null>
}

export interface LineAssistantRuntimeOverrides extends Partial<LineAssistantRuntime> {}

let runtimeOverrides: LineAssistantRuntimeOverrides = {}
let memoryRuntime: LineAssistantRuntime | null = null
let configuredRuntime: LineAssistantRuntime | null = null
let configuredRuntimeKey: string | null = null

function createDefaultMemoryRuntime(): LineAssistantRuntime {
  return {
    conversationStore: createMemoryConversationStore(),
    draftStore: createMemoryDraftStore(),
    inboundEventStore: createMemoryInboundEventStore(),
    idempotencyStore: createMemoryIdempotencyStore(),
    topicMapper: createMemoryTopicMapper(),
    telegramClient: createMemoryTelegramClient(),
    auditLog: createMemoryAuditLog(),
    lineSender: createLineMessageSender(),
  }
}

export function createLineAssistantRuntime(input: {
  config: LineAssistantConfig
  fetchImpl?: typeof fetch
}): LineAssistantRuntime {
  const draftTextGenerator = input.config.anthropic.apiKey
    ? createAnthropicDraftTextGenerator({
        apiKey: input.config.anthropic.apiKey,
        fetchImpl: input.fetchImpl,
      })
    : undefined

  if (
    input.config.storage.mode === 'kv' &&
    input.config.storage.kvRestApiUrl &&
    input.config.storage.kvRestApiToken
  ) {
    const telegramClient = createTelegramBotClient({
      botToken: input.config.telegram.botToken,
      groupId: input.config.telegram.groupId,
      fetchImpl: input.fetchImpl,
    })

    const kvStores = createKvLineAssistantStores({
      baseUrl: input.config.storage.kvRestApiUrl,
      token: input.config.storage.kvRestApiToken,
      createTopic: (title: string) => telegramClient.createForumTopic(title),
      fetchImpl: input.fetchImpl,
    })

    return {
      ...kvStores,
      telegramClient,
      lineSender: createLineMessageSender(),
      draftTextGenerator,
    }
  }

  return {
    ...createDefaultMemoryRuntime(),
    draftTextGenerator,
  }
}

function buildRuntimeKey(config: LineAssistantConfig): string {
  return JSON.stringify({
    storageMode: config.storage.mode,
    kvRestApiUrl: config.storage.kvRestApiUrl,
  })
}

export function getLineAssistantRuntime(): LineAssistantRuntime {
  let config: LineAssistantConfig | null = null

  try {
    config = getLineAssistantConfig(process.env)
  } catch {
    if (Object.keys(runtimeOverrides).length > 0) {
      return {
        ...createDefaultMemoryRuntime(),
        ...runtimeOverrides,
      }
    }
    throw new Error('LINE assistant runtime is not configured')
  }

  const runtimeKey = buildRuntimeKey(config)

  if (!configuredRuntime || configuredRuntimeKey !== runtimeKey) {
    configuredRuntime = createLineAssistantRuntime({ config })
    configuredRuntimeKey = runtimeKey
  }

  const baseRuntime =
    config.storage.mode === 'memory'
      ? memoryRuntime ?? (memoryRuntime = configuredRuntime)
      : configuredRuntime

  return {
    ...baseRuntime,
    ...runtimeOverrides,
  }
}

export function configureLineAssistantRuntimeForTests(
  overrides: LineAssistantRuntimeOverrides
): void {
  runtimeOverrides = overrides
}

export function resetLineAssistantRuntimeForTests(): void {
  runtimeOverrides = {}
  memoryRuntime = null
  configuredRuntime = null
  configuredRuntimeKey = null
}
