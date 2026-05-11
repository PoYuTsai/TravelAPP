import { createClient } from 'next-sanity'

import { apiVersion, dataset, projectId } from '@/sanity/config'
import { normalizeQuotePayment, type QuotePayment } from './paymentState'

interface QuotePaymentDocument {
  _id: string
  name: string
  publicSlug: string
  orderNo?: string
  paymentState?: string
  depositAmountTWD?: number
  depositLabel?: string
  paymentProvider?: string
  paymentTradeNo?: string
  paymentUrl?: string
  paymentCreatedAt?: string
  paymentExpiresAt?: string
  paymentPaidAt?: string
}

export interface QuotePaymentRecord {
  _id: string
  name: string
  publicSlug: string
  payment: QuotePayment
}

const QUERY_FIELDS = `
  _id,
  name,
  "publicSlug": publicSlug.current,
  orderNo,
  paymentState,
  depositAmountTWD,
  depositLabel,
  paymentProvider,
  paymentTradeNo,
  paymentUrl,
  paymentCreatedAt,
  paymentExpiresAt,
  paymentPaidAt
`

const WRITE_QUERY_BY_SLUG = `*[_type == "pricingExample" && publicSlug.current == $slug][0]{
${QUERY_FIELDS}
}`

const WRITE_QUERY_BY_TRADE_NO = `*[_type == "pricingExample" && paymentTradeNo == $tradeNo][0]{
${QUERY_FIELDS}
}`

function getWriteClient() {
  const token = process.env.SANITY_API_TOKEN?.trim()

  if (!token) {
    throw new Error('SANITY_API_TOKEN is required for quote payment mutations.')
  }

  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token,
  })
}

function normalizeRecord(doc: QuotePaymentDocument | null): QuotePaymentRecord | null {
  if (!doc?._id || !doc.publicSlug) {
    return null
  }

  return {
    _id: doc._id,
    name: doc.name,
    publicSlug: doc.publicSlug,
    payment: normalizeQuotePayment(doc),
  }
}

export async function fetchQuotePaymentRecordBySlug(slug: string) {
  const client = getWriteClient()
  const doc = await client.fetch<QuotePaymentDocument | null>(WRITE_QUERY_BY_SLUG, {
    slug,
  })

  return normalizeRecord(doc)
}

export async function fetchQuotePaymentRecordByTradeNo(tradeNo: string) {
  const client = getWriteClient()
  const doc = await client.fetch<QuotePaymentDocument | null>(
    WRITE_QUERY_BY_TRADE_NO,
    {
      tradeNo,
    }
  )

  return normalizeRecord(doc)
}

export async function patchQuotePaymentRecord(
  documentId: string,
  patch: Record<string, unknown>
) {
  const client = getWriteClient()
  await client.patch(documentId).set(patch).commit()
}
