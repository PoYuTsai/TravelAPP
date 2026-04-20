'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import type { QuoteData } from '@/lib/quote/types'
import { QuoteHero } from '@/components/quote/QuoteHero'
import { QuoteItinerary } from '@/components/quote/QuoteItinerary'
import { QuoteCostDashboard } from '@/components/quote/QuoteCostDashboard'
import { QuoteFooter } from '@/components/quote/QuoteFooter'

function ScrollToTopButton() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!show) return null

  return (
    <button
      onClick={() => document.getElementById('itinerary')?.scrollIntoView({ behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-1.5 rounded-full px-4 py-3 text-[13px] font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
      style={{
        background: '#0F0B05',
        color: '#FACC15',
        boxShadow: '0 8px 24px rgba(15,11,5,0.3)',
      }}
    >
      <ArrowUp size={16} />
      行程
    </button>
  )
}

export function QuotePageClient({ quote }: { quote: QuoteData }) {
  return (
    <main style={{ background: '#FDFBF4', minHeight: '100vh' }}>
      <QuoteHero quote={quote} />
      <QuoteItinerary quote={quote} />
      <QuoteCostDashboard quote={quote} />
      <QuoteFooter isSample={quote.isSample} />
      <ScrollToTopButton />
    </main>
  )
}
