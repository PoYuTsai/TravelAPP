'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { QuoteData } from '@/lib/quote/types'
import { QuoteHero } from '@/components/quote/QuoteHero'
import { QuoteItinerary } from '@/components/quote/QuoteItinerary'
import { QuoteCostDashboard } from '@/components/quote/QuoteCostDashboard'
import { QuotePaymentCard } from '@/components/quote/QuotePaymentCard'
import { QuoteFooter } from '@/components/quote/QuoteFooter'
import { scrollToSection } from '@/lib/quote/scrollToSection'

function ScrollNavigationButtons() {
  const [showUp, setShowUp] = useState(false)
  const [showDown, setShowDown] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setShowUp(window.scrollY > 600)

      const pricingSection = document.getElementById('quote-pricing')
      if (!pricingSection) {
        setShowDown(false)
        return
      }

      const rect = pricingSection.getBoundingClientRect()
      setShowDown(rect.top > window.innerHeight * 0.45)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  if (!showUp && !showDown) return null

  return (
    <div className="fixed bottom-8 right-5 z-50 flex flex-col gap-3">
      {showDown && (
        <button
          onClick={() => scrollToSection('quote-pricing')}
          className="flex h-14 w-14 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
          style={{
            background: '#4A6B3A',
            color: '#FDFBF4',
            boxShadow: '0 6px 20px rgba(74,107,58,0.35), 0 2px 8px rgba(15,11,5,0.15)',
          }}
          aria-label="跳到報價"
        >
          <ArrowDown size={22} strokeWidth={2.5} />
        </button>
      )}
      {showUp && (
        <button
          onClick={() => scrollToSection('itinerary')}
          className="flex h-14 w-14 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
          style={{
            background: '#FACC15',
            color: '#0F0B05',
            boxShadow: '0 6px 20px rgba(250,204,21,0.5), 0 2px 8px rgba(15,11,5,0.15)',
          }}
          aria-label="回到行程"
        >
          <ArrowUp size={22} strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}

export function QuotePageClient({ quote }: { quote: QuoteData }) {
  const paymentLaunchUrl =
    quote.payment.paymentUrl ??
    `/api/quote/${encodeURIComponent(quote.publicSlug)}/payment-link`

  return (
    <main style={{ background: '#FDFBF4', minHeight: '100vh' }}>
      <QuoteHero quote={quote} />
      <QuoteItinerary quote={quote} />
      <QuoteCostDashboard quote={quote} />
      <section className="px-6 pb-6 md:px-10">
        <div className="mx-auto max-w-6xl">
          <QuotePaymentCard payment={quote.payment} launchUrl={paymentLaunchUrl} />
        </div>
      </section>
      <QuoteFooter isSample={quote.isSample} />
      <ScrollNavigationButtons />
    </main>
  )
}
