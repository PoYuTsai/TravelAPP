import { notFound } from 'next/navigation'
import { fetchQuoteBySlug } from '@/lib/quote/fetchQuote'
import { QuotePageClient } from './QuotePageClient'

interface Props {
  params: { slug: string }
}

export default async function QuotePage({ params }: Props) {
  const quote = await fetchQuoteBySlug(params.slug)
  if (!quote) notFound()

  return <QuotePageClient quote={quote} />
}
