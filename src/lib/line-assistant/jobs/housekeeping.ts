import type { Conversation } from '../types'
import type { ConversationStore } from '../storage/conversation-store'

export interface HousekeepingResult {
  coldCount: number
  archivedCount: number
  prunedCount: number
  deletedCount: number
}

function getAgeHours(lastActivityAt: string, nowIso: string): number {
  return (Date.parse(nowIso) - Date.parse(lastActivityAt)) / (1000 * 60 * 60)
}

function isConversationPruned(conversation: Conversation): boolean {
  return conversation.messages.every((message) => message.content === '[pruned]')
}

function pruneConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      content: '[pruned]',
      originalDraft: undefined,
    })),
    metadata: {
      ...conversation.metadata,
      cleanupReason: 'stale_prune',
    },
  }
}

export async function runHousekeeping(options: {
  conversationStore: ConversationStore
  now?: string
}): Promise<HousekeepingResult> {
  const now = options.now ?? new Date().toISOString()
  const conversations = await options.conversationStore.list()
  const result: HousekeepingResult = {
    coldCount: 0,
    archivedCount: 0,
    prunedCount: 0,
    deletedCount: 0,
  }

  for (const conversation of conversations) {
    const ageHours = getAgeHours(conversation.lastActivityAt, now)

    if (conversation.status === 'deleted' && ageHours >= 24) {
      await options.conversationStore.delete(conversation.lineUserId)
      result.deletedCount += 1
      continue
    }

    let nextConversation = conversation

    if (
      ageHours >= 24 * 30 &&
      conversation.messages.length > 0 &&
      !isConversationPruned(conversation)
    ) {
      nextConversation = pruneConversation(nextConversation)
      result.prunedCount += 1
    }

    if (
      ageHours >= 24 * 7 &&
      nextConversation.status !== 'archived' &&
      nextConversation.status !== 'deleted' &&
      nextConversation.status !== 'converted'
    ) {
      nextConversation = {
        ...nextConversation,
        status: 'archived',
        metadata: {
          ...nextConversation.metadata,
          archivedAt: nextConversation.metadata.archivedAt ?? now,
          cleanupReason: nextConversation.metadata.cleanupReason ?? 'stale_archive',
        },
      }
      result.archivedCount += 1
    } else if (
      ageHours >= 48 &&
      nextConversation.status === 'waiting_customer'
    ) {
      nextConversation = {
        ...nextConversation,
        status: 'cold',
      }
      result.coldCount += 1
    }

    if (nextConversation !== conversation) {
      await options.conversationStore.upsert(nextConversation)
    }
  }

  return result
}
