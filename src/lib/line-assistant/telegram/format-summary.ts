import type { CustomerInquiry } from '../types'

function formatPeopleSummary(inquiry: CustomerInquiry): string {
  const adults = inquiry.adults ? `${inquiry.adults}大` : '未提供成人數'
  const children = inquiry.children ? `${inquiry.children}小` : null
  return [adults, children].filter(Boolean).join('')
}

export function formatTelegramInquirySummary(input: {
  customerName: string
  inquiry: CustomerInquiry
  rawMessage: string
}): string {
  const lines = [
    `👤 ${input.customerName}`,
    `📅 ${input.inquiry.travelDates ?? '日期待確認'}`,
    `👨‍👩‍👧‍👦 ${formatPeopleSummary(input.inquiry)}`,
  ]

  if (input.inquiry.attractions.length > 0) {
    lines.push(`📍 ${input.inquiry.attractions.join('、')}`)
  }

  lines.push(`📝 ${input.rawMessage}`)

  return lines.join('\n')
}
