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
      className="group block overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_24px_70px_-38px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_34px_90px_-40px_rgba(0,0,0,0.45)]"
    >
      {/* Cover Image */}
      <div className="relative aspect-[3/2] bg-gradient-to-br from-primary-light to-primary/20">
        {coverImage ? (
          <Image
            src={urlFor(coverImage).width(600).height(400).quality(85).url()}
            alt={coverImage.alt || title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">🌴</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/75 via-stone-950/10 to-transparent" />
        <div className="absolute left-4 top-4 inline-flex items-center rounded-full bg-white/92 px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm backdrop-blur-sm">
          招牌套餐
        </div>
        {duration && (
          <div className="absolute left-4 bottom-4 inline-flex items-center rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
            {duration}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 md:p-7">
        <h3 className="text-2xl font-bold text-stone-900 transition-colors group-hover:text-primary">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-3 line-clamp-2 text-base leading-7 text-stone-600">{subtitle}</p>
        )}

        {/* Highlights */}
        {highlights && highlights.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {highlights.slice(0, 4).map((h) => (
              <span
                key={h}
                className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600"
              >
                {h}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-5">
          <div>
            <p className="text-sm font-medium text-stone-900">看每日安排與行程節奏</p>
            <p className="mt-1 text-sm text-stone-500">適合第一次來清邁、想直接帶孩子出發的家庭</p>
          </div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-stone-950">
            <svg className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  )
}
