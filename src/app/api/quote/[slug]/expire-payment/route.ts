import { NextResponse } from 'next/server'

import {
  fetchQuotePaymentRecordBySlug,
  patchQuotePaymentRecord,
} from '@/lib/quote/paymentAdmin'
import { isQuotePaymentExpired } from '@/lib/quote/paymentState'

interface RouteContext {
  params: {
    slug: string
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const quote = await fetchQuotePaymentRecordBySlug(context.params.slug)

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found.' }, { status: 404 })
  }

  const canExpire =
    quote.payment.state === 'payment_ready' ||
    quote.payment.state === 'payment_pending'
  const shouldExpire = canExpire && isQuotePaymentExpired(quote.payment)

  if (shouldExpire) {
    await patchQuotePaymentRecord(quote._id, {
      paymentState: 'expired',
    })
  }

  return NextResponse.json({
    paymentState: shouldExpire ? 'expired' : quote.payment.state,
    changed: shouldExpire,
  })
}
