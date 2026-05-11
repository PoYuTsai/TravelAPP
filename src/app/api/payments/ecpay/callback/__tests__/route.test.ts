import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchQuotePaymentRecordByTradeNo = vi.fn()
const patchQuotePaymentRecord = vi.fn()
const verifyEcpayCheckMacValue = vi.fn()

vi.mock('@/lib/quote/paymentAdmin', () => ({
  fetchQuotePaymentRecordByTradeNo,
  patchQuotePaymentRecord,
}))

vi.mock('@/lib/payments/ecpay', () => ({
  verifyEcpayCheckMacValue,
}))

describe('ecpay callback route', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('rejects invalid callback signatures', async () => {
    verifyEcpayCheckMacValue.mockReturnValue(false)

    const { POST } = await import('@/app/api/payments/ecpay/callback/route')

    const body = new URLSearchParams({
      MerchantTradeNo: 'CW260511100000A1B2',
      RtnCode: '1',
      CheckMacValue: 'INVALID',
    })

    const response = await POST(
      new Request('https://chiangway-travel.com/api/payments/ecpay/callback', {
        method: 'POST',
        body,
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
      })
    )

    expect(response.status).toBe(400)
    expect(patchQuotePaymentRecord).not.toHaveBeenCalled()
  })

  it('marks matching quotes as paid on valid success callbacks', async () => {
    verifyEcpayCheckMacValue.mockReturnValue(true)
    fetchQuotePaymentRecordByTradeNo.mockResolvedValue({
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

    const { POST } = await import('@/app/api/payments/ecpay/callback/route')

    const body = new URLSearchParams({
      MerchantTradeNo: 'CW260511100000A1B2',
      RtnCode: '1',
      TradeNo: '2605111809123456',
      PaymentDate: '2026/05/11 18:10:00',
      CheckMacValue: 'VALID',
    })

    const response = await POST(
      new Request('https://chiangway-travel.com/api/payments/ecpay/callback', {
        method: 'POST',
        body,
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
      })
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('1|OK')
    expect(patchQuotePaymentRecord).toHaveBeenCalledWith(
      'pricingExample.formal.abc',
      expect.objectContaining({
        paymentState: 'paid',
        paymentPaidAt: expect.any(String),
      })
    )
  })

  it('acknowledges duplicate paid callbacks without patching again', async () => {
    verifyEcpayCheckMacValue.mockReturnValue(true)
    fetchQuotePaymentRecordByTradeNo.mockResolvedValue({
      _id: 'pricingExample.formal.abc',
      publicSlug: 'abc',
      name: 'Test Quote',
      payment: {
        state: 'paid',
        depositAmountTWD: 4000,
        depositLabel: '包車訂金',
        provider: 'ecpay',
        tradeNo: 'CW260511100000A1B2',
        paymentUrl:
          'https://chiangway-travel.com/api/quote/abc/payment-link?tradeNo=CW260511100000A1B2',
        createdAt: '2026-05-11T10:00:00.000Z',
        expiresAt: '2099-05-12T10:00:00.000Z',
        paidAt: '2026-05-11T10:05:00.000Z',
        orderNo: 'CW-20260511-A1B2',
      },
    })

    const { POST } = await import('@/app/api/payments/ecpay/callback/route')

    const body = new URLSearchParams({
      MerchantTradeNo: 'CW260511100000A1B2',
      RtnCode: '1',
      TradeNo: '2605111809123456',
      PaymentDate: '2026/05/11 18:10:00',
      CheckMacValue: 'VALID',
    })

    const response = await POST(
      new Request('https://chiangway-travel.com/api/payments/ecpay/callback', {
        method: 'POST',
        body,
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
      })
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('1|OK')
    expect(patchQuotePaymentRecord).not.toHaveBeenCalled()
  })
})
