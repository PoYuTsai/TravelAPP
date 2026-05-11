import { buildOrderNo } from '@/lib/payments/orderIds'
import type { QuotePaymentState } from '@/lib/quote/paymentState'

interface PrepareQuotePaymentInput {
  orderNo?: string | null
  depositAmountTWD?: number | null
  paymentExpiresAt?: string | null
  paymentState?: QuotePaymentState | null
}

export function getPrepareQuotePaymentProblem(
  input: PrepareQuotePaymentInput
): string | null {
  if (!input.depositAmountTWD || input.depositAmountTWD <= 0) {
    return '請先設定有效的訂金金額。'
  }

  if (!input.paymentExpiresAt) {
    return '請先設定付款期限。'
  }

  if (input.paymentState === 'paid') {
    return '這張報價單已完成付款，若要重新收款請先人工確認。'
  }

  return null
}

export function buildPrepareQuotePaymentPatch(
  input: PrepareQuotePaymentInput,
  now = new Date()
) {
  return {
    orderNo: input.orderNo?.trim() || buildOrderNo(now),
    paymentState: 'payment_ready',
    paymentProvider: 'ecpay',
    paymentTradeNo: null,
    paymentUrl: null,
    paymentCreatedAt: null,
    paymentPaidAt: null,
  } as const
}

export function canManuallyExpireQuotePayment(state: QuotePaymentState) {
  return state === 'payment_ready' || state === 'payment_pending'
}
