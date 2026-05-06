'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { QuoteData } from '@/lib/quote/types'
import { QuoteHero } from '@/components/quote/QuoteHero'
import { QuoteItinerary } from '@/components/quote/QuoteItinerary'
import { QuoteCostDashboard } from '@/components/quote/QuoteCostDashboard'
import { QuoteFooter } from '@/components/quote/QuoteFooter'

const SCROLL_DURATION_MS = 850

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function scrollToSection(id: string) {
  const element = document.getElementById(id)
  if (!element) return

  const shouldReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const targetY = element.getBoundingClientRect().top + window.scrollY

  if (shouldReduceMotion) {
    window.scrollTo({ top: targetY })
    return
  }

  const startY = window.scrollY
  const distance = targetY - startY
  const startTime = performance.now()

  const step = (now: number) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / SCROLL_DURATION_MS, 1)
    window.scrollTo(0, startY + distance * easeOutCubic(progress))

    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }

  requestAnimationFrame(step)
}

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
  return (
    <main style={{ background: '#FDFBF4', minHeight: '100vh' }}>
      <QuoteHero quote={quote} />
      <QuoteItinerary quote={quote} />
      <QuoteCostDashboard quote={quote} />
      <QuoteFooter isSample={quote.isSample} />
      <ScrollNavigationButtons />
    </main>
  )
}
