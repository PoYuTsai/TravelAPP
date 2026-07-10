// src/components/tours/DayTourCard.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { urlFor } from '@/sanity/client'
import {
  DAY_TOUR_PUBLIC_PRICING,
  getDayTourPricingTierLabel,
} from '@/lib/pricing/dayTourPricing'

// Map location codes to Chinese names
const locationNames: Record<string, string> = {
  'doi-inthanon': '茵他儂',
  'chiang-rai': '清萊',
  'lampang': '南邦',
  'lamphun': '南奔',
  'chiang-mai': '清邁',
}

interface DayTourCardProps {
  title: string
  slug: string
  location?: string
  coverImage?: any
  highlights?: string[]
  pricingTier?: unknown
}

export default function DayTourCard({
  title,
  slug,
  location = 'chiang-mai',
  coverImage,
  highlights,
  pricingTier,
}: DayTourCardProps) {
  const locationDisplay = locationNames[location] || location || '清邁'
  return (
    <Link
      href={`/tours/${slug}`}
      className="group block bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
    >
      {/* Cover Image */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-emerald-100 to-emerald-50">
        {coverImage ? (
          <Image
            src={urlFor(coverImage).width(800).height(600).quality(85).url()}
            alt={coverImage.alt || title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl">🌿</span>
          </div>
        )}

        {/* Location Badge */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-gray-700 flex items-center gap-1">
          <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          {locationDisplay}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-2">
          {title}
        </h3>

        {/* Highlights */}
        {highlights && highlights.length > 0 && (
          <p className="text-sm text-gray-500 mt-2 line-clamp-1">
            {highlights.slice(0, 3).join(' · ')}
          </p>
        )}

        <p className="mt-3 text-sm font-medium text-primary">
          {DAY_TOUR_PUBLIC_PRICING.cardLabel}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {getDayTourPricingTierLabel(pricingTier)}
        </p>

        {/* CTA Arrow */}
        <div className="mt-2 text-primary text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          查看詳情
          <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  )
}
