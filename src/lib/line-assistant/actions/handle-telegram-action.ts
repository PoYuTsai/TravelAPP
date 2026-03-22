import { createMemoryAuditLog, type AuditLog } from '../audit-log'
import { markDraftSent } from '../ai/generate-draft'
import { getLineAssistantRuntime } from '../runtime'
import { createMemoryConversationStore, type ConversationStore } from '../storage/conversation-store'
import { createMemoryDraftStore, type DraftStore } from '../storage/draft-store'
import {
  buildIdempotencyKey,
  createMemoryIdempotencyStore,
  type IdempotencyStore,
} from '../storage/idempotency-store'
import { createLineMessageSender, type LineMessageSender } from '../line/send-message'
import type { Conversation, ConversationDraft, TelegramAction } from '../types'

export interface HandleTelegramActionDependencies {
  conversationStore?: ConversationStore
  draftStore?: DraftStore
  idempotencyStore?: IdempotencyStore
  lineSender?: LineMessageSender
  auditLog?: AuditLog
  now?: () => string
}

const defaultConversationStore = createMemoryConversationStore()
const defaultDraftStore = createMemoryDraftStore()
const defaultIdempotencyStore = createMemoryIdempotencyStore()
const defaultAuditLog = createMemoryAuditLog()

let runtimeOverrides: HandleTelegramActionDependencies = {}

function getDependencies(
  overrides: HandleTelegramActionDependencies = {}
): Required<HandleTelegramActionDependencies> {
  let runtime: Partial<ReturnType<typeof getLineAssistantRuntime>> = {}
  try {
    runtime = getLineAssistantRuntime()
  } catch {
    runtime = {}
  }

  return {
    conversationStore:
      overrides.conversationStore ??
      runtimeOverrides.conversationStore ??
      runtime.conversationStore ??
      defaultConversationStore,
    draftStore:
      overrides.draftStore ??
      runtimeOverrides.draftStore ??
      runtime.draftStore ??
      defaultDraftStore,
    idempotencyStore:
      overrides.idempotencyStore ??
      runtimeOverrides.idempotencyStore ??
      runtime.idempotencyStore ??
      defaultIdempotencyStore,
    lineSender:
      overrides.lineSender ??
      runtimeOverrides.lineSender ??
      runtime.lineSender ??
      createLineMessageSender(),
    auditLog:
      overrides.auditLog ??
      runtimeOverrides.auditLog ??
      runtime.auditLog ??
      defaultAuditLog,
    now: overrides.now ?? runtimeOverrides.now ?? (() => new Date().toISOString()),
  }
}

function buildAuditId(actionId: string, outcome: string): string {
  return `${actionId}:${outcome}`
}

async function appendAuditLog(
  auditLog: AuditLog,
  action: TelegramAction,
  outcome: 'sent' | 'dismissed' | 'duplicate' | 'failed',
  createdAt: string,
  detail?: string
): Promise<void> {
  await auditLog.append({
    id: buildAuditId(action.actionId, outcome),
    actionId: action.actionId,
    conversationId: action.conversationId,
    draftId: action.draftId,
    lineUserId: action.lineUserId,
    outcome,
    createdAt,
    detail,
    telegramUserId: action.telegramUserId,
    telegramMessageId: action.telegramMessageId,
  })
}

function buildSentConversationMessage(
  action: TelegramAction,
  draft: ConversationDraft,
  content: string,
  sentAt: string
) {
  return {
    id: `${action.actionId}:line-send`,
    source: 'telegram' as const,
    role: 'eric' as const,
    content,
    contentType: 'text' as const,
    timestamp: sentAt,
    wasAiGenerated: true,
    wasEdited: Boolean(draft.editedDraft),
    originalDraft: draft.originalDraft,
    telegramMessageId: action.telegramMessageId,
  }
}

function resolveDraftText(action: TelegramAction, draft: ConversationDraft): string {
  if (action.type === 'edit_then_send') {
    return action.editedText?.trim() || draft.editedDraft || draft.originalDraft
  }

  return draft.editedDraft || draft.originalDraft
}

async function loadConversationOrThrow(
  conversationStore: ConversationStore,
  action: TelegramAction
): Promise<Conversation> {
  const conversation = await conversationStore.getByLineUserId(action.lineUserId)
  if (!conversation || conversation.id !== action.conversationId) {
    throw new Error(`Conversation not found for ${action.lineUserId}`)
  }
  return conversation
}

async function loadDraftOrThrow(draftStore: DraftStore, action: TelegramAction): Promise<ConversationDraft> {
  const draft = await draftStore.getById(action.draftId)
  if (!draft || draft.conversationId !== action.conversationId) {
    throw new Error(`Draft not found for ${action.draftId}`)
  }
  return draft
}

export async function handleTelegramAction(
  action: TelegramAction,
  overrides: HandleTelegramActionDependencies = {}
): Promise<{ status: 'sent' | 'dismissed' | 'duplicate' }> {
  const deps = getDependencies(overrides)
  const idempotencyKey = buildIdempotencyKey('telegram-action', action.actionId)
  const createdAt = deps.now()
  const claimed = await deps.idempotencyStore.claim(idempotencyKey, 86400)

  if (!claimed) {
    await appendAuditLog(deps.auditLog, action, 'duplicate', createdAt)
    return { status: 'duplicate' }
  }

  const conversation = await loadConversationOrThrow(deps.conversationStore, action)
  const draft = await loadDraftOrThrow(deps.draftStore, action)

  if (action.type === 'dismiss') {
    const dismissedDraft: ConversationDraft = {
      ...draft,
      status: 'dismissed',
      actionId: action.actionId,
    }
    const nextConversation: Conversation = {
      ...conversation,
      pendingDraftId:
        conversation.pendingDraftId === draft.id ? null : conversation.pendingDraftId,
      lastActivityAt: createdAt,
    }

    await deps.draftStore.upsert(dismissedDraft)
    await deps.conversationStore.upsert(nextConversation)
    await appendAuditLog(deps.auditLog, action, 'dismissed', createdAt)
    return { status: 'dismissed' }
  }

  const text = resolveDraftText(action, draft)
  const draftForSend =
    action.type === 'edit_then_send'
      ? {
          ...draft,
          editedDraft: text,
        }
      : draft

  try {
    await deps.lineSender.sendTextMessage({
      lineUserId: action.lineUserId,
      text,
    })
  } catch (error) {
    await deps.draftStore.upsert({
      ...draftForSend,
      status: 'failed',
      actionId: action.actionId,
    })
    await appendAuditLog(
      deps.auditLog,
      action,
      'failed',
      createdAt,
      error instanceof Error ? error.message : String(error)
    )
    throw error
  }

  const sentDraft = markDraftSent(draftForSend, {
    actionId: action.actionId,
    sentAt: createdAt,
  })
  const nextConversation: Conversation = {
    ...conversation,
    status: 'waiting_customer',
    pendingDraftId: conversation.pendingDraftId === draft.id ? null : conversation.pendingDraftId,
    lastActivityAt: createdAt,
    messages: [
      ...conversation.messages,
      buildSentConversationMessage(action, draftForSend, text, createdAt),
    ],
  }

  await deps.draftStore.upsert(sentDraft)
  await deps.conversationStore.upsert(nextConversation)
  await appendAuditLog(deps.auditLog, action, 'sent', createdAt)

  return { status: 'sent' }
}

export function configureTelegramActionRuntimeForTests(
  overrides: HandleTelegramActionDependencies
): void {
  runtimeOverrides = overrides
}

export function resetTelegramActionRuntimeForTests(): void {
  runtimeOverrides = {}
}
