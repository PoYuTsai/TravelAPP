import type { Metadata } from 'next'
import Link from 'next/link'
import { client } from '@/sanity/client'
import { formatFamilyCountLabel } from '@/lib/family-count'
import { fetchTotalFamilyCount } from '@/lib/notion'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'
import { FeatureGrid, FAQSection, VideoPlayer, ImageGallery, ProcessSteps } from '@/components/cms'
import { CAR_CHARTER_PUBLIC_COPY } from '@/lib/pricing/publicCopy'
import { PACKAGE_ANCHORS } from './packageAnchors'

// ISR: Revalidate every 60 seconds
export const revalidate = 60

const { cityDayFromThb: CITY_DAY_FROM_THB } = CAR_CHARTER_PUBLIC_COPY.startingPrices

export const metadata: Metadata = {
  title: CAR_CHARTER_PUBLIC_COPY.metadata.title,
  description: CAR_CHARTER_PUBLIC_COPY.metadata.description,
  alternates: {
    canonical: 'https://chiangway-travel.com/services/car-charter',
  },
  openGraph: {
    title: CAR_CHARTER_PUBLIC_COPY.metadata.title,
    description: CAR_CHARTER_PUBLIC_COPY.metadata.socialDescription,
    url: 'https://chiangway-travel.com/services/car-charter',
    images: [{ url: '/images/og-image.png', width: 1200, height: 630, alt: '清微旅行清邁親子包車' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: CAR_CHARTER_PUBLIC_COPY.metadata.title,
    description: CAR_CHARTER_PUBLIC_COPY.metadata.socialDescription,
    images: ['/images/og-image.png'],
  },
}

// CMS fallback for media fields. Public service and pricing copy is code-owned.
const mediaFallback = {
  // Video (vc_h264 for iOS compatibility)
  videoUrl: 'https://res.cloudinary.com/dlgzrtl75/video/upload/vc_h264/v1769163410/790057116.088289_vz6u16.mp4',
  videoTitle: '清邁包車服務介紹',
}

// Service Schema for SEO
const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: '清邁親子包車｜泰國司機與中文導遊選配',
  description: CAR_CHARTER_PUBLIC_COPY.serviceSchemaDescription,
  provider: {
    '@type': 'LocalBusiness',
    name: '清微旅行 Chiangway Travel',
  },
  areaServed: {
    '@type': 'City',
    name: 'Chiang Mai',
  },
  offers: {
    '@type': 'Offer',
    priceCurrency: 'THB',
    price: String(CITY_DAY_FROM_THB),
    priceValidUntil: '2026-12-31',
    description: `清邁市區標準泰國司機方案一日（10 小時）每人 THB ${CITY_DAY_FROM_THB} 起，中文導遊與兒童安全座椅另行選配`,
  },
}

// FAQ Schema for SEO
function generateFaqSchema(faqItems: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

const carCharterQuery = `*[_type == "carCharter"][0]{
  videoShow,
  videoUrl,
  videoPoster,
  videoTitle,
  process,
  gallery
}`

async function getCarCharterData() {
  try {
    return await client.fetch(carCharterQuery)
  } catch {
    return null
  }
}

export default async function CarCharterPage() {
  const [data, familyCount] = await Promise.all([
    getCarCharterData(),
    fetchTotalFamilyCount(),
  ])

  const heroTitle = CAR_CHARTER_PUBLIC_COPY.heroTitle
  const heroSubtitle = CAR_CHARTER_PUBLIC_COPY.heroSubtitle
  const heroCtaText = CAR_CHARTER_PUBLIC_COPY.heroCtaText
  const heroCtaLink = CAR_CHARTER_PUBLIC_COPY.heroCtaLink
  const features = CAR_CHARTER_PUBLIC_COPY.features
  const faq = CAR_CHARTER_PUBLIC_COPY.faq
  // Video - always use default if Sanity doesn't have one
  const videoUrl = data?.videoUrl || mediaFallback.videoUrl
  const videoTitle = data?.videoTitle || mediaFallback.videoTitle
  const familyCountLabel = formatFamilyCountLabel(familyCount)

  const faqSchema = generateFaqSchema(faq)

  return (
    <>
      {/* SEO Schema Markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="py-12 md:py-20">
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {heroTitle}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto whitespace-pre-line">
              {heroSubtitle}
            </p>
          </div>
          <div className="flex justify-center gap-4">
            <Button href={heroCtaLink} external={heroCtaLink.startsWith('http')} size="lg">
              {heroCtaText}
            </Button>
          </div>
        </section>

        {/* Video - responsive: portrait on mobile, landscape on desktop */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
          <VideoPlayer
            videoUrl={videoUrl}
            poster={data?.videoPoster}
            title={videoTitle}
            aspect="responsive"
          />
        </section>

        {/* Features */}
        <section className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle title="服務特色" subtitle="專為親子家庭設計" />
            <FeatureGrid features={features} columns={3} />
          </div>
        </section>

        {/* Pricing — 對外僅顯示常見套餐起價，完整人數×地區×導遊價目表保留於內部定價引擎 */}
        <section
          id={CAR_CHARTER_PUBLIC_COPY.sectionIds.pricing}
          className="border-y border-amber-100 bg-amber-50/40 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionTitle
              title="熱門套餐參考價"
              subtitle="先掌握預算，再把行程調成你們家的樣子"
            />

            <div
              data-testid="package-pricing-basis"
              className="mx-auto mb-8 max-w-3xl rounded-2xl border border-amber-200 bg-white px-5 py-4 text-center shadow-sm sm:px-6"
            >
              <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
                <span className="rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-white">
                  6 人同行基準
                </span>
                <p className="text-base font-bold text-gray-900">以下金額為每人參考起價</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                實際費用會依日期、同行人數、孩子年齡、每日路線與中文導遊需求正式報價。
              </p>
            </div>

            {/* 三大套餐錨點價 */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {PACKAGE_ANCHORS.map((pkg) => (
                <Link
                  key={pkg.name}
                  href={pkg.href}
                  className="group block rounded-3xl border border-amber-100 bg-white p-6 text-center shadow-sm transition-colors duration-200 hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                  <p className="mb-3 text-base font-medium text-gray-600">{pkg.name}</p>
                  <p className="text-3xl font-bold tracking-tight text-gray-950">
                    THB {pkg.pricePerPerson.toLocaleString('en-US')}
                    <span className="ml-1 text-sm font-semibold tracking-normal text-gray-600">
                      ／人參考起價
                    </span>
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-gray-600">{pkg.summary}</p>
                  <p className="mt-5 text-sm font-bold text-amber-700 transition-colors duration-200 group-hover:text-amber-900 motion-reduce:transition-none">
                    查看套餐內容 →
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Process Steps */}
        {data?.process?.length > 0 && (
          <section className="bg-gray-50 py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <SectionTitle title="預訂流程" subtitle="簡單五步驟，輕鬆預訂" />
              <ProcessSteps steps={data.process} />
            </div>
          </section>
        )}

        {/* Gallery */}
        {data?.gallery?.length > 0 && (
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <SectionTitle title="車輛照片" />
              <ImageGallery images={data.gallery} columns={3} />
            </div>
          </section>
        )}

        {/* FAQ */}
        <section id={CAR_CHARTER_PUBLIC_COPY.sectionIds.faq} className="bg-gray-50 py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle title="常見問題" />
            <FAQSection items={faq} />
          </div>
        </section>

        {/* CTA - 差異化：強調客製化 */}
        <section className="py-16 bg-primary/10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              每個家庭的清邁之旅都不一樣
            </h2>
            <p className="text-gray-600 mb-2">
              告訴我們孩子年齡、興趣、體力，我們根據 {familyCountLabel} 組家庭的經驗幫你規劃
            </p>
            <p className="text-sm text-gray-500 mb-6">
              平均 2 小時內回覆
            </p>
            <Button href={heroCtaLink} external={heroCtaLink.startsWith('http')} size="lg">
              LINE 分享你的行程需求
            </Button>
          </div>
        </section>
      </div>
    </>
  )
}
