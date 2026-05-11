import { describe, expect, it } from 'vitest'

import {
  buildPrepareQuotePaymentPatch,
  getPrepareQuotePaymentProblem,
  canManuallyExpireQuotePayment,
} from '@/lib/quote/paymentAdminState'

describe('quote payment admin state helpers', () => {
  it('requires a positive deposit amount before preparing payment', () => {
    expect(
      getPrepareQuotePaymentProblem({
        depositAmountTWD: 0,
        paymentExpiresAt: '2026-05-12T10:00:00.000Z',
        paymentState: 'draft',
      })
    ).toBe('請先設定有效的訂金金額。')
  })

  it('requires an expiry time before preparing payment', () => {
    expect(
      getPrepareQuotePaymentProblem({
        depositAmountTWD: 4000,
        paymentExpiresAt: null,
        paymentState: 'draft',
      })
    ).toBe('請先設定付款期限。')
  })

  it('blocks preparing a quote that is already paid', () => {
    expect(
      getPrepareQuotePaymentProblem({
        depositAmountTWD: 4000,
        paymentExpiresAt: '2026-05-12T10:00:00.000Z',
        paymentState: 'paid',
      })
    ).toBe('這張報價單已完成付款，若要重新收款請先人工確認。')
  })

  it('builds a ready-state patch and reuses an existing order number', () => {
    const patch = buildPrepareQuotePaymentPatch(
      {
        depositAmountTWD: 4000,
        paymentExpiresAt: '2026-05-12T10:00:00.000Z',
        paymentState: 'draft',
        orderNo: 'CW-20260511-A1B2',
      },
      new Date('2026-05-11T10:00:00.000Z')
    )

    expect(patch).toEqual({
      orderNo: 'CW-20260511-A1B2',
      paymentState: 'payment_ready',
      paymentProvider: 'ecpay',
      paymentTradeNo: null,
      paymentUrl: null,
      paymentCreatedAt: null,
      paymentPaidAt: null,
    })
  })

  it('builds a ready-state patch with a generated order number when missing', () => {
    const patch = buildPrepareQuotePaymentPatch(
      {
        depositAmountTWD: 4000,
        paymentExpiresAt: '2026-05-12T10:00:00.000Z',
        paymentState: 'draft',
        orderNo: null,
      },
      new Date('2026-05-11T10:00:00.000Z')
    )

    expect(patch.orderNo).toMatch(/^CW-\d{8}-[A-Z0-9]{4}$/)
    expect(patch.paymentState).toBe('payment_ready')
  })

  it('only allows manual expiry for ready or pending states', () => {
    expect(canManuallyExpireQuotePayment('draft')).toBe(false)
    expect(canManuallyExpireQuotePayment('payment_ready')).toBe(true)
    expect(canManuallyExpireQuotePayment('payment_pending')).toBe(true)
    expect(canManuallyExpireQuotePayment('paid')).toBe(false)
    expect(canManuallyExpireQuotePayment('expired')).toBe(false)
  })
})
