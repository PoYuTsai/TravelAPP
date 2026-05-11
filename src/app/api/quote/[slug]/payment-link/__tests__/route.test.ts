import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchQuotePaymentRecordBySlug = vi.fn()
const patchQuotePaymentRecord = vi.fn()
const buildMerchantTradeNo = vi.fn()
const buildOrderNo = vi.fn()
const buildEcpayCheckoutForm = vi.fn()
const renderEcpayAutoSubmitHtml = vi.fn()

vi.mock('@/lib/quote/paymentAdmin', () => ({
  fetchQuotePaymentRecordBySlug,
  patchQuotePaymentRecord,
}))

vi.mock('@/lib/payments/ecpay', () => ({
  buildMerchantTradeNo,
  buildOrderNo,
  buildEcpayCheckoutForm,
  renderEcpayAutoSubmitHtml,
}))

describe('quote payment-link route', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('rejects draft quotes from creating a payment link', async () => {
    fetchQuotePaymentRecordBySlug.mockResolvedValue({
      _id: 'pricingExample.formal.abc',
      publicSlug: 'abc',
      name: 'Test Quote',
      payment: {
        state: 'draft',
        depositAmountTWD: 4000,
        depositLabel: '包車訂金',
        provider: 'ecpay',
        tradeNo: null,
        paymentUrl: null,
        createdAt: null,
        expiresAt: null,
        paidAt: null,
        orderNo: null,
      },
    })

    const { POST } = await import(
      '@/app/api/quote/[slug]/payment-link/route'
    )

    const response = await POST(
      new Request('https://chiangway-travel.com/api/quote/abc/payment-link', {
        method: 'POST',
      }),
      { params: { slug: 'abc' } }
    )

    expect(response.status).toBe(409)
    expect(patchQuotePaymentRecord).not.toHaveBeenCalled()
  })

  it('creates a pending payment link for ready quotes', async () => {
    fetchQuotePaymentRecordBySlug.mockResolvedValue({
      _id: 'pricingExample.formal.abc',
      publicSlug: 'abc',
      name: 'Test Quote',
      payment: {
        state: 'payment_ready',
        depositAmountTWD: 4000,
        depositLabel: '包車訂金',
        provider: 'ecpay',
        tradeNo: null,
        paymentUrl: null,
        createdAt: null,
        expiresAt: '2026-05-12T10:00:00.000Z',
        paidAt: null,
        orderNo: null,
      },
    })
    buildMerchantTradeNo.mockReturnValue('CW260511100000A1B2')
    buildOrderNo.mockReturnValue('CW-20260511-A1B2')

    const { POST } = await import(
      '@/app/api/quote/[slug]/payment-link/route'
    )

    const response = await POST(
      new Request('https://chiangway-travel.com/api/quote/abc/payment-link', {
        method: 'POST',
      }),
      { params: { slug: 'abc' } }
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.paymentState).toBe('payment_pending')
    expect(body.paymentUrl).toBe(
      'https://chiangway-travel.com/api/quote/abc/payment-link?tradeNo=CW260511100000A1B2'
    )
    expect(patchQuotePaymentRecord).toHaveBeenCalledWith(
      'pricingExample.formal.abc',
      expect.objectContaining({
        orderNo: 'CW-20260511-A1B2',
        paymentState: 'payment_pending',
        paymentTradeNo: 'CW260511100000A1B2',
      })
    )
  })

  it('reuses the active pending payment link when still valid', async () => {
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

    const { POST } = await import(
      '@/app/api/quote/[slug]/payment-link/route'
    )

    const response = await POST(
      new Request('https://chiangway-travel.com/api/quote/abc/payment-link', {
        method: 'POST',
      }),
      { params: { slug: 'abc' } }
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.paymentUrl).toBe(
      'https://chiangway-travel.com/api/quote/abc/payment-link?tradeNo=CW260511100000A1B2'
    )
    expect(buildMerchantTradeNo).not.toHaveBeenCalled()
    expect(patchQuotePaymentRecord).not.toHaveBeenCalled()
  })

  it('returns auto-submit html for checkout launch requests', async () => {
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
    buildEcpayCheckoutForm.mockReturnValue({
      action: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
      fields: {
        MerchantID: '3002607',
        MerchantTradeNo: 'CW260511100000A1B2',
        CheckMacValue: 'ABC123',
      },
    })
    renderEcpayAutoSubmitHtml.mockReturnValue('<html>submit</html>')

    const { GET } = await import('@/app/api/quote/[slug]/payment-link/route')

    const response = await GET(
      new Request(
        'https://chiangway-travel.com/api/quote/abc/payment-link?tradeNo=CW260511100000A1B2'
      ),
      { params: { slug: 'abc' } }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(await response.text()).toContain('submit')
    expect(buildEcpayCheckoutForm).toHaveBeenCalled()
  })
})
