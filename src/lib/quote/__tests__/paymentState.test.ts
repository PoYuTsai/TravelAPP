import { describe, expect, it } from 'vitest'

import {
  getQuotePaymentStatusLabel,
  isQuotePaymentExpired,
  normalizeQuotePayment,
} from '@/lib/quote/paymentState'

describe('quote payment state helpers', () => {
  it('defaults missing payment fields to a draft state', () => {
    const payment = normalizeQuotePayment({})

    expect(payment.state).toBe('draft')
    expect(payment.depositAmountTWD).toBe(0)
    expect(payment.depositLabel).toBe('服務訂金')
    expect(payment.provider).toBe('ecpay')
  })

  it('preserves saved payment fields from Sanity documents', () => {
    const payment = normalizeQuotePayment({
      paymentState: 'payment_ready',
      depositAmountTWD: 4000,
      depositLabel: '包車訂金',
      paymentProvider: 'ecpay',
      paymentTradeNo: 'CW123456',
      paymentUrl: 'https://payment.example',
      paymentCreatedAt: '2026-05-11T10:00:00.000Z',
      paymentExpiresAt: '2026-05-12T10:00:00.000Z',
      paymentPaidAt: '2026-05-11T10:30:00.000Z',
      orderNo: 'CW20260511-001',
    })

    expect(payment).toMatchObject({
      state: 'payment_ready',
      depositAmountTWD: 4000,
      depositLabel: '包車訂金',
      provider: 'ecpay',
      tradeNo: 'CW123456',
      paymentUrl: 'https://payment.example',
      createdAt: '2026-05-11T10:00:00.000Z',
      expiresAt: '2026-05-12T10:00:00.000Z',
      paidAt: '2026-05-11T10:30:00.000Z',
      orderNo: 'CW20260511-001',
    })
  })

  it('detects expired payment windows for unpaid quotes', () => {
    expect(
      isQuotePaymentExpired({
        state: 'payment_pending',
        expiresAt: '2026-05-10T10:00:00.000Z',
      }, new Date('2026-05-11T10:00:00.000Z'))
    ).toBe(true)

    expect(
      isQuotePaymentExpired({
        state: 'paid',
        expiresAt: '2026-05-10T10:00:00.000Z',
      }, new Date('2026-05-11T10:00:00.000Z'))
    ).toBe(false)
  })

  it('returns customer-facing status labels', () => {
    expect(getQuotePaymentStatusLabel('draft')).toBe('尚未開放付款')
    expect(getQuotePaymentStatusLabel('payment_ready')).toBe('可支付訂金')
    expect(getQuotePaymentStatusLabel('payment_pending')).toBe('等待付款確認')
    expect(getQuotePaymentStatusLabel('paid')).toBe('已收到訂金')
    expect(getQuotePaymentStatusLabel('expired')).toBe('付款已逾期')
  })
})
