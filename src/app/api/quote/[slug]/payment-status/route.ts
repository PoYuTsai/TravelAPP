import { NextResponse } from 'next/server'

import { fetchQuotePaymentRecordBySlug } from '@/lib/quote/paymentAdmin'

interface RouteContext {
  params: {
    slug: string
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const quote = await fetchQuotePaymentRecordBySlug(context.params.slug)

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found.' }, { status: 404 })
  }

  return NextResponse.json({
    paymentState: quote.payment.state,
    depositAmountTWD: quote.payment.depositAmountTWD,
    depositLabel: quote.payment.depositLabel,
    paymentExpiresAt: quote.payment.expiresAt,
    paymentPaidAt: quote.payment.paidAt,
    orderNo: quote.payment.orderNo,
  })
}
