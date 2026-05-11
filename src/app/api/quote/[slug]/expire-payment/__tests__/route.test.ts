import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchQuotePaymentRecordBySlug = vi.fn()
const patchQuotePaymentRecord = vi.fn()

vi.mock('@/lib/quote/paymentAdmin', () => ({
  fetchQuotePaymentRecordBySlug,
  patchQuotePaymentRecord,
}))

describe('quote expire-payment route', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('marks overdue pending payments as expired', async () => {
    fetchQuotePaymentRecordBySlug.mockResolvedValue({
      _id: 'pricingExample.formal.abc',
      publicSlug: 'abc',
      name: 'Test Quote',
      payment: {
        state: 'payment_pending',
        depositAmountTWD: 4000,
        depositLabel: '??閮?',
        provider: 'ecpay',
        tradeNo: 'CW260511100000A1B2',
        paymentUrl:
          'https://chiangway-travel.com/api/quote/abc/payment-link?tradeNo=CW260511100000A1B2',
        createdAt: '2026-05-11T10:00:00.000Z',
        expiresAt: '2026-05-11T11:00:00.000Z',
        paidAt: null,
        orderNo: 'CW-20260511-A1B2',
      },
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-11T12:00:00.000Z'))

    const { POST } = await import(
      '@/app/api/quote/[slug]/expire-payment/route'
    )

    const response = await POST(
      new Request('https://chiangway-travel.com/api/quote/abc/expire-payment', {
        method: 'POST',
      }),
      { params: { slug: 'abc' } }
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.paymentState).toBe('expired')
    expect(body.changed).toBe(true)
    expect(patchQuotePaymentRecord).toHaveBeenCalledWith(
      'pricingExample.formal.abc',
      { paymentState: 'expired' }
    )

    vi.useRealTimers()
  })

  it('keeps paid quotes unchanged', async () => {
    fetchQuotePaymentRecordBySlug.mockResolvedValue({
      _id: 'pricingExample.formal.paid',
      publicSlug: 'paid-quote',
      name: 'Paid Quote',
      payment: {
        state: 'paid',
        depositAmountTWD: 4000,
        depositLabel: '??閮?',
        provider: 'ecpay',
        tradeNo: 'CW260511100000A1B2',
        paymentUrl:
          'https://chiangway-travel.com/api/quote/paid-quote/payment-link?tradeNo=CW260511100000A1B2',
        createdAt: '2026-05-11T10:00:00.000Z',
        expiresAt: '2026-05-11T11:00:00.000Z',
        paidAt: '2026-05-11T10:05:00.000Z',
        orderNo: 'CW-20260511-A1B2',
      },
    })

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-11T12:00:00.000Z'))

    const { POST } = await import(
      '@/app/api/quote/[slug]/expire-payment/route'
    )

    const response = await POST(
      new Request(
        'https://chiangway-travel.com/api/quote/paid-quote/expire-payment',
        {
          method: 'POST',
        }
      ),
      { params: { slug: 'paid-quote' } }
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.paymentState).toBe('paid')
    expect(body.changed).toBe(false)
    expect(patchQuotePaymentRecord).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})
