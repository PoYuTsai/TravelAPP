import type { ConversationDraft, TelegramActionContext } from '../types'

export function supersedeDraft(draft: ConversationDraft): ConversationDraft {
  if (draft.status !== 'pending') {
    return draft
  }

  return {
    ...draft,
    status: 'superseded',
  }
}

export function markDraftSent(
  draft: ConversationDraft,
  context: TelegramActionContext
): ConversationDraft {
  const nextStatus = draft.editedDraft ? 'edited_then_sent' : 'sent'

  return {
    ...draft,
    status: nextStatus,
    actionId: context.actionId,
    sentAt: context.sentAt,
  }
}
