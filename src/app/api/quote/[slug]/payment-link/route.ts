import { NextResponse } from 'next/server'

import {
  buildEcpayCheckoutForm,
  buildMerchantTradeNo,
  buildOrderNo,
  renderEcpayAutoSubmitHtml,
} from '@/lib/payments/ecpay'
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

interface PreparedPaymentLink {
  documentId: string
  publicSlug: string
  quoteName: string
  orderNo: string
  tradeNo: string
  depositAmountTWD: number
  depositLabel: string
  paymentUrl: string
  paymentState: 'payment_pending'
  paymentExpiresAt: string | null
  reusedExistingLink: boolean
}

function getPaymentLaunchUrl(origin: string, slug: string, tradeNo: string) {
  return `${origin}/api/quote/${encodeURIComponent(slug)}/payment-link?tradeNo=${encodeURIComponent(tradeNo)}`
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function preparePaymentLink(
  request: Request,
  slug: string
): Promise<PreparedPaymentLink | NextResponse> {
  const quote = await fetchQuotePaymentRecordBySlug(slug)
  if (!quote) {
    return jsonError('Quote not found.', 404)
  }

  const { payment } = quote
  if (payment.state === 'draft') {
    return jsonError('Quote is not payment-ready yet.', 409)
  }

  if (payment.state === 'paid') {
    return jsonError('Deposit already paid for this quote.', 409)
  }

  if (payment.depositAmountTWD <= 0) {
    return jsonError('Quote deposit amount is not configured.', 400)
  }

  const origin = new URL(request.url).origin
  const expired = isQuotePaymentExpired(payment)
  const orderNo = payment.orderNo ?? buildOrderNo()

  if (
    payment.state === 'payment_pending' &&
    payment.tradeNo &&
    payment.paymentUrl &&
    !expired
  ) {
    return {
      documentId: quote._id,
      publicSlug: quote.publicSlug,
      quoteName: quote.name,
      orderNo,
      tradeNo: payment.tradeNo,
      depositAmountTWD: payment.depositAmountTWD,
      depositLabel: payment.depositLabel,
      paymentUrl: payment.paymentUrl,
      paymentState: 'payment_pending',
      paymentExpiresAt: payment.expiresAt,
      reusedExistingLink: true,
    }
  }

  const tradeNo = buildMerchantTradeNo()
  const paymentUrl = getPaymentLaunchUrl(origin, quote.publicSlug, tradeNo)
  const paymentCreatedAt = new Date().toISOString()

  await patchQuotePaymentRecord(quote._id, {
    orderNo,
    paymentState: 'payment_pending',
    paymentTradeNo: tradeNo,
    paymentUrl,
    paymentCreatedAt,
    paymentPaidAt: null,
  })

  return {
    documentId: quote._id,
    publicSlug: quote.publicSlug,
    quoteName: quote.name,
    orderNo,
    tradeNo,
    depositAmountTWD: payment.depositAmountTWD,
    depositLabel: payment.depositLabel,
    paymentUrl,
    paymentState: 'payment_pending',
    paymentExpiresAt: payment.expiresAt,
    reusedExistingLink: false,
  }
}

export async function POST(request: Request, context: RouteContext) {
  const result = await preparePaymentLink(request, context.params.slug)
  if (result instanceof NextResponse) {
    return result
  }

  return NextResponse.json({
    orderNo: result.orderNo,
    tradeNo: result.tradeNo,
    depositAmountTWD: result.depositAmountTWD,
    depositLabel: result.depositLabel,
    paymentState: result.paymentState,
    paymentExpiresAt: result.paymentExpiresAt,
    paymentUrl: result.paymentUrl,
    reusedExistingLink: result.reusedExistingLink,
  })
}

export async function GET(request: Request, context: RouteContext) {
  const result = await preparePaymentLink(request, context.params.slug)
  if (result instanceof NextResponse) {
    return result
  }

  const requestedTradeNo = new URL(request.url).searchParams.get('tradeNo')
  if (requestedTradeNo && requestedTradeNo !== result.tradeNo) {
    return new NextResponse('This payment link is no longer active.', {
      status: 410,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    })
  }

  const origin = new URL(request.url).origin
  const checkoutForm = buildEcpayCheckoutForm({
    merchantTradeNo: result.tradeNo,
    totalAmount: result.depositAmountTWD,
    itemName: 'Chiangway Travel deposit',
    tradeDesc: 'Chiangway Travel deposit',
    clientBackUrl: `${origin}/quote/${encodeURIComponent(result.publicSlug)}`,
    customField1: result.publicSlug,
    customField2: result.orderNo,
  })

  return new NextResponse(renderEcpayAutoSubmitHtml(checkoutForm), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
