import type { Metadata } from 'next'
import { client } from '@/sanity/client'
import { CAR_CHARTER_ENTITY_SENTENCE, ensureEntitySentence } from '@/lib/brand-entity'
import { formatFamilyCountLabel } from '@/lib/family-count'
import { fetchTotalFamilyCount } from '@/lib/notion'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'
import { FeatureGrid, PricingTable, FAQSection, VideoPlayer, ImageGallery, ProcessSteps } from '@/components/cms'

// ISR: Revalidate every 60 seconds
export const revalidate = 60

export const metadata: Metadata = {
  title: '清邁親子包車2026｜兒童座椅、中文導遊、司機導遊分工｜清微旅行',
  description: '清邁親子包車首選！清微旅行提供司機+導遊專業分工（不是一人包辦）、兒童安全座椅（0-6歲皆有）、全程中文溝通。清邁一日 NT$3,200 起，清萊一日 NT$4,500 起。台灣爸爸+泰國媽媽在地經營，專為親子家庭設計的彈性行程。',
  alternates: {
    canonical: 'https://chiangway-travel.com/services/car-charter',
  },
  openGraph: {
    title: '清邁親子包車2026｜兒童座椅、中文導遊、司機導遊分工｜清微旅行',
    description: '清邁親子包車首選！清微旅行提供司機+導遊專業分工、兒童安全座椅（0-6歲）、全程中文溝通。清邁一日 NT$3,200 起。',
    url: 'https://chiangway-travel.com/services/car-charter',
    images: [{ url: '/images/og-image.png', width: 1200, height: 630, alt: '清邁親子包車服務 - 清微旅行' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '清邁親子包車2026｜兒童座椅、中文導遊｜清微旅行',
    description: '清邁親子包車首選！司機+導遊專業分工、兒童安全座椅、全程中文。清邁一日 NT$3,200 起。',
    images: ['/images/og-image.png'],
  },
}

const carCharterMetadataDescription = ensureEntitySentence(
  typeof metadata.description === 'string' ? metadata.description : '',
  CAR_CHARTER_ENTITY_SENTENCE,
  ['清微旅行', '清邁親子包車']
)

metadata.description = carCharterMetadataDescription

if (metadata.openGraph) {
  metadata.openGraph.description = carCharterMetadataDescription
}

if (metadata.twitter) {
  metadata.twitter.description = carCharterMetadataDescription
}

// Default data - Brand: 強調司機導遊分工差異化
const defaultData = {
  heroTitle: '清邁親子包車服務',
  heroSubtitle: '司機 + 導遊分開服務，不是一人包辦。\n司機專心開車更安全，導遊專心照顧孩子更貼心。',
  heroCtaText: 'LINE 聊聊你的行程',
  heroCtaLink: 'https://line.me/R/ti/p/@037nyuwk',
  // Video (vc_h264 for iOS compatibility)
  videoUrl: 'https://res.cloudinary.com/dlgzrtl75/video/upload/vc_h264/v1769163410/790057116.088289_vz6u16.mp4',
  videoTitle: '清邁包車服務介紹',
  features: [
    { icon: '🛡️', title: '司機 + 導遊分工', description: '司機專心開車不分心，導遊全程陪伴照顧孩子，安全又貼心' },
    { icon: '🚐', title: '舒適車輛', description: '寬敞 SUV 或 Van，空間充足放行李和嬰兒車' },
    { icon: '🧒', title: '兒童安全座椅', description: '提供各年齡適用的安全座椅，事先告知即可準備' },
    { icon: '🗓️', title: '完全客製行程', description: '沒有固定路線，依孩子狀況隨時調整，不趕路' },
    { icon: '✈️', title: '接送機服務', description: '機場接送，讓你一落地就開始輕鬆旅程' },
    { icon: '💬', title: '全程中文溝通', description: '從諮詢到結束都用中文，完全無障礙' },
  ],
  faq: [
    { question: '價格包含什麼？', answer: '包含車輛、司機、油資、過路費。導遊服務另計，依行程複雜度報價。' },
    { question: '司機會說中文嗎？', answer: '司機是泰國人，不會說中文。我們採用專業分工：泰文司機負責開車，中文導遊負責溝通與照顧。行程會事先排好貼在 LINE 群組，司機照表走。' },
    { question: '超時怎麼計算？', answer: '清邁用車 10 小時、清萊 12 小時。超過用車時數後，需支付司機與導遊各 200 泰銖/小時的超時費。彈性 30 分鐘內不收費。' },
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
  heroTitle,
  heroSubtitle,
  heroCtaText,
  heroCtaLink,
  videoShow,
  videoUrl,
  videoPoster,
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
  const [data, familyCount] = await Promise.all([
    getCarCharterData(),
    fetchTotalFamilyCount(),
  ])

  const heroTitle = data?.heroTitle || defaultData.heroTitle
  const heroSubtitle = ensureEntitySentence(
    data?.heroSubtitle || defaultData.heroSubtitle,
    CAR_CHARTER_ENTITY_SENTENCE,
    ['清微旅行', '清邁親子包車']
  )
  const heroCtaText = data?.heroCtaText || defaultData.heroCtaText
  const heroCtaLink = data?.heroCtaLink || defaultData.heroCtaLink
  const features = data?.features?.length > 0 ? data.features : defaultData.features
  const faq = data?.faq?.length > 0 ? data.faq : defaultData.faq
  // Video - always use default if Sanity doesn't have one
  const videoUrl = data?.videoUrl || defaultData.videoUrl
  const videoTitle = data?.videoTitle || defaultData.videoTitle
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
