import { notFound } from 'next/navigation'
import { fetchQuoteBySlug } from '@/lib/quote/fetchQuote'
import { QuotePageClient } from './QuotePageClient'

// 每次訪問都從 Sanity 即時讀取，不快取
export const dynamic = 'force-dynamic'

interface Props {
  params: { slug: string }
}

export default async function QuotePage({ params }: Props) {
  const quote = await fetchQuoteBySlug(params.slug)
  if (!quote) notFound()

  return <QuotePageClient quote={quote} />
}
