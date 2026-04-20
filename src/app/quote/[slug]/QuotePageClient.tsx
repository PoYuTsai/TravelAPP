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
      className="fixed bottom-8 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
      style={{
        background: '#FACC15',
        color: '#0F0B05',
        boxShadow: '0 6px 20px rgba(250,204,21,0.5), 0 2px 8px rgba(15,11,5,0.15)',
      }}
      aria-label="回到行程"
    >
      <ArrowUp size={22} strokeWidth={2.5} />
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
