import { markDraftSent, supersedeDraft } from '../domain/draft-lifecycle'
import { buildDraftContext } from '../process/build-draft-context'
import type { Conversation, ConversationDraft } from '../types'
import type { DraftStore } from '../storage/draft-store'

function defaultDraftIdFactory() {
  return `draft:${Date.now()}`
}

function buildDraftText(conversation: Conversation): string {
  const context = buildDraftContext(conversation)
  const attractionSentence =
    context.attractionsSummary === '景點待確認'
      ? '想玩的景點我再幫你一起整理'
      : `目前看起來你們想去 ${context.attractionsSummary}`

  return `${context.customerName}你好！看起來是 ${context.travelDates ?? '日期待確認'}、${context.peopleSummary} 的安排，${attractionSentence}。如果方便的話，我可以先幫你把包車方向整理好，價格我會抓大致範圍再跟你說，汽座我這邊也會一起先幫你注意。`
}

export async function generateDraftForConversation(
  conversation: Conversation,
  options: {
    draftStore: DraftStore
    now?: string
    draftIdFactory?: () => string
  }
): Promise<ConversationDraft> {
  const existingPendingDraft = await options.draftStore.getPendingByConversationId(conversation.id)

  if (existingPendingDraft) {
    await options.draftStore.upsert(supersedeDraft(existingPendingDraft))
  }

  const draft: ConversationDraft = {
    id: (options.draftIdFactory ?? defaultDraftIdFactory)(),
    conversationId: conversation.id,
    createdAt: options.now ?? new Date().toISOString(),
    createdFromEventId:
      conversation.lastProcessedLineEventId ?? conversation.latestInquiry.sourceEventId,
    status: 'pending',
    originalDraft: buildDraftText(conversation),
  }

  await options.draftStore.upsert(draft)
  return draft
}

export { markDraftSent }
