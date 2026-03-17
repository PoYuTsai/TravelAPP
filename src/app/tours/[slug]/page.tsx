import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'
import LineCTAButton from '@/components/ui/LineCTAButton'
import StopsCarousel from '@/components/tours/StopsCarousel'
import TourViewTracker from '@/components/tours/TourViewTracker'
import RelatedTours from '@/components/tours/RelatedTours'
import RelatedBlogPosts from '@/components/tours/RelatedBlogPosts'
import Breadcrumb from '@/components/ui/Breadcrumb'
import OverviewVideo from '@/components/tours/OverviewVideo'
import { mergeSiteSettings, siteSettingsQuery } from '@/lib/site-settings'

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
  image?: unknown
}

interface TourPackage {
  _type: 'tourPackage'
  title: string
  slug: string
  subtitle?: string
  coverImage?: { alt?: string }
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
  coverImage?: { alt?: string }
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
    const pkg = await client.fetch<TourPackage | null>(packageQuery, { slug })
    if (pkg) return pkg

    const dayTour = await client.fetch<DayTour | null>(dayTourQuery, { slug })
    if (dayTour) return dayTour

    return null
  } catch {
    return null
  }
}

async function getSiteSettings() {
  try {
    return await client.fetch(siteSettingsQuery)
  } catch {
    return null
  }
}

const allSlugsQuery = `{
  "packages": *[_type == "tourPackage" && defined(slug.current)][].slug.current,
  "dayTours": *[_type == "dayTour" && defined(slug.current)][].slug.current
}`

export async function generateStaticParams() {
  try {
    const { packages, dayTours } = await client.fetch(allSlugsQuery)
    const allSlugs = [...(packages || []), ...(dayTours || [])]
    return allSlugs.map((slug: string) => ({ slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tour = await getTourData(slug)

  if (!tour) {
    return { title: '找不到行程' }
  }

  const description =
    tour.subtitle ||
    ('description' in tour && tour.description) ||
    `${tour.title} - 清微旅行清邁在地包車行程`
  const imageUrl = tour.coverImage
    ? urlFor(tour.coverImage).width(1200).height(630).url()
    : undefined

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
      siteName: '清微旅行 Chiangway Travel',
      locale: 'zh_TW',
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

function getTourTypeLabel(tour: TourData) {
  return tour._type === 'tourPackage' ? '多日包車套裝' : '包車一日遊'
}

function getPriceLabel(tour: TourData) {
  if (tour._type === 'tourPackage') {
    return tour.priceRange || '依日期、人數與住宿位置客製報價'
  }

  if (!tour.basePrice) {
    return '依日期與路線客製報價'
  }

  return `THB ${tour.basePrice.toLocaleString()}${tour.priceUnit || '/車'}`
}

function getSecondaryAnchor(tour: TourData) {
  if (tour._type === 'tourPackage' && tour.dailySchedule?.length) {
    return '#itinerary'
  }

  if (tour._type === 'dayTour' && tour.stops?.length) {
    return '#stops'
  }

  return '#pricing'
}

export default async function TourDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [tour, rawSiteSettings] = await Promise.all([getTourData(slug), getSiteSettings()])

  if (!tour) {
    notFound()
  }

  const siteSettings = mergeSiteSettings(rawSiteSettings)
  const isPackage = tour._type === 'tourPackage'
  const packageTour = isPackage ? tour : null
  const dayTour = !isPackage ? tour : null
  const typeLabel = getTourTypeLabel(tour)
  const priceLabel = getPriceLabel(tour)
  const secondaryAnchor = getSecondaryAnchor(tour)
  const highlightItems = tour.highlights?.slice(0, 5) || []
  const reviewSummary = `${siteSettings.aggregateRating.ratingValue} / ${siteSettings.aggregateRating.reviewCount}+`
  const heroSummaryCards = [
    {
      label: '行程型態',
      value: typeLabel,
    },
    {
      label: isPackage ? '價格參考' : '基礎價格',
      value: priceLabel,
    },
    {
      label: '旅客評價',
      value: reviewSummary,
    },
  ]

  const description =
    tour.subtitle ||
    (dayTour?.description ?? '') ||
    '依家庭節奏安排的清邁在地行程，讓移動、景點和休息更平衡。'

  const tourSchema = {
    '@context': 'https://schema.org',
    '@type': isPackage ? 'TouristTrip' : 'Product',
    name: tour.title,
    description,
    ...(tour.coverImage && {
      image: urlFor(tour.coverImage).width(1200).height(630).url(),
    }),
    provider: {
      '@type': 'TravelAgency',
      name: siteSettings.businessName,
      url: 'https://chiangway-travel.com',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: String(siteSettings.aggregateRating.ratingValue),
      reviewCount: String(siteSettings.aggregateRating.reviewCount),
      bestRating: '5',
      worstRating: '1',
    },
    ...(isPackage && packageTour?.duration
      ? {
          itinerary: {
            '@type': 'ItemList',
            numberOfItems: packageTour.dailySchedule?.length || 0,
          },
        }
      : {}),
    ...(!isPackage && dayTour?.basePrice
      ? {
          offers: {
            '@type': 'Offer',
            price: dayTour.basePrice,
            priceCurrency: 'THB',
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  }

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
        name: '行程案例',
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
    <div className="py-12 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(tourSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <TourViewTracker
        title={tour.title}
        slug={tour.slug}
        type={isPackage ? 'package' : 'dayTour'}
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Breadcrumb
          items={[
            { label: '首頁', href: '/' },
            { label: '行程案例', href: '/tours' },
            { label: tour.title },
          ]}
        />

        <section className="relative mt-4 overflow-hidden rounded-[36px] bg-stone-950 px-6 py-8 shadow-[0_34px_100px_-45px_rgba(0,0,0,0.55)] md:px-10 md:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,192,9,0.28),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_24%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div className="max-w-3xl">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-sm font-medium text-white/82 backdrop-blur-sm">
                  {typeLabel}
                </span>
                {isPackage && packageTour?.duration && (
                  <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-sm font-medium text-white/82 backdrop-blur-sm">
                    {packageTour.duration}
                  </span>
                )}
                {!isPackage && dayTour?.basePrice && (
                  <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-sm font-medium text-white/82 backdrop-blur-sm">
                    {priceLabel}
                  </span>
                )}
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-sm font-medium text-white/82 backdrop-blur-sm">
                  {siteSettings.aggregateRating.reviewCount}+ 則旅客回饋
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-bold leading-tight text-white md:text-5xl">
                {tour.title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/76 md:text-xl">
                {description}
              </p>

              {highlightItems.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {highlightItems.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-sm text-white/82 backdrop-blur-sm"
                    >
                      #{item}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <LineCTAButton
                  location="Tour Detail Hero CTA"
                  className="shadow-[0_20px_45px_-18px_rgba(247,192,9,0.88)]"
                >
                  LINE 詢問這個行程
                </LineCTAButton>
                <Button
                  href={secondaryAnchor}
                  variant="outline"
                  size="lg"
                  className="border-white/35 text-white hover:border-white hover:bg-white hover:text-stone-900"
                >
                  先看重點內容
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-white/12 bg-white/8 p-3 backdrop-blur-sm">
              <div className="overflow-hidden rounded-[22px] bg-stone-900">
                {tour.coverImage ? (
                  <Image
                    src={urlFor(tour.coverImage).width(1200).auto('format').url()}
                    alt={tour.coverImage.alt || tour.title}
                    width={1200}
                    height={900}
                    className="h-auto w-full object-cover"
                    sizes="(max-width: 1024px) 100vw, 360px"
                    priority
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-primary-light to-primary/20">
                    <span className="text-7xl">{isPackage ? '🧳' : '🚐'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="-mt-6 grid gap-4 px-2 md:-mt-8 md:grid-cols-3">
          {heroSummaryCards.map((item) => (
            <div
              key={item.label}
              className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.35)]"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-400">
                {item.label}
              </p>
              <p className="mt-2 text-base font-semibold leading-7 text-stone-900">{item.value}</p>
            </div>
          ))}
        </div>

        <section className="mt-16 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[32px] bg-white px-6 py-6 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.2)] md:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
              行程概覽
            </p>
            <h2 className="mt-3 text-2xl font-bold text-stone-900">
              這趟旅程大致會是這種感覺
            </h2>
            <p className="mt-4 text-base leading-8 text-stone-700">
              {isPackage
                ? `${packageTour?.subtitle || '適合想把清邁周邊玩得更完整的旅客。'} 我們會把每天的節奏、移動距離與適合停留的時間都排順。`
                : dayTour?.description || '這是一條從清邁出發、適合一日包車安排的路線，重點是把移動和停留感受抓得更舒服。'}
            </p>

            {isPackage && packageTour?.overviewVideo && (
              <div className="mt-8">
                <OverviewVideo src={packageTour.overviewVideo} />
              </div>
            )}
          </div>

          <aside className="rounded-[32px] bg-amber-50 px-6 py-6 md:px-7">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              {isPackage ? '適合這樣的旅客' : '出發前提醒'}
            </p>
            <h2 className="mt-3 text-2xl font-bold text-stone-900">
              {isPackage ? '如果你在找這種節奏，會很適合' : '先把這幾件事想好，體驗會更順'}
            </h2>
            <ul className="mt-5 space-y-3">
              {(isPackage ? packageTour?.suitableFor : dayTour?.tips)?.map((item) => (
                <li key={item} className="flex items-start gap-3 text-stone-700">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-semibold text-primary shadow-sm">
                    ✓
                  </span>
                  <span className="leading-7">{item}</span>
                </li>
              ))}
            </ul>
            {!isPackage && dayTour?.additionalInfo && (
              <div className="mt-6 rounded-2xl bg-white px-4 py-4">
                <p className="text-sm leading-7 text-stone-700 whitespace-pre-line">
                  {dayTour.additionalInfo}
                </p>
              </div>
            )}
          </aside>
        </section>

        {isPackage && packageTour?.dailySchedule && packageTour.dailySchedule.length > 0 && (
          <section
            id="itinerary"
            className="mt-16 rounded-[32px] bg-stone-50 px-6 py-8 md:px-8 md:py-10"
          >
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                Itinerary
              </p>
              <h2 className="mt-3 text-3xl font-bold text-stone-900">每天大致怎麼安排</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">
                先讓你抓到節奏與路線方向。細節仍會依日期、住宿與旅伴組成再做微調。
              </p>
            </div>
            <div className="mt-8 space-y-4">
              {packageTour.dailySchedule.map((day) => (
                <div
                  key={day.day}
                  className="rounded-[28px] border border-stone-200 bg-white px-5 py-5 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.25)] md:px-6"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    <div className="flex items-center gap-3 md:min-w-[220px]">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-stone-950 shadow-sm">
                        {day.emoji || day.day}
                      </div>
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-400">
                          Day {day.day}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-stone-900">{day.title}</h3>
                      </div>
                    </div>
                    <p className="text-base leading-7 text-stone-700 md:flex-1">{day.activities}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!isPackage && dayTour?.stops && dayTour.stops.length > 0 && (
          <section id="stops" className="mt-16 rounded-[32px] bg-stone-50 px-6 py-8 md:px-8 md:py-10">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
                Stops
              </p>
              <h2 className="mt-3 text-3xl font-bold text-stone-900">這趟會經過哪些點</h2>
              <p className="mt-4 text-base leading-7 text-stone-600">
                用滑動方式先看整體氣氛與停留重點，幫你快速判斷是不是喜歡的路線。
              </p>
            </div>
            <div className="mt-8">
              <StopsCarousel stops={dayTour.stops} />
            </div>
          </section>
        )}

        {(tour.includes?.length || tour.excludes?.length) && (
          <section className="mt-16 grid gap-6 lg:grid-cols-2">
            {tour.includes && tour.includes.length > 0 && (
              <div className="rounded-[28px] border border-emerald-100 bg-emerald-50/80 px-6 py-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700/70">
                  Includes
                </p>
                <h2 className="mt-3 text-2xl font-bold text-stone-900">這趟通常已包含</h2>
                <ul className="mt-5 space-y-3">
                  {tour.includes.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-stone-700">
                      <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-semibold text-emerald-600 shadow-sm">
                        ✓
                      </span>
                      <span className="leading-7">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tour.excludes && tour.excludes.length > 0 && (
              <div className="rounded-[28px] border border-stone-200 bg-stone-50 px-6 py-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-400">
                  Excludes
                </p>
                <h2 className="mt-3 text-2xl font-bold text-stone-900">通常不含的項目</h2>
                <ul className="mt-5 space-y-3">
                  {tour.excludes.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-stone-700">
                      <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-semibold text-stone-500 shadow-sm">
                        −
                      </span>
                      <span className="leading-7">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section
          id="pricing"
          className="mt-16 rounded-[32px] bg-stone-950 px-6 py-8 md:px-8 md:py-10"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-light/90">
                Pricing
              </p>
              <h2 className="mt-3 text-3xl font-bold text-white">
                {isPackage ? '這趟行程的費用會怎麼抓' : '這條路線的價格怎麼看'}
              </h2>
              <p className="mt-4 text-base leading-7 text-white/72">
                {isPackage
                  ? '多日包車通常會依日期、旅伴人數、住宿位置與實際路線一起估算，所以這裡先給你抓概念。'
                  : '一日遊通常會有基礎價格，但若有跨區、加時或導遊搭配，也會再依需求調整。'}
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <LineCTAButton
                  location="Tour Detail Pricing CTA"
                  className="shadow-[0_20px_45px_-18px_rgba(247,192,9,0.88)]"
                >
                  LINE 詢問實際報價
                </LineCTAButton>
                <Button
                  href="#related-content"
                  variant="outline"
                  className="border-white/35 text-white hover:border-white hover:bg-white hover:text-stone-900"
                >
                  看更多延伸內容
                </Button>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/12 bg-white/94 p-6 shadow-[0_26px_70px_-35px_rgba(0,0,0,0.45)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                費用摘要
              </p>
              <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-4">
                <p className="text-sm font-medium text-stone-500">
                  {isPackage ? '整體價格參考' : '基礎價格'}
                </p>
                <p className="mt-1 text-2xl font-bold text-stone-900">{priceLabel}</p>
              </div>

              {(packageTour?.priceNote || dayTour?.priceNote) && (
                <p className="mt-4 text-sm leading-6 text-stone-600">
                  {packageTour?.priceNote || dayTour?.priceNote}
                </p>
              )}

              {dayTour?.guidePrice && (
                <div className="mt-4 rounded-2xl bg-stone-100 px-4 py-4">
                  <p className="text-sm font-medium text-stone-500">中文導遊加價參考</p>
                  <p className="mt-1 text-xl font-bold text-stone-900">
                    THB {dayTour.guidePrice.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-[32px] bg-amber-50 px-8 py-10 text-center md:px-12 md:py-14">
          <h2 className="text-3xl font-bold text-stone-900 md:text-4xl">
            想知道這個行程適不適合你們家，直接問最快
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-stone-700 md:text-lg">
            把日期、人數、孩子年齡或住宿位置丟給我們，我們可以先幫你判斷這條路線適不適合，再一起調整。
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <LineCTAButton
              location="Tour Detail Bottom CTA"
              className="shadow-[0_20px_45px_-18px_rgba(247,192,9,0.88)]"
            >
              LINE 詢問這個行程
            </LineCTAButton>
            <Button href="/tours" variant="secondary">
              回行程列表再看看
            </Button>
          </div>
        </section>

        <div id="related-content" className="mt-16">
          <RelatedTours currentSlug={tour.slug} currentType={tour._type} />
          <RelatedBlogPosts tourTitle={tour.title} tourHighlights={tour.highlights} />
        </div>
      </div>
    </div>
  )
}
