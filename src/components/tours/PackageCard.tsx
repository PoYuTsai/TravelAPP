// src/components/tours/PackageCard.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { urlFor } from '@/sanity/client'

interface PackageCardProps {
  title: string
  slug: string
  subtitle?: string
  coverImage?: any
  duration?: string
  highlights?: string[]
}

export default function PackageCard({
  title,
  slug,
  subtitle,
  coverImage,
  duration,
  highlights,
}: PackageCardProps) {
  return (
    <Link
      href={`/tours/${slug}`}
      className="group block bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
    >
      {/* Cover Image */}
      <div className="relative aspect-[3/2] bg-gradient-to-br from-primary-light to-primary/20">
        {coverImage ? (
          <Image
            src={urlFor(coverImage).width(600).height(400).url()}
            alt={coverImage.alt || title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">🌴</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {duration && (
          <span className="text-sm text-primary font-medium">{duration}</span>
        )}
        <h3 className="text-xl font-bold text-gray-900 mt-1 group-hover:text-primary transition-colors">
          {title}
        </h3>
        {subtitle && (
          <p className="text-gray-600 mt-2">{subtitle}</p>
        )}

        {/* Highlights */}
        {highlights && highlights.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {highlights.slice(0, 4).map((h) => (
              <span
                key={h}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
              >
                {h}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-4 text-primary font-medium flex items-center gap-1">
          了解更多
          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  )
}
