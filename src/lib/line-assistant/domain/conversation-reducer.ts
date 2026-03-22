import type { Conversation, ConversationMessage, CustomerInquiry } from '../types'

type CustomerMessageEvent = {
  type: 'customer_message'
  lineEventId: string
  occurredAt: string
  latestInquiry: CustomerInquiry
  message: ConversationMessage
}

export type ConversationEvent = CustomerMessageEvent

export function reduceConversation(
  state: Conversation,
  event: ConversationEvent
): Conversation {
  switch (event.type) {
    case 'customer_message':
      return {
        ...state,
        customerName: event.latestInquiry.customerName,
        status: 'waiting_eric',
        lastActivityAt: event.occurredAt,
        lastProcessedLineEventId: event.lineEventId,
        pendingDraftId: null,
        latestInquiry: event.latestInquiry,
        messages: [...state.messages, event.message],
      }
    default:
      return state
  }
}
