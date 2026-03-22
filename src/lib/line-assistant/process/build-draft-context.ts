import type { Conversation } from '../types'

function buildPeopleSummary(conversation: Conversation): string {
  const adults = conversation.latestInquiry.adults
    ? `${conversation.latestInquiry.adults}大`
    : null
  const children = conversation.latestInquiry.children
    ? `${conversation.latestInquiry.children}小`
    : null
  return [adults, children].filter(Boolean).join('') || '人數待確認'
}

export function buildDraftContext(conversation: Conversation) {
  return {
    customerName: conversation.customerName,
    travelDates: conversation.latestInquiry.travelDates,
    peopleSummary: buildPeopleSummary(conversation),
    attractionsSummary:
      conversation.latestInquiry.attractions.join('、') || '景點待確認',
    specialNeedsSummary:
      conversation.latestInquiry.specialNeeds.join('、') || '無特別需求',
    recentMessages: conversation.messages.slice(-3).map((message) => ({
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    })),
  }
}
