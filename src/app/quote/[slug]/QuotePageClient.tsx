'use client'

import type { QuoteData } from '@/lib/quote/types'
import { QuoteHero } from '@/components/quote/QuoteHero'
import { QuoteItinerary } from '@/components/quote/QuoteItinerary'
import { QuoteCostDashboard } from '@/components/quote/QuoteCostDashboard'
import { QuoteFooter } from '@/components/quote/QuoteFooter'

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
