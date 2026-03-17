// src/components/tours/DayTourCard.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { urlFor } from '@/sanity/client'

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
  priceFrom?: number
}

export default function DayTourCard({
  title,
  slug,
  location = 'chiang-mai',
  coverImage,
  highlights,
  priceFrom,
}: DayTourCardProps) {
  const locationDisplay = locationNames[location] || location || '清邁'
  return (
    <Link
      href={`/tours/${slug}`}
      className="group block cursor-pointer overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_20px_60px_-38px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_80px_-40px_rgba(0,0,0,0.45)]"
    >
      {/* Cover Image */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-emerald-100 to-emerald-50">
        {coverImage ? (
          <Image
            src={urlFor(coverImage).width(800).height(600).quality(85).url()}
            alt={coverImage.alt || title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl">🌿</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 via-transparent to-transparent" />

        {/* Location Badge */}
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1.5 text-xs font-medium text-gray-700 backdrop-blur-sm">
          <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          {locationDisplay}
        </div>

        {priceFrom && (
          <div className="absolute bottom-3 left-3 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
            THB {priceFrom.toLocaleString()} 起
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="line-clamp-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-primary md:text-xl">
          {title}
        </h3>

        {/* Highlights */}
        {highlights && highlights.length > 0 && (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-500">
            {highlights.slice(0, 3).join(' · ')}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
          <div>
            <p className="text-sm font-medium text-stone-900">適合自由搭配</p>
            <p className="mt-1 text-xs text-stone-500">可和包車、多天行程彈性組合</p>
          </div>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition-all duration-300 group-hover:bg-primary group-hover:text-stone-950">
            <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  )
}
