import type { Metadata } from 'next'
import Link from 'next/link'
import { client } from '@/sanity/client'
import { CAR_CHARTER_ENTITY_SENTENCE, ensureEntitySentence } from '@/lib/brand-entity'
import { formatFamilyCountLabel } from '@/lib/family-count'
import { fetchTotalFamilyCount } from '@/lib/notion'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'
import { FeatureGrid, PerPersonPricingTable, FAQSection, VideoPlayer, ImageGallery, ProcessSteps } from '@/components/cms'
import { calcPerPersonDay } from '@/lib/pricing/perPersonRates'
import { PACKAGE_ANCHORS } from './packageAnchors'

// ISR: Revalidate every 60 seconds
export const revalidate = 60

// 人頭計價起價（引擎推導，與價目表單一事實來源）：起價 = 各表最低每人日價
const CITY_DAY_FROM_THB = calcPerPersonDay('T1', 7, false) // 清邁市區，7 人 van 不含導遊
const CHIANGRAI_DAY_FROM_THB = calcPerPersonDay('T3', 7, false) // 清萊，7 人 van 不含導遊

export const metadata: Metadata = {
  title: '爸媽開的清邁親子包車｜兒童座椅、中文導遊、司機導遊分工｜清微旅行',
  description: `爸媽開的清邁親子包車 — 清微旅行提供泰國司機、中文導遊選配、0–2 歲嬰幼兒安全座椅與 LINE 中文支援。以人數計價：清邁一日每人 THB ${CITY_DAY_FROM_THB} 起、清萊一日每人 THB ${CHIANGRAI_DAY_FROM_THB.toLocaleString('en-US')} 起。台灣爸爸 Eric × 泰國媽媽 Min 經營，專為帶小孩的家庭設計。`,
  alternates: {
    canonical: 'https://chiangway-travel.com/services/car-charter',
  },
  openGraph: {
    title: '爸媽開的清邁親子包車｜兒童座椅、中文導遊、司機導遊分工｜清微旅行',
    description: `爸媽開的清邁親子包車 — 泰國司機、中文導遊選配、0–2 歲嬰幼兒安全座椅與 LINE 中文支援。清邁一日每人 THB ${CITY_DAY_FROM_THB} 起。`,
    url: 'https://chiangway-travel.com/services/car-charter',
    images: [{ url: '/images/og-image.png', width: 1200, height: 630, alt: '爸媽開的清邁親子包車 — 清微旅行' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '爸媽開的清邁親子包車｜兒童座椅、中文導遊｜清微旅行',
    description: `爸媽開的清邁親子包車 — 司機+導遊專業分工、兒童安全座椅、全程中文。清邁一日每人 THB ${CITY_DAY_FROM_THB} 起。`,
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
  heroSubtitle: '泰國司機專心開車，中文導遊可依需求選配。\n從行程討論到旅程結束，都有 LINE 中文支援。',
  heroCtaText: 'LINE 聊聊你的行程',
  heroCtaLink: 'https://line.me/R/ti/p/@037nyuwk',
  // Video (vc_h264 for iOS compatibility)
  videoUrl: 'https://res.cloudinary.com/dlgzrtl75/video/upload/vc_h264/v1769163410/790057116.088289_vz6u16.mp4',
  videoTitle: '清邁包車服務介紹',
  features: [
    { icon: '🛡️', title: '司機 + 導遊分工', description: '泰國司機專心開車，中文導遊可依需求選配' },
    { icon: '🚐', title: '舒適車輛', description: '寬敞 SUV 或 Van，空間充足放行李和嬰兒車' },
    { icon: '🧒', title: '嬰幼兒安全座椅', description: '提供 0–2 歲嬰幼兒安全座椅，事先告知數量即可準備' },
    { icon: '🗓️', title: '完全客製行程', description: '沒有固定路線，依孩子狀況隨時調整，不趕路' },
    { icon: '✈️', title: '接送機服務', description: '機場接送，讓你一落地就開始輕鬆旅程' },
    { icon: '💬', title: '全程中文溝通', description: '從諮詢到結束都用中文，完全無障礙' },
  ],
  faq: [
    { question: '價格包含什麼？', answer: '每人價已包含車輛、司機、油資、過路費、停車費與全程中文客服；選配中文導遊的方案，導遊費也已含在每人價內。門票、餐食與超時費另計。' },
    { question: '司機會說中文嗎？', answer: '司機是泰國人，不會說中文。我們採用專業分工：泰文司機負責開車，中文導遊負責溝通與照顧。行程會事先排好貼在 LINE 群組，司機照表走。' },
    { question: '超時怎麼計算？', answer: '清邁一日用車 10 小時、清萊與金三角一日 12 小時。超過用車時數後，超時費為每小時 300 泰銖，按台計收。彈性 30 分鐘內不收費。' },
    { question: '可以帶嬰兒車嗎？', answer: '可以，我們的車輛空間充足。請事先告知，我們會確保有足夠空間。' },
    { question: '安全座椅怎麼安排？', answer: '目前提供 0–2 歲嬰幼兒安全座椅，請在詢價時告知孩子年齡與需要數量。' },
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
    priceCurrency: 'THB',
    price: String(CITY_DAY_FROM_THB),
    priceValidUntil: '2026-12-31',
    description: `清邁市區一日（10小時）每人 THB ${CITY_DAY_FROM_THB} 起，依人數與區域計價`,
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
  process,
  gallery,
  faq,
  pricingFootnotes
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

        {/* Pricing — 人頭計價（價格由 perPersonRates 引擎推導，非 Sanity 內容） */}
        <section className="py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle
              title={data?.pricingSectionTitle || '包車價格參考'}
              subtitle="以人數計價，人越多每人越划算"
            />
            <PerPersonPricingTable footnotes={data?.pricingFootnotes} />

            {/* 三大套餐錨點價 */}
            <div className="mt-12">
              <h3 className="text-xl font-bold text-gray-950 mb-2 text-center">熱門套餐參考價</h3>
              <p className="mb-5 text-center text-sm text-gray-600">預設安排中文導遊；以下為 6 位成人同行參考</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {PACKAGE_ANCHORS.map((pkg) => (
                  <Link
                    key={pkg.name}
                    href={pkg.href}
                    className="group flex min-h-48 cursor-pointer flex-col rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-colors duration-200 hover:border-amber-400 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                  >
                    <p className="font-bold leading-snug text-gray-950">{pkg.name}</p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">{pkg.summary}</p>
                    <p className="mt-5 text-2xl font-bold tabular-nums text-gray-950">
                      THB {pkg.pricePerPerson.toLocaleString('en-US')}
                      <span className="text-sm font-medium text-gray-600">／成人</span>
                    </p>
                    <span className="mt-auto pt-4 text-sm font-semibold text-amber-800 group-hover:text-amber-900">
                      查看套餐內容 →
                    </span>
                  </Link>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-3 text-center">
                * 有小朋友時請提供年齡，我們會依總佔位、房間與需求直接提供全家總價。
              </p>
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
