// src/app/tours/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'
import StopsCarousel from '@/components/tours/StopsCarousel'
import TourViewTracker from '@/components/tours/TourViewTracker'
import RelatedTours from '@/components/tours/RelatedTours'
import RelatedBlogPosts from '@/components/tours/RelatedBlogPosts'
import Breadcrumb from '@/components/ui/Breadcrumb'
import OverviewVideo from '@/components/tours/OverviewVideo'

// === Types ===

interface DailySchedule {
  day: number
  emoji?: string
  title: string
  activities: string
}

interface Stop {
  emoji?: string
  name: string
  description?: string
  image?: any
}

interface TourPackage {
  _type: 'tourPackage'
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
  overviewVideo?: string
}

interface DayTour {
  _type: 'dayTour'
  title: string
  slug: string
  subtitle?: string
  description?: string
  coverImage?: any
  highlights?: string[]
  stops?: Stop[]
  tips?: string[]
  additionalInfo?: string
  basePrice?: number
  priceUnit?: string
  priceNote?: string
  guidePrice?: number
  includes?: string[]
  excludes?: string[]
}

type TourData = TourPackage | DayTour

// === Queries ===

const packageQuery = `*[_type == "tourPackage" && slug.current == $slug][0]{
  _type,
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
  priceNote,
  overviewVideo
}`

const dayTourQuery = `*[_type == "dayTour" && slug.current == $slug][0]{
  _type,
  title,
  "slug": slug.current,
  subtitle,
  description,
  coverImage,
  highlights,
  stops,
  tips,
  additionalInfo,
  basePrice,
  priceUnit,
  priceNote,
  guidePrice,
  includes,
  excludes
}`

async function getTourData(slug: string): Promise<TourData | null> {
  try {
    // Try tourPackage first
    const pkg = await client.fetch(packageQuery, { slug })
    if (pkg) return pkg

    // Then try dayTour
    const dayTour = await client.fetch(dayTourQuery, { slug })
    if (dayTour) return dayTour

    return null
  } catch {
    return null
  }
}

// === Metadata ===

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tour = await getTourData(slug)

  if (!tour) {
    return { title: '找不到頁面' }
  }

  const description = tour.subtitle || `${tour.title} - 清微旅行精選行程`
  const imageUrl = tour.coverImage ? urlFor(tour.coverImage).width(1200).height(630).url() : undefined

  return {
    title: tour.title,
    description,
    alternates: {
      canonical: `https://chiangway-travel.com/tours/${slug}`,
    },
    openGraph: {
      title: tour.title,
      description,
      type: 'website',
      images: imageUrl ? [imageUrl] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: tour.title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  }
}

// === Page Component ===

export default async function TourDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tour = await getTourData(slug)

  if (!tour) {
    notFound()
  }

  const isPackage = tour._type === 'tourPackage'
  const isDayTour = tour._type === 'dayTour'

  // Generate TourPackage/Product Schema for SEO
  const tourSchema = {
    '@context': 'https://schema.org',
    '@type': isPackage ? 'TouristTrip' : 'Product',
    name: tour.title,
    description: tour.subtitle || `${tour.title} - 清微旅行精選行程`,
    ...(tour.coverImage && {
      image: urlFor(tour.coverImage).width(1200).height(630).url(),
    }),
    provider: {
      '@type': 'TravelAgency',
      name: '清微旅行 Chiangway Travel',
      url: 'https://chiangway-travel.com',
    },
    ...(isPackage && (tour as TourPackage).duration && {
      itinerary: {
        '@type': 'ItemList',
        numberOfItems: (tour as TourPackage).dailySchedule?.length || 0,
      },
    }),
    ...(isDayTour && (tour as DayTour).basePrice && {
      offers: {
        '@type': 'Offer',
        price: (tour as DayTour).basePrice,
        priceCurrency: 'THB',
        availability: 'https://schema.org/InStock',
      },
    }),
  }

  // BreadcrumbList Schema for SEO
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '首頁',
        item: 'https://chiangway-travel.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '行程',
        item: 'https://chiangway-travel.com/tours',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: tour.title,
        item: `https://chiangway-travel.com/tours/${slug}`,
      },
    ],
  }

  return (
    <div className="py-20">
      {/* Tour Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(tourSchema) }}
      />
      {/* BreadcrumbList Schema for SEO - safe usage, JSON.stringify of our own object */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <TourViewTracker
        title={tour.title}
        slug={tour.slug}
        type={isPackage ? 'package' : 'dayTour'}
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <Breadcrumb
          items={[
            { label: '首頁', href: '/' },
            { label: '行程', href: '/tours' },
            { label: tour.title },
          ]}
        />

        {/* Hero Section */}
        <div className="mb-8">
          {/* Cover Image - Full Display (preserves original aspect ratio) */}
          <div className="rounded-2xl overflow-hidden">
            {tour.coverImage ? (
              <Image
                src={urlFor(tour.coverImage).width(1200).auto('format').url()}
                alt={tour.coverImage.alt || tour.title}
                width={1200}
                height={800}
                className="w-full h-auto"
                sizes="(max-width: 768px) 100vw, 1200px"
              />
            ) : (
              <div className="w-full aspect-video bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                <span className="text-8xl">{isDayTour ? '🌿' : '🌴'}</span>
              </div>
            )}
          </div>

          {/* Title & Subtitle - Below Image */}
          <div className="mt-6">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{tour.title}</h1>
            {tour.subtitle && (
              <p className="text-lg md:text-xl text-gray-600">{tour.subtitle}</p>
            )}
          </div>

          {/* Highlights Tags - Below Title */}
          {tour.highlights && tour.highlights.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {tour.highlights.map((h) => (
                <span
                  key={h}
                  className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium"
                >
                  #{h}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Description (Day Tour only) */}
        {isDayTour && (tour as DayTour).description && (
          <section className="mb-12">
            <p className="text-lg text-gray-700 leading-relaxed">
              {(tour as DayTour).description}
            </p>
          </section>
        )}

        {/* Suitable For Section (Package only) */}
        {isPackage && (tour as TourPackage).suitableFor && (tour as TourPackage).suitableFor!.length > 0 && (
          <section className="mb-12 bg-primary-light/30 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              這趟旅程適合你，如果...
            </h2>
            <ul className="space-y-3">
              {(tour as TourPackage).suitableFor!.map((item, i) => (
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

        {/* Overview Video Section (Package only) */}
        {isPackage && (tour as TourPackage).overviewVideo && (
          <OverviewVideo src={(tour as TourPackage).overviewVideo!} />
        )}

        {/* Daily Schedule Section (Package only) */}
        {isPackage && (tour as TourPackage).dailySchedule && (tour as TourPackage).dailySchedule!.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">每日行程</h2>
            <div className="space-y-4">
              {(tour as TourPackage).dailySchedule!.map((day) => (
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

        {/* Stops Section (Day Tour only) - Carousel */}
        {isDayTour && (tour as DayTour).stops && (tour as DayTour).stops!.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">行程景點</h2>
            <StopsCarousel stops={(tour as DayTour).stops!} />
          </section>
        )}

        {/* Tips Section (Day Tour only) */}
        {isDayTour && (tour as DayTour).tips && (tour as DayTour).tips!.length > 0 && (
          <section className="mb-12 bg-amber-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              💡 貼心建議
            </h2>
            <ul className="space-y-2">
              {(tour as DayTour).tips!.map((tip, i) => (
                <li key={i} className="text-gray-700">• {tip}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Includes/Excludes Section */}
        {(tour.includes?.length || tour.excludes?.length) && (
          <section className="mb-12 grid md:grid-cols-2 gap-6">
            {tour.includes && tour.includes.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">費用包含</h3>
                <ul className="space-y-2">
                  {tour.includes.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-700">
                      <span className="text-green-500">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tour.excludes && tour.excludes.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">費用不含</h3>
                <ul className="space-y-2">
                  {tour.excludes.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-500">
                      <span className="text-gray-400">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Pricing Section */}
        {(isPackage && (tour as TourPackage).priceRange) && (
          <section className="mb-12 bg-gray-50 rounded-2xl p-6 md:p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">參考價格</h2>
            <div className="text-3xl font-bold text-primary mb-2">
              {(tour as TourPackage).priceRange}
            </div>
            {(tour as TourPackage).priceNote && (
              <p className="text-gray-500 text-sm">（{(tour as TourPackage).priceNote}）</p>
            )}
          </section>
        )}

        {isDayTour && (tour as DayTour).basePrice && (
          <section className="mb-12 bg-gray-50 rounded-2xl p-6 md:p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">包車費用</h2>
            <div className="text-3xl font-bold text-primary mb-2">
              ${(tour as DayTour).basePrice?.toLocaleString()}{(tour as DayTour).priceUnit || '/團'}
            </div>
            {(tour as DayTour).priceNote && (
              <p className="text-gray-500 text-sm">（{(tour as DayTour).priceNote}）</p>
            )}
            {(tour as DayTour).guidePrice && (
              <p className="text-gray-600 mt-2 text-sm">
                中文導遊加購：${(tour as DayTour).guidePrice?.toLocaleString()}/團
              </p>
            )}
          </section>
        )}

        {/* Additional Info (Day Tour only) */}
        {isDayTour && (tour as DayTour).additionalInfo && (
          <section className="mb-12 bg-blue-50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              📋 詳細說明
            </h2>
            <div className="text-gray-700 whitespace-pre-line">
              {(tour as DayTour).additionalInfo}
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="text-center bg-gradient-to-r from-primary-light to-primary/20 rounded-2xl p-8 md:p-12">
          <p className="text-gray-700 mb-2">
            {isDayTour ? '想了解更多細節？' : '這是範例行程，每個家庭的需求都不同'}
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-6">
            聊聊你們的想法，我們幫你規劃
          </p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
            LINE 聊聊
          </Button>
        </section>

        {/* Related Tours */}
        <RelatedTours
          currentSlug={tour.slug}
          currentType={tour._type}
        />

        {/* Related Blog Posts */}
        <RelatedBlogPosts
          tourTitle={tour.title}
          tourHighlights={tour.highlights}
        />
      </div>
    </div>
  )
}
