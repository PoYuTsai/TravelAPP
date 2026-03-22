import { fetchAllNotionOrdersFlat } from '@/lib/notion/client'
import type { NotionOrder } from '@/lib/notion/types'
import { buildReturningCustomerHint } from '../domain/returning-customer'
import type { ReturningCustomerHint } from '../types'

function normalizeCustomerName(value: string): string {
  return value.replace(/\s+/g, '').trim().toLowerCase()
}

function extractTravelMonth(rawTravelDates: string | null): number | null {
  if (!rawTravelDates) return null
  const match = rawTravelDates.match(/(\d{1,2})\/\d{1,2}/)
  return match ? Number(match[1]) : null
}

function scoreOrderMatch(input: {
  customerName: string
  rawMessage: string
  travelDates: string | null
  order: NotionOrder
}): number {
  const normalizedInputName = normalizeCustomerName(input.customerName)
  const normalizedOrderName = normalizeCustomerName(input.order.customerName)

  let score = 0

  if (normalizedInputName && normalizedInputName === normalizedOrderName) {
    score += 0.85
  } else if (
    normalizedInputName &&
    normalizedOrderName &&
    (normalizedInputName.includes(normalizedOrderName) ||
      normalizedOrderName.includes(normalizedInputName))
  ) {
    score += 0.7
  }

  const inputMonth = extractTravelMonth(input.travelDates)
  const orderMonth = input.order.travelDate?.start
    ? Number(input.order.travelDate.start.split('-')[1])
    : null

  if (inputMonth && orderMonth && inputMonth === orderMonth) {
    score += 0.1
  }

  if (input.order.travelers && input.rawMessage.includes(input.order.travelers)) {
    score += 0.05
  }

  return Math.min(score, 1)
}

export async function matchReturningCustomer(
  inquiry: {
    customerName: string
    rawMessage: string
    travelDates: string | null
  },
  options: {
    hasSeenBeforeInSystem: boolean
    fetchOrders?: () => Promise<NotionOrder[]>
  }
): Promise<ReturningCustomerHint> {
  const fetchOrders = options.fetchOrders ?? fetchAllNotionOrdersFlat
  const orders = await fetchOrders()

  const matches = orders
    .map((order) => ({
      recordId: order.id,
      score: scoreOrderMatch({
        customerName: inquiry.customerName,
        rawMessage: inquiry.rawMessage,
        travelDates: inquiry.travelDates,
        order,
      }),
      inquiryDate: order.travelDate?.start,
    }))
    .filter((match) => match.score >= 0.6)

  return buildReturningCustomerHint({
    hasSeenBeforeInSystem: options.hasSeenBeforeInSystem,
    matches,
  })
}
