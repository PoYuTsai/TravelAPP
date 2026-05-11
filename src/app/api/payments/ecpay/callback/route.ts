import { NextResponse } from 'next/server'

import { verifyEcpayCheckMacValue } from '@/lib/payments/ecpay'
import {
  fetchQuotePaymentRecordByTradeNo,
  patchQuotePaymentRecord,
} from '@/lib/quote/paymentAdmin'

function extractPayload(formData: FormData) {
  const payload: Record<string, string> = {}

  formData.forEach((value, key) => {
    payload[key] = typeof value === 'string' ? value : value.name
  })

  return payload
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const payload = extractPayload(formData)

  if (!verifyEcpayCheckMacValue(payload)) {
    return new NextResponse('Invalid CheckMacValue', {
      status: 400,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    })
  }

  const tradeNo = payload.MerchantTradeNo?.trim()
  if (!tradeNo) {
    return new NextResponse('1|OK', {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    })
  }

  const quote = await fetchQuotePaymentRecordByTradeNo(tradeNo)
  if (!quote) {
    return new NextResponse('1|OK', {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    })
  }

  if (quote.payment.state === 'paid') {
    return new NextResponse('1|OK', {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    })
  }

  if (payload.RtnCode === '1') {
    await patchQuotePaymentRecord(quote._id, {
      paymentState: 'paid',
      paymentPaidAt: new Date().toISOString(),
    })
  }

  return new NextResponse('1|OK', {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}
