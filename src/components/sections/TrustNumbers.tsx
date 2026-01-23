'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

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

// Pulsing ring animation component - continuous glow effect
function PulseRing({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="absolute inset-0 rounded-full border-2 border-primary/50 animate-ping pointer-events-none"
      style={{
        animationDuration: '2s',
        animationDelay: `${delay}ms`,
        animationIterationCount: 'infinite', // Keep pulsing forever
      }}
    />
  )
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items?: any[]
  // Compact mode for inline display (no section wrapper)
  compact?: boolean
  // Dynamic family count from Notion (defaults to 114 if not provided)
  familyCountValue?: number
}

export default function TrustNumbers({ compact = false, familyCountValue = 114 }: TrustNumbersProps) {
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

  // Pulse animation always shows when section is visible
  const showPulse = isVisible

  // Badge base classes - py-3 for better mobile touch target (44px+)
  const badgeBase = "relative flex items-center gap-2 px-4 py-3 bg-white border-2 rounded-full transition-all duration-300 ease-out"

  // Animation classes for scroll reveal with bounce effect
  const animationClass = isVisible
    ? "opacity-100 translate-y-0 scale-100"
    : "opacity-0 translate-y-4 scale-95"

  // Glow shadow for more obvious clickable state
  const glowShadow = "shadow-[0_0_0_0_rgba(var(--color-primary-rgb,74,189,130),0.4)]"
  const hoverGlow = "hover:shadow-[0_4px_20px_-2px_rgba(var(--color-primary-rgb,74,189,130),0.4)]"

  const badges = (
    <div className="flex flex-col items-center gap-4">
      {/* Mobile hint text - larger and more visible */}
      <p className="text-sm font-medium text-primary/80 md:hidden animate-pulse">
        👆 點擊探索更多
      </p>

      <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6">
        {/* Badge 1: 服務 N+ 家庭 */}
        <Link
          href="/tours"
          className={`group ${badgeBase} border-primary/30 cursor-pointer hover:border-primary hover:bg-primary/10 ${hoverGlow} hover:-translate-y-1 active:scale-95 ${animationClass}`}
          style={{ transitionDelay: '0ms' }}
        >
          {/* Animated pulse ring on mobile */}
          {showPulse && <PulseRing delay={0} />}

          <span className="text-sm text-gray-700 font-medium">服務</span>
          <span className="text-base md:text-lg font-bold text-primary">
            {familyCount}+
          </span>
          <span className="text-sm text-gray-700 font-medium">家庭</span>
          <ArrowIcon className="w-4 h-4 text-primary/60 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
        </Link>

        {/* Badge 2: 5.0 滿分好評 - Link to Facebook Reviews */}
        <a
          href="https://www.facebook.com/profile.php?id=61569067776768&sk=reviews"
          target="_blank"
          rel="noopener noreferrer"
          className={`group ${badgeBase} border-yellow-300 cursor-pointer hover:border-yellow-400 hover:bg-yellow-50 hover:shadow-[0_8px_30px_-4px_rgba(250,204,21,0.5)] hover:-translate-y-1 active:scale-95 ${animationClass}`}
          style={{ transitionDelay: '100ms' }}
        >
          {/* Animated pulse ring on mobile */}
          {showPulse && <PulseRing delay={200} />}

          <div className="flex items-center gap-0.5 group-hover:drop-shadow-[0_0_8px_rgba(250,204,21,0.6)] transition-all duration-300">
            {[...Array(5)].map((_, i) => (
              <StarIcon key={i} className="w-4 h-4 text-yellow-400" />
            ))}
          </div>
          <span className="text-base md:text-lg font-bold text-gray-900">5.0</span>
          <span className="text-sm text-gray-600 font-medium hidden sm:inline">滿分好評</span>
          <ExternalLinkIcon className="w-4 h-4 text-yellow-500/60 transition-all duration-300 group-hover:text-yellow-600 group-hover:scale-110" />
        </a>

        {/* Badge 3: 在地台泰家庭 */}
        <Link
          href="/about"
          className={`group ${badgeBase} border-primary/30 cursor-pointer hover:border-primary hover:bg-primary/10 ${hoverGlow} hover:-translate-y-1 active:scale-95 ${animationClass}`}
          style={{ transitionDelay: '200ms' }}
        >
          {/* Animated pulse ring on mobile */}
          {showPulse && <PulseRing delay={400} />}

          <span className="text-base md:text-lg font-bold text-primary">在地台泰</span>
          <span className="text-sm text-gray-700 font-medium">家庭</span>
          <ArrowIcon className="w-4 h-4 text-primary/60 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
      </div>
    </div>
  )

  // Compact mode: render badges directly without section wrapper
  if (compact) {
    return <div ref={sectionRef as React.RefObject<HTMLDivElement>}>{badges}</div>
  }

  return (
    <section ref={sectionRef} className="py-8 bg-gray-50 border-y border-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {badges}
      </div>
    </section>
  )
}
