'use client'

import { useEffect, useRef } from 'react'
import { trackScrollDepth } from '@/lib/analytics'

interface ScrollDepthTrackerProps {
  pageTitle: string
}

export default function ScrollDepthTracker({ pageTitle }: ScrollDepthTrackerProps) {
  const trackedMilestones = useRef<Set<25 | 50 | 75 | 90>>(new Set())

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      if (docHeight <= 0) return

      const scrollPercent = (scrollTop / docHeight) * 100
      const milestones: (25 | 50 | 75 | 90)[] = [25, 50, 75, 90]

      for (const milestone of milestones) {
        if (scrollPercent >= milestone && !trackedMilestones.current.has(milestone)) {
          trackedMilestones.current.add(milestone)
          trackScrollDepth(milestone, pageTitle)
        }
      }
    }

    // Throttle scroll events
    let ticking = false
    const throttledScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', throttledScroll, { passive: true })
    return () => window.removeEventListener('scroll', throttledScroll)
  }, [pageTitle])

  return null
}
