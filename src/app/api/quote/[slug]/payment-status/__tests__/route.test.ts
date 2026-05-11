import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchQuotePaymentRecordBySlug = vi.fn()

vi.mock('@/lib/quote/paymentAdmin', () => ({
  fetchQuotePaymentRecordBySlug,
}))

describe('quote payment-status route', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns the public payment status payload for a quote', async () => {
    fetchQuotePaymentRecordBySlug.mockResolvedValue({
      _id: 'pricingExample.formal.abc',
      publicSlug: 'abc',
      name: 'Test Quote',
      payment: {
        state: 'payment_pending',
        depositAmountTWD: 4000,
        depositLabel: '包車訂金',
        provider: 'ecpay',
        tradeNo: 'CW260511100000A1B2',
        paymentUrl:
          'https://chiangway-travel.com/api/quote/abc/payment-link?tradeNo=CW260511100000A1B2',
        createdAt: '2026-05-11T10:00:00.000Z',
        expiresAt: '2099-05-12T10:00:00.000Z',
        paidAt: null,
        orderNo: 'CW-20260511-A1B2',
      },
    })

    const { GET } = await import(
      '@/app/api/quote/[slug]/payment-status/route'
    )

    const response = await GET(
      new Request('https://chiangway-travel.com/api/quote/abc/payment-status'),
      { params: { slug: 'abc' } }
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      paymentState: 'payment_pending',
      depositAmountTWD: 4000,
      depositLabel: '包車訂金',
      paymentExpiresAt: '2099-05-12T10:00:00.000Z',
      paymentPaidAt: null,
      orderNo: 'CW-20260511-A1B2',
    })
    expect(body.tradeNo).toBeUndefined()
    expect(body.paymentUrl).toBeUndefined()
  })

  it('returns 404 when the quote does not exist', async () => {
    fetchQuotePaymentRecordBySlug.mockResolvedValue(null)

    const { GET } = await import(
      '@/app/api/quote/[slug]/payment-status/route'
    )

    const response = await GET(
      new Request('https://chiangway-travel.com/api/quote/missing/payment-status'),
      { params: { slug: 'missing' } }
    )

    expect(response.status).toBe(404)
  })
})
