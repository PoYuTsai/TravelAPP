import crypto from 'node:crypto'
import { buildMerchantTradeNo, buildOrderNo } from '@/lib/payments/orderIds'

export interface EcpayConfig {
  merchantId: string
  hashKey: string
  hashIV: string
  checkoutBaseUrl: string
  returnUrl: string
}

export interface EcpayCheckoutForm {
  action: string
  fields: Record<string, string>
}

interface BuildEcpayCheckoutInput {
  merchantTradeNo: string
  merchantTradeDate?: Date
  totalAmount: number
  itemName: string
  tradeDesc?: string
  clientBackUrl?: string
  customField1?: string
  customField2?: string
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function formatMerchantTradeDate(date: Date) {
  return [
    date.getUTCFullYear(),
    '/',
    pad2(date.getUTCMonth() + 1),
    '/',
    pad2(date.getUTCDate()),
    ' ',
    pad2(date.getUTCHours()),
    ':',
    pad2(date.getUTCMinutes()),
    ':',
    pad2(date.getUTCSeconds()),
  ].join('')
}

function toDotNetUrlEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
}

function sanitizeAscii(value: string, maxLength: number) {
  return value
    .replace(/[^A-Za-z0-9 #:_/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function sortFieldsForCheckMacValue(fields: Record<string, string>) {
  return Object.entries(fields)
    .filter(([key]) => key !== 'CheckMacValue')
    .sort(([left], [right]) => left.localeCompare(right))
}

export function createEcpayCheckMacValue(
  fields: Record<string, string>,
  config: Pick<EcpayConfig, 'hashKey' | 'hashIV'>
) {
  const sorted = sortFieldsForCheckMacValue(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const source = `HashKey=${config.hashKey}&${sorted}&HashIV=${config.hashIV}`
  const encoded = toDotNetUrlEncode(source).toLowerCase()

  return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase()
}

export function getEcpayConfig(): EcpayConfig {
  const merchantId = process.env.ECPAY_MERCHANT_ID?.trim()
  const hashKey = process.env.ECPAY_HASH_KEY?.trim()
  const hashIV = process.env.ECPAY_HASH_IV?.trim()
  const checkoutBaseUrl = process.env.ECPAY_CHECKOUT_BASE_URL?.trim()
  const returnUrl = process.env.ECPAY_RETURN_URL?.trim()

  if (!merchantId || !hashKey || !hashIV || !checkoutBaseUrl || !returnUrl) {
    throw new Error(
      'ECPAY configuration missing. Please set ECPAY_MERCHANT_ID, ECPAY_HASH_KEY, ECPAY_HASH_IV, ECPAY_CHECKOUT_BASE_URL, and ECPAY_RETURN_URL.'
    )
  }

  return {
    merchantId,
    hashKey,
    hashIV,
    checkoutBaseUrl,
    returnUrl,
  }
}

export { buildMerchantTradeNo, buildOrderNo }

export function buildEcpayCheckoutForm(
  input: BuildEcpayCheckoutInput,
  config = getEcpayConfig()
): EcpayCheckoutForm {
  const merchantTradeDate = input.merchantTradeDate ?? new Date()

  const fields: Record<string, string> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: input.merchantTradeNo,
    MerchantTradeDate: formatMerchantTradeDate(merchantTradeDate),
    PaymentType: 'aio',
    TotalAmount: String(Math.round(input.totalAmount)),
    TradeDesc: sanitizeAscii(
      input.tradeDesc ?? 'Chiangway Travel deposit',
      200
    ),
    ItemName: sanitizeAscii(input.itemName, 400),
    ReturnURL: config.returnUrl,
    ChoosePayment: 'Credit',
    EncryptType: '1',
  }

  if (input.clientBackUrl) {
    fields.ClientBackURL = input.clientBackUrl
  }

  if (input.customField1) {
    fields.CustomField1 = input.customField1
  }

  if (input.customField2) {
    fields.CustomField2 = input.customField2
  }

  fields.CheckMacValue = createEcpayCheckMacValue(fields, config)

  return {
    action: config.checkoutBaseUrl,
    fields,
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function renderEcpayAutoSubmitHtml(form: EcpayCheckoutForm) {
  const inputs = Object.entries(form.fields)
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`
    )
    .join('\n')

  return `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>正在導向付款頁面</title>
  </head>
  <body>
    <form id="ecpay-checkout-form" method="post" action="${escapeHtml(form.action)}">
      ${inputs}
      <noscript>
        <p>請點擊下方按鈕前往綠界付款頁面。</p>
        <button type="submit">前往付款</button>
      </noscript>
    </form>
    <script>
      document.getElementById('ecpay-checkout-form').submit();
    </script>
  </body>
</html>`
}

export function verifyEcpayCheckMacValue(
  payload: Record<string, string>,
  config = getEcpayConfig()
) {
  const provided = payload.CheckMacValue?.trim().toUpperCase()
  if (!provided) return false

  const expected = createEcpayCheckMacValue(payload, config)
  return expected === provided
}
