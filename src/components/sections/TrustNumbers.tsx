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

interface TrustNumbersProps {
  // Keep for backwards compatibility with Sanity CMS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items?: any[]
  // Compact mode for inline display (no section wrapper)
  compact?: boolean
}

export default function TrustNumbers({ compact = false }: TrustNumbersProps) {
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

  const familyCount = useCountAnimation(114, 1500, isVisible)

  const badges = (
    <div className="flex flex-wrap justify-center items-center gap-3 md:gap-6">
      {/* Badge 1: 114+ 家庭 */}
      <Link
        href="/tours"
        className="group flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full cursor-pointer transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:shadow-md"
      >
        <span className="text-base md:text-lg font-bold text-gray-900">
          {familyCount}+
        </span>
        <span className="text-sm text-gray-600">家庭</span>
        <ArrowIcon className="w-4 h-4 text-gray-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
      </Link>

      {/* Badge 2: 5.0 Stars (display only, no link until Google Business restored) */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full">
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => (
            <StarIcon key={i} className="w-4 h-4 text-yellow-400" />
          ))}
        </div>
        <span className="text-base md:text-lg font-bold text-gray-900">5.0</span>
      </div>

      {/* Badge 3: 在地家庭 */}
      <Link
        href="/homestay"
        className="group flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full cursor-pointer transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:shadow-md"
      >
        <span className="text-base md:text-lg font-bold text-gray-900">在地</span>
        <span className="text-sm text-gray-600">家庭</span>
        <ArrowIcon className="w-4 h-4 text-gray-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
      </Link>
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
