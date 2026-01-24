'use client'

import { useEffect } from 'react'
import { trackTourView } from '@/lib/analytics'

interface TourViewTrackerProps {
  title: string
  slug: string
  type: 'package' | 'dayTour'
}

export default function TourViewTracker({ title, slug, type }: TourViewTrackerProps) {
  useEffect(() => {
    trackTourView(title, slug, type)
  }, [title, slug, type])

  return null
}
