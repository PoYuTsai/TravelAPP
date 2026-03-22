import type { AuditLog } from '../audit-log'
import type { ConversationStore } from '../storage/conversation-store'
import type { DraftStore } from '../storage/draft-store'

export interface DailySummaryResult {
  generatedAt: string
  activeConversations: number
  waitingEricCount: number
  waitingCustomerCount: number
  coldCount: number
  archivedCount: number
  pendingDraftCount: number
  sentTodayCount: number
  duplicateActionCount: number
  summaryText: string
}

export async function buildDailySummary(options: {
  conversationStore: ConversationStore
  draftStore: DraftStore
  auditLog: AuditLog
  now?: string
}): Promise<DailySummaryResult> {
  const generatedAt = options.now ?? new Date().toISOString()
  const [conversations, drafts, auditEntries] = await Promise.all([
    options.conversationStore.list(),
    options.draftStore.list(),
    options.auditLog.list(),
  ])

  const waitingEricCount = conversations.filter((conversation) => conversation.status === 'waiting_eric').length
  const waitingCustomerCount = conversations.filter((conversation) => conversation.status === 'waiting_customer').length
  const coldCount = conversations.filter((conversation) => conversation.status === 'cold').length
  const archivedCount = conversations.filter((conversation) => conversation.status === 'archived').length
  const pendingDraftCount = drafts.filter((draft) => draft.status === 'pending').length
  const sentTodayCount = auditEntries.filter((entry) => entry.outcome === 'sent').length
  const duplicateActionCount = auditEntries.filter((entry) => entry.outcome === 'duplicate').length

  return {
    generatedAt,
    activeConversations: conversations.filter((conversation) => conversation.status !== 'deleted').length,
    waitingEricCount,
    waitingCustomerCount,
    coldCount,
    archivedCount,
    pendingDraftCount,
    sentTodayCount,
    duplicateActionCount,
    summaryText: [
      `Active conversations: ${conversations.filter((conversation) => conversation.status !== 'deleted').length}`,
      `Waiting Eric: ${waitingEricCount}`,
      `Waiting customer: ${waitingCustomerCount}`,
      `Cold: ${coldCount}`,
      `Archived: ${archivedCount}`,
      `Pending drafts: ${pendingDraftCount}`,
      `Sent today: ${sentTodayCount}`,
      `Duplicate callbacks blocked: ${duplicateActionCount}`,
    ].join('\n'),
  }
}
