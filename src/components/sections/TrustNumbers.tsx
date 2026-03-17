'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { SiteTrustCard } from '@/lib/site-settings'

// Animated counter hook
function useCountAnimation(end: number, duration: number = 1500, startCounting: boolean = false) {
  const [count, setCount] = useState(0)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!startCounting || hasAnimated.current) return
    hasAnimated.current = true

    const startTime = performance.now()
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function for smooth animation
      const easeOutQuad = (t: number) => t * (2 - t)
      const currentCount = Math.floor(easeOutQuad(progress) * end)

      setCount(currentCount)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setCount(end)
      }
    }

    requestAnimationFrame(animate)
  }, [end, duration, startCounting])

  return count
}

// Star icon component
function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}

// Arrow icon component
function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  )
}

// External link icon
function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  )
}

interface TrustNumbersProps {
  // Keep for backwards compatibility with Sanity CMS
  items?: unknown[]
  // Compact mode for inline display (no section wrapper)
  compact?: boolean
  // Dynamic family count from Notion (defaults to 114 if not provided)
  familyCountValue?: number
  reviewCount?: number
  ratingValue?: number
  sectionEyebrow?: string
  sectionTitle?: string
  sectionDescription?: string
  cards?: SiteTrustCard[]
}

interface TrustCardProps {
  href: string
  title: string
  value: string
  description: string
  tone: 'warm' | 'light'
  external?: boolean
  compact?: boolean
  children?: React.ReactNode
}

function TrustCard({
  href,
  title,
  value,
  description,
  tone,
  external = false,
  compact = false,
  children,
}: TrustCardProps) {
  const baseClassName = compact
    ? 'group rounded-3xl border px-4 py-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg'
    : 'group rounded-[28px] border px-5 py-6 md:px-6 md:py-7 text-left shadow-[0_22px_60px_-35px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_80px_-35px_rgba(0,0,0,0.6)]'

  const toneClassName = tone === 'warm'
    ? 'border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-amber-100/80'
    : 'border-white/15 bg-white/95'

  const content = (
    <div className={`${baseClassName} ${toneClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-500">{title}</p>
          <p className={`mt-2 font-bold text-stone-900 ${compact ? 'text-2xl' : 'text-3xl md:text-4xl'}`}>
            {value}
          </p>
        </div>
        {children}
      </div>
      <p className={`mt-3 text-stone-600 ${compact ? 'text-sm leading-6' : 'text-base leading-7'}`}>
        {description}
      </p>
    </div>
  )

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )
  }

  return <Link href={href}>{content}</Link>
}

const defaultCards: SiteTrustCard[] = [
  {
    metric: 'families',
    title: '真實行程案例',
    description: '不是展示漂亮文案而已，而是真的有家庭實際出發、留下旅程紀錄。',
    href: '/tours',
  },
  {
    metric: 'reviews',
    title: 'Google 公開評價',
    description: '先看公開平台上的真實回饋，再決定這樣的服務方式適不適合你們家。',
    href: 'https://maps.app.goo.gl/8MbRV4PPBggwj2pF6',
    external: true,
  },
  {
    metric: 'brand',
    title: '在地台泰家庭',
    description: '不是轉單業者，而是住在清邁、理解親子節奏的家庭自己接手服務。',
    href: '/homestay',
    valueOverride: 'Eric + Min',
  },
]

export default function TrustNumbers({
  compact = false,
  familyCountValue = 114,
  reviewCount = 110,
  ratingValue = 5,
  sectionEyebrow = '先看可被驗證的信任感',
  sectionTitle = '不用先相信廣告文案',
  sectionDescription = '先看公開評價、真實家庭出發紀錄，以及我們是怎麼把這趟旅程顧好的。',
  cards,
}: TrustNumbersProps) {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  // IntersectionObserver for scroll-based animation trigger
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const familyCount = useCountAnimation(familyCountValue, 1500, isVisible)
  const revealClassName = isVisible
    ? 'opacity-100 translate-y-0'
    : 'opacity-0 translate-y-4'
  const cardsToRender = cards?.length ? cards : defaultCards

  const renderCardValue = (card: SiteTrustCard) => {
    switch (card.metric) {
      case 'families':
        return `${familyCount}+`
      case 'reviews':
        return `${ratingValue.toFixed(1)} / ${reviewCount}+`
      case 'brand':
      default:
        return card.valueOverride?.trim() || 'Eric + Min'
    }
  }

  const renderCardAdornment = (card: SiteTrustCard, isExternal: boolean) => {
    if (card.metric === 'reviews') {
      return (
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => (
            <StarIcon key={i} className="h-4 w-4 text-yellow-400" />
          ))}
          {isExternal ? (
            <ExternalLinkIcon className="ml-1 h-4 w-4 text-stone-400 transition-transform duration-300 group-hover:scale-110" />
          ) : (
            <ArrowIcon className="ml-1 h-4 w-4 text-primary transition-transform duration-300 group-hover:translate-x-1" />
          )}
        </div>
      )
    }

    return isExternal ? (
      <ExternalLinkIcon className="h-5 w-5 text-stone-400 transition-transform duration-300 group-hover:scale-110" />
    ) : (
      <ArrowIcon className="h-5 w-5 text-primary transition-transform duration-300 group-hover:translate-x-1" />
    )
  }

  const cardsMarkup = (
    <div className={`grid gap-4 md:grid-cols-3 md:gap-5 transition-all duration-500 ${revealClassName}`}>
      {cardsToRender.map((card) => {
        const isExternal = card.external ?? card.metric === 'reviews'
        const tone = card.metric === 'families' ? 'warm' : 'light'

        return (
          <TrustCard
            key={`${card.metric}-${card.title}`}
            href={card.href}
            title={card.title}
            value={renderCardValue(card)}
            description={card.description}
            tone={tone}
            compact={compact}
            external={isExternal}
          >
            {renderCardAdornment(card, isExternal)}
          </TrustCard>
        )
      })}
    </div>
  )

  // Compact mode: render badges directly without section wrapper
  if (compact) {
    return (
      <div ref={sectionRef as React.RefObject<HTMLDivElement>} className="w-full">
        {cardsMarkup}
      </div>
    )
  }

  return (
    <section ref={sectionRef} className="relative overflow-hidden py-16 md:py-20">
      <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-[#6d5217]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,192,9,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_24%)]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-light/90">
            {sectionEyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
            {sectionTitle}
          </h2>
          <p className="mt-4 text-base leading-7 text-white/72 md:text-lg">
            {sectionDescription}
          </p>
        </div>

        <div className="mt-10">
          {cardsMarkup}
        </div>
      </div>
    </section>
  )
}
