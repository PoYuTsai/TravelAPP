import type { AuditLog, LineAssistantAuditEntry } from '../audit-log'
import type { TopicMapper } from '../telegram/topic-mapper'
import type { ConversationStore } from './conversation-store'
import type { DraftStore } from './draft-store'
import type { IdempotencyStore } from './idempotency-store'
import type { InboundEventStore } from './inbound-event-store'
import type { Conversation, ConversationDraft, InboundLineEventRecord } from '../types'
import { createUpstashRestClient } from './upstash-rest'

type FetchLike = typeof fetch

const PREFIXES = {
  conversation: 'la:conversation:',
  draft: 'la:draft:',
  inbound: 'la:inbound:',
  audit: 'la:audit:',
  topic: 'la:topic:',
  topicLock: 'la:topic-lock:',
} as const

function buildKey(prefix: string, id: string): string {
  return `${prefix}${id}`
}

export function createKvLineAssistantStores(input: {
  baseUrl: string
  token: string
  createTopic?: (title: string) => Promise<string>
  fetchImpl?: FetchLike
}): {
  conversationStore: ConversationStore
  draftStore: DraftStore
  inboundEventStore: InboundEventStore
  idempotencyStore: IdempotencyStore
  auditLog: AuditLog
  topicMapper: TopicMapper
} {
  const client = createUpstashRestClient(input)

  const conversationStore: ConversationStore = {
    async getByLineUserId(lineUserId) {
      return client.getJson<Conversation>(buildKey(PREFIXES.conversation, lineUserId))
    },
    async upsert(conversation) {
      await client.setJson(buildKey(PREFIXES.conversation, conversation.lineUserId), conversation)
    },
    async delete(lineUserId) {
      await client.delete(buildKey(PREFIXES.conversation, lineUserId))
    },
    async list() {
      const keys = await client.scanKeys(PREFIXES.conversation)
      return client.mgetJson<Conversation>(keys)
    },
  }

  const draftStore: DraftStore = {
    async getById(id) {
      return client.getJson<ConversationDraft>(buildKey(PREFIXES.draft, id))
    },
    async list() {
      const keys = await client.scanKeys(PREFIXES.draft)
      return client.mgetJson<ConversationDraft>(keys)
    },
    async listByConversationId(conversationId) {
      const drafts = await this.list()
      return drafts.filter((draft) => draft.conversationId === conversationId)
    },
    async getPendingByConversationId(conversationId) {
      const drafts = await this.listByConversationId(conversationId)
      return drafts.find((draft) => draft.status === 'pending') ?? null
    },
    async upsert(draft) {
      await client.setJson(buildKey(PREFIXES.draft, draft.id), draft)
    },
  }

  const inboundEventStore: InboundEventStore = {
    async getByLineEventId(lineEventId) {
      return client.getJson<InboundLineEventRecord>(buildKey(PREFIXES.inbound, lineEventId))
    },
    async list() {
      const keys = await client.scanKeys(PREFIXES.inbound)
      return client.mgetJson<InboundLineEventRecord>(keys)
    },
    async listPending(limit) {
      const events = (await this.list()).filter(
        (record) => record.status === 'received' || record.status === 'failed'
      )
      return typeof limit === 'number' ? events.slice(0, limit) : events
    },
    async upsert(record) {
      await client.setJson(buildKey(PREFIXES.inbound, record.lineEventId), record)
    },
  }

  const idempotencyStore: IdempotencyStore = {
    async has(key) {
      return (await client.getText(key)) !== null
    },
    async markProcessed(key, ttlSeconds = 3600) {
      await client.setText(key, '1', ttlSeconds)
    },
    async claim(key, ttlSeconds = 3600) {
      return client.claim(key, ttlSeconds)
    },
  }

  const auditLog: AuditLog = {
    async append(entry: LineAssistantAuditEntry) {
      await client.setJson(buildKey(PREFIXES.audit, entry.id), entry)
    },
    async list() {
      const keys = await client.scanKeys(PREFIXES.audit)
      return client.mgetJson<LineAssistantAuditEntry>(keys)
    },
  }

  const topicMapper: TopicMapper = {
    async ensureTopicForLineUser(lineUserId, title) {
      const key = buildKey(PREFIXES.topic, lineUserId)
      const existing = await client.getText(key)
      if (existing) {
        return existing
      }

      const lockKey = buildKey(PREFIXES.topicLock, lineUserId)
      const claimed = await client.claim(lockKey, 30)

      if (!claimed) {
        const pending = await client.getText(key)
        if (pending) {
          return pending
        }

        throw new Error(`Telegram topic creation already in progress for ${lineUserId}`)
      }

      try {
        const topicId = input.createTopic
          ? await input.createTopic(title)
          : `topic:${lineUserId}`

        await client.setText(key, topicId)
        return topicId
      } finally {
        await client.delete(lockKey)
      }
    },
    async getTopicIdForLineUser(lineUserId) {
      return client.getText(buildKey(PREFIXES.topic, lineUserId))
    },
  }

  return {
    conversationStore,
    draftStore,
    inboundEventStore,
    idempotencyStore,
    auditLog,
    topicMapper,
  }
}
