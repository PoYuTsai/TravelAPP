export type QuotePaymentState =
  | 'draft'
  | 'payment_ready'
  | 'payment_pending'
  | 'paid'
  | 'expired'

export interface QuotePayment {
  state: QuotePaymentState
  depositAmountTWD: number
  depositLabel: string
  provider: 'ecpay'
  tradeNo: string | null
  paymentUrl: string | null
  createdAt: string | null
  expiresAt: string | null
  paidAt: string | null
  orderNo: string | null
}

interface RawQuotePaymentFields {
  paymentState?: unknown
  depositAmountTWD?: unknown
  depositLabel?: unknown
  paymentProvider?: unknown
  paymentTradeNo?: unknown
  paymentUrl?: unknown
  paymentCreatedAt?: unknown
  paymentExpiresAt?: unknown
  paymentPaidAt?: unknown
  orderNo?: unknown
}

function normalizeState(value: unknown): QuotePaymentState {
  switch (value) {
    case 'payment_ready':
    case 'payment_pending':
    case 'paid':
    case 'expired':
    case 'draft':
      return value
    default:
      return 'draft'
  }
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

export function normalizeQuotePayment(
  fields: RawQuotePaymentFields
): QuotePayment {
  return {
    state: normalizeState(fields.paymentState),
    depositAmountTWD:
      typeof fields.depositAmountTWD === 'number' &&
      Number.isFinite(fields.depositAmountTWD)
        ? fields.depositAmountTWD
        : 0,
    depositLabel:
      typeof fields.depositLabel === 'string' && fields.depositLabel.trim()
        ? fields.depositLabel.trim()
        : '服務訂金',
    provider: 'ecpay',
    tradeNo: normalizeString(fields.paymentTradeNo),
    paymentUrl: normalizeString(fields.paymentUrl),
    createdAt: normalizeString(fields.paymentCreatedAt),
    expiresAt: normalizeString(fields.paymentExpiresAt),
    paidAt: normalizeString(fields.paymentPaidAt),
    orderNo: normalizeString(fields.orderNo),
  }
}

export function isQuotePaymentExpired(
  payment: Pick<QuotePayment, 'state' | 'expiresAt'>,
  now = new Date()
): boolean {
  if (payment.state === 'paid' || !payment.expiresAt) return false

  const expiresAt = new Date(payment.expiresAt)
  if (Number.isNaN(expiresAt.getTime())) return false

  return expiresAt.getTime() <= now.getTime()
}

export function getQuotePaymentStatusLabel(
  state: QuotePaymentState
): string {
  switch (state) {
    case 'payment_ready':
      return '可支付訂金'
    case 'payment_pending':
      return '等待付款確認'
    case 'paid':
      return '已收到訂金'
    case 'expired':
      return '付款已逾期'
    case 'draft':
    default:
      return '尚未開放付款'
  }
}
