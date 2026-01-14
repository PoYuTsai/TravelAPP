import type { Metadata } from 'next'
import { client } from '@/sanity/client'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'
import { FeatureGrid, PricingTable, FAQSection, YouTubeEmbed, ImageGallery, ProcessSteps } from '@/components/cms'

// Disable caching for this page
export const revalidate = 0

export const metadata: Metadata = {
  title: '清邁親子包車服務 | 清微旅行',
  description: '專為親子家庭設計的清邁包車服務。司機導遊專業分工，兒童安全座椅，行程彈性不趕路。清邁一日 NT$ 3,200 起。',
}

// Default data
const defaultData = {
  heroTitle: '清邁親子包車服務',
  heroSubtitle: '司機導遊專業分工，兒童安全座椅準備好，行程彈性不趕路。\n讓在地爸媽帶你玩清邁。',
  heroCtaText: 'LINE 免費諮詢',
  heroCtaLink: 'https://line.me/R/ti/p/@037nyuwk',
  features: [
    { icon: '🚐', title: '舒適車輛', description: '寬敞 SUV 或 Van，空間充足放行李和嬰兒車' },
    { icon: '👨‍✈️', title: '司機 + 導遊分工', description: '司機專心開車，導遊專心服務，不是一人包辦' },
    { icon: '🧒', title: '兒童安全座椅', description: '提供各年齡適用的安全座椅，事先告知即可準備' },
    { icon: '🗓️', title: '行程彈性', description: '不跑固定路線，依孩子狀況隨時調整，不趕路' },
    { icon: '✈️', title: '接送機服務', description: '機場接送，讓你一落地就開始輕鬆旅程' },
    { icon: '💬', title: '全程中文', description: '從諮詢到結束都用中文，溝通無障礙' },
  ],
  faq: [
    { question: '價格包含什麼？', answer: '包含車輛、司機、油資、過路費。導遊服務另計，依行程複雜度報價。' },
    { question: '可以帶嬰兒車嗎？', answer: '可以，我們的車輛空間充足。請事先告知，我們會確保有足夠空間。' },
    { question: '安全座椅怎麼安排？', answer: '有的，請事先告知孩子年齡和體重，我們會準備適合的安全座椅。' },
    { question: '可以客製行程嗎？', answer: '當然可以，這是我們的特色。告訴我們想去的地方、孩子年齡，我們幫你規劃。' },
    { question: '怎麼預訂？', answer: '透過 LINE 聯繫我們，討論需求後會提供報價，確認後付訂金即可。' },
  ],
}

// Service Schema for SEO
const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: '清邁親子包車服務',
  description: '專為親子家庭設計的清邁包車服務。司機導遊專業分工，兒童安全座椅，行程彈性不趕路。',
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
    priceCurrency: 'TWD',
    price: '3200',
    priceValidUntil: '2026-12-31',
    description: '清邁一日（10小時）NT$ 3,200 起',
  },
}

const carCharterQuery = `*[_type == "carCharter"][0]{
  heroTitle,
  heroSubtitle,
  heroCtaText,
  heroCtaLink,
  videoShow,
  videoYoutubeId,
  videoTitle,
  features,
  pricingSectionTitle,
  pricingVehicleTypes,
  pricingFootnotes,
  process,
  gallery,
  faq
}`

async function getCarCharterData() {
  try {
    return await client.fetch(carCharterQuery)
  } catch {
    return null
  }
}

export default async function CarCharterPage() {
  const data = await getCarCharterData()

  const heroTitle = data?.heroTitle || defaultData.heroTitle
  const heroSubtitle = data?.heroSubtitle || defaultData.heroSubtitle
  const heroCtaText = data?.heroCtaText || defaultData.heroCtaText
  const heroCtaLink = data?.heroCtaLink || defaultData.heroCtaLink
  const features = data?.features?.length > 0 ? data.features : defaultData.features
  const faq = data?.faq?.length > 0 ? data.faq : defaultData.faq

  return (
    <>
      {/* SEO Schema Markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
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

        {/* Video (if available) */}
        {data?.videoShow && data?.videoYoutubeId && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
            <YouTubeEmbed videoId={data.videoYoutubeId} title={data.videoTitle} />
          </section>
        )}

        {/* Features */}
        <section className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle title="服務特色" subtitle="專為親子家庭設計" />
            <FeatureGrid features={features} columns={3} />
          </div>
        </section>

        {/* Pricing */}
        {data?.pricingVehicleTypes?.length > 0 && (
          <section className="py-16">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <SectionTitle
                title={data.pricingSectionTitle || '服務價格'}
                subtitle="實際報價依行程內容調整"
              />
              <PricingTable
                vehicleTypes={data.pricingVehicleTypes}
                footnotes={data.pricingFootnotes}
              />
            </div>
          </section>
        )}

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
        <section className="bg-gray-50 py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle title="常見問題" />
            <FAQSection items={faq} />
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              準備好預訂了嗎？
            </h2>
            <p className="text-gray-600 mb-6">
              告訴我們你的旅行日期和需求，我們會盡快回覆報價
            </p>
            <Button href={heroCtaLink} external={heroCtaLink.startsWith('http')} size="lg">
              {heroCtaText}
            </Button>
          </div>
        </section>
      </div>
    </>
  )
}
