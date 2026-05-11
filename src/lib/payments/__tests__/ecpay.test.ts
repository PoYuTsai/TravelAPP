import { describe, expect, it } from 'vitest'

import {
  buildEcpayCheckoutForm,
  buildMerchantTradeNo,
  buildOrderNo,
  renderEcpayAutoSubmitHtml,
  verifyEcpayCheckMacValue,
} from '@/lib/payments/ecpay'

const TEST_CONFIG = {
  merchantId: '3002607',
  hashKey: 'pwFHCqoQZGmho4w6',
  hashIV: 'EkRm7iFT261dpevs',
  checkoutBaseUrl: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
  returnUrl: 'https://chiangway-travel.com/api/payments/ecpay/callback',
}

describe('ecpay payment helpers', () => {
  it('builds a deterministic merchant trade number under 20 chars', () => {
    const tradeNo = buildMerchantTradeNo(new Date('2026-05-11T10:00:00.000Z'), 'A1B2')

    expect(tradeNo).toBe('CW260511100000A1B2')
    expect(tradeNo.length).toBeLessThanOrEqual(20)
  })

  it('builds a readable internal order number', () => {
    const orderNo = buildOrderNo(new Date('2026-05-11T10:00:00.000Z'), 'A1B2')

    expect(orderNo).toBe('CW-20260511-A1B2')
  })

  it('builds a signed credit-card checkout form payload', () => {
    const form = buildEcpayCheckoutForm(
      {
        merchantTradeNo: 'CW260511100000A1B2',
        merchantTradeDate: new Date('2026-05-11T10:00:00.000Z'),
        totalAmount: 4000,
        itemName: 'Chiangway Travel deposit',
        tradeDesc: 'Chiangway Travel deposit',
        clientBackUrl: 'https://chiangway-travel.com/quote/test-slug',
        customField1: 'test-slug',
        customField2: 'CW-20260511-A1B2',
      },
      TEST_CONFIG
    )

    expect(form.action).toBe(TEST_CONFIG.checkoutBaseUrl)
    expect(form.fields.MerchantID).toBe(TEST_CONFIG.merchantId)
    expect(form.fields.MerchantTradeNo).toBe('CW260511100000A1B2')
    expect(form.fields.ChoosePayment).toBe('Credit')
    expect(form.fields.ClientBackURL).toBe(
      'https://chiangway-travel.com/quote/test-slug'
    )
    expect(form.fields.CheckMacValue).toBe(
      '5A1B3529FD3AA086A3D81D3941634C05A2B3D40D7DE6DA0A431739E1350CA532'
    )
  })

  it('renders an auto-submitting payment html page', () => {
    const html = renderEcpayAutoSubmitHtml({
      action: TEST_CONFIG.checkoutBaseUrl,
      fields: {
        MerchantID: TEST_CONFIG.merchantId,
        MerchantTradeNo: 'CW260511100000A1B2',
        CheckMacValue: 'ABC123',
      },
    })

    expect(html).toContain(TEST_CONFIG.checkoutBaseUrl)
    expect(html).toContain('MerchantTradeNo')
    expect(html).toContain('document.getElementById(\'ecpay-checkout-form\')')
  })

  it('verifies callback check mac values', () => {
    const payload = {
      CustomField1: 'test-slug',
      CustomField2: 'CW-20260511-A1B2',
      MerchantID: TEST_CONFIG.merchantId,
      MerchantTradeNo: 'CW260511100000A1B2',
      PaymentDate: '2026/05/11 18:10:00',
      PaymentType: 'Credit_CreditCard',
      PaymentTypeChargeFee: '40',
      RtnCode: '1',
      RtnMsg: '交易成功',
      SimulatePaid: '0',
      StoreID: '',
      TradeAmt: '4000',
      TradeDate: '2026/05/11 18:09:12',
      TradeNo: '2605111809123456',
    }

    const form = buildEcpayCheckoutForm(
      {
        merchantTradeNo: 'CW260511100000A1B2',
        merchantTradeDate: new Date('2026-05-11T10:00:00.000Z'),
        totalAmount: 4000,
        itemName: 'Chiangway Travel deposit',
        tradeDesc: 'Chiangway Travel deposit',
        clientBackUrl: 'https://chiangway-travel.com/quote/test-slug',
      },
      TEST_CONFIG
    )

    const callbackPayload = {
      ...payload,
      CheckMacValue: form.fields.CheckMacValue,
    }

    expect(verifyEcpayCheckMacValue(callbackPayload, TEST_CONFIG)).toBe(false)
  })
})
