// src/app/tours/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'

interface DailySchedule {
  day: number
  emoji?: string
  title: string
  activities: string
}

interface TourPackage {
  title: string
  slug: string
  subtitle?: string
  coverImage?: any
  duration?: string
  highlights?: string[]
  suitableFor?: string[]
  dailySchedule?: DailySchedule[]
  includes?: string[]
  excludes?: string[]
  priceRange?: string
  priceNote?: string
}

const packageQuery = `*[_type == "tourPackage" && slug.current == $slug][0]{
  title,
  "slug": slug.current,
  subtitle,
  coverImage,
  duration,
  highlights,
  suitableFor,
  dailySchedule,
  includes,
  excludes,
  priceRange,
  priceNote
}`

async function getPackage(slug: string): Promise<TourPackage | null> {
  try {
    return await client.fetch(packageQuery, { slug })
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const pkg = await getPackage(slug)

  if (!pkg) {
    return { title: '找不到頁面' }
  }

  return {
    title: `${pkg.title} | 清微旅行`,
    description: pkg.subtitle || `${pkg.title} - 清微旅行精選套餐`,
  }
}

export default async function TourPackagePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const pkg = await getPackage(slug)

  if (!pkg) {
    notFound()
  }

  return (
    <div className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="relative rounded-2xl overflow-hidden mb-12">
          {pkg.coverImage ? (
            <Image
              src={urlFor(pkg.coverImage).width(1200).height(600).url()}
              alt={pkg.coverImage.alt || pkg.title}
              width={1200}
              height={600}
              className="w-full h-64 md:h-96 object-cover"
            />
          ) : (
            <div className="w-full h-64 md:h-96 bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
              <span className="text-8xl">🌴</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{pkg.title}</h1>
            {pkg.subtitle && (
              <p className="text-lg md:text-xl opacity-90">{pkg.subtitle}</p>
            )}
            {pkg.highlights && pkg.highlights.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {pkg.highlights.map((h) => (
                  <span
                    key={h}
                    className="text-sm bg-white/20 backdrop-blur px-3 py-1 rounded-full"
                  >
                    #{h}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Suitable For Section */}
        {pkg.suitableFor && pkg.suitableFor.length > 0 && (
          <section className="mb-12 bg-primary-light/30 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              這趟旅程適合你，如果...
            </h2>
            <ul className="space-y-3">
              {pkg.suitableFor.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-700">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Daily Schedule Section */}
        {pkg.dailySchedule && pkg.dailySchedule.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">行程概覽</h2>
            <div className="space-y-4">
              {pkg.dailySchedule.map((day) => (
                <div
                  key={day.day}
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
                >
                  <div className="flex items-center gap-3 mb-2">
                    {day.emoji && <span className="text-2xl">{day.emoji}</span>}
                    <div>
                      <span className="text-sm text-primary font-medium">
                        Day {day.day}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {day.title}
                      </h3>
                    </div>
                  </div>
                  <p className="text-gray-600 ml-10">{day.activities}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Includes/Excludes Section */}
        <section className="mb-12 grid md:grid-cols-2 gap-6">
          {pkg.includes && pkg.includes.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">費用包含</h3>
              <ul className="space-y-2">
                {pkg.includes.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700">
                    <span className="text-green-500">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pkg.excludes && pkg.excludes.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">費用不含</h3>
              <ul className="space-y-2">
                {pkg.excludes.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-500">
                    <span className="text-gray-400">✗</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Pricing Section */}
        {pkg.priceRange && (
          <section className="mb-12 bg-gray-50 rounded-2xl p-6 md:p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">參考價格</h2>
            <div className="text-3xl font-bold text-primary mb-2">
              {pkg.priceRange}
            </div>
            {pkg.priceNote && (
              <p className="text-gray-500 text-sm">（{pkg.priceNote}）</p>
            )}
            <p className="text-gray-600 mt-4 text-sm">
              💬 實際費用依您的需求客製報價
            </p>
          </section>
        )}

        {/* CTA Section */}
        <section className="text-center bg-gradient-to-r from-primary-light to-primary/20 rounded-2xl p-8 md:p-12">
          <p className="text-gray-700 mb-2">
            這是範例行程，每個家庭的需求都不同
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-6">
            告訴我們你的想法，我們幫你量身打造 ✨
          </p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
            LINE 免費諮詢
          </Button>
        </section>
      </div>
    </div>
  )
}
