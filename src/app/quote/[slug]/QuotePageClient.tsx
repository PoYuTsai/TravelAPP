'use client'

import type { QuoteData } from '@/lib/quote/types'

// Placeholder components — will be replaced by Tasks 6-9
function QuoteHero({ quote }: { quote: QuoteData }) {
  return <div>Hero: {quote.name}</div>
}
function QuoteItinerary({ quote }: { quote: QuoteData }) {
  return <div>Itinerary: {quote.itinerary.length} days</div>
}
function QuoteCostDashboard({ quote }: { quote: QuoteData }) {
  return <div>Cost: {quote.quote?.totalTWD ?? 'N/A'}</div>
}
function QuoteFooter({ isSample }: { isSample: boolean }) {
  return <div>Footer (sample: {String(isSample)})</div>
}

export function QuotePageClient({ quote }: { quote: QuoteData }) {
  return (
    <main style={{ background: '#FDFBF4', minHeight: '100vh' }}>
      <QuoteHero quote={quote} />
      <QuoteItinerary quote={quote} />
      <QuoteCostDashboard quote={quote} />
      <QuoteFooter isSample={quote.isSample} />
    </main>
  )
}
