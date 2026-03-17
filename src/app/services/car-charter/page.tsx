import type { Metadata } from 'next'
import type { SanityImageSource } from '@sanity/image-url'
import { client } from '@/sanity/client'
import Button from '@/components/ui/Button'
import LineCTAButton from '@/components/ui/LineCTAButton'
import SectionTitle from '@/components/ui/SectionTitle'
import {
  FeatureGrid,
  PricingTable,
  FAQSection,
  VideoPlayer,
  ImageGallery,
  ProcessSteps,
} from '@/components/cms'
import { defaultSiteSettings, mergeSiteSettings, siteSettingsQuery } from '@/lib/site-settings'

export const revalidate = 60

export const metadata: Metadata = {
  title: '清邁親子包車服務｜中文導遊分工、親子友善路線安排 | 清微旅行',
  description:
    '清邁親子包車由在地家庭協助安排，司機與中文導遊分工，節奏更穩、溝通更順。適合親子自由行、長輩同行與客製行程需求。',
  alternates: {
    canonical: 'https://chiangway-travel.com/services/car-charter',
  },
  openGraph: {
    title: '清邁親子包車服務｜中文導遊分工、親子友善路線安排 | 清微旅行',
    description:
      '從接送、配車到親子節奏安排一次整合，讓清邁包車不只是交通，而是真正好走、好玩、好配合家庭需求的行程。',
    url: 'https://chiangway-travel.com/services/car-charter',
    images: [{ url: '/images/og-image.png', width: 1200, height: 630, alt: '清邁親子包車服務 - 清微旅行' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '清邁親子包車服務｜中文導遊分工、親子友善路線安排 | 清微旅行',
    description:
      '從接送、配車到親子節奏安排一次整合，讓清邁包車不只是交通，而是真正好走、好玩、好配合家庭需求的行程。',
    images: ['/images/og-image.png'],
  },
}

interface FeatureItem {
  icon?: string
  title: string
  description: string
}

interface HeroHighlightItem {
  icon?: string
  title: string
  description: string
}

interface IntroCardItem {
  title: string
  description: string
}

interface FaqItem {
  question: string
  answer: string
}

interface RouteItem {
  destination: string
  price: string
}

interface VehicleTypeItem {
  name: string
  subtitle?: string
  icon?: string
  maxPassengers?: number
  routes: RouteItem[]
  airportTransfer?: {
    label: string
    price: string
  }
}

interface ProcessItem {
  step: number
  title: string
  description: string
}

interface GalleryImageItem {
  asset: SanityImageSource
  alt?: string
  caption?: string
}

interface SupportFactItem {
  label: string
  value: string
}

interface CarCharterData {
  heroTitle?: string
  heroSubtitle?: string
  heroCtaText?: string
  heroCtaLink?: string
  heroHighlights?: HeroHighlightItem[]
  introCards?: IntroCardItem[]
  videoUrl?: string
  videoPoster?: unknown
  videoTitle?: string
  planningChecklist?: string[]
  features?: FeatureItem[]
  pricingSectionTitle?: string
  pricingVehicleTypes?: VehicleTypeItem[]
  pricingFootnotes?: string[]
  process?: ProcessItem[]
  gallery?: GalleryImageItem[]
  faq?: FaqItem[]
  supportPanelTitle?: string
  supportPanelDescription?: string
  supportPanelFacts?: SupportFactItem[]
  bottomCtaTitle?: string
  bottomCtaDescription?: string
}

const defaultData = {
  heroTitle: '清邁親子包車服務',
  heroSubtitle:
    '由台灣爸爸 Eric 與泰國媽媽 Min 協助安排，從接送、配車到行程節奏都先替家庭想好。司機與中文導遊分工，不必一路趕景點，也不需要邊玩邊猜下一站怎麼走。',
  heroCtaText: 'LINE 詢問包車與報價',
  heroCtaLink: defaultSiteSettings.socialLinks.line,
  heroHighlights: [
    {
      icon: '🚐',
      title: '司機與中文導遊分工',
      description: '不是一人兼數職的臨時帶路，而是讓接送、說明與照顧節奏更穩定。',
    },
    {
      icon: '👨‍👩‍👧‍👦',
      title: '用家庭旅行的角度安排',
      description: '會先看孩子年齡、午睡、行李與移動距離，再決定怎麼排比較順。',
    },
    {
      icon: '🗺️',
      title: '可從熱門路線延伸到客製行程',
      description: '不管是經典初訪、親子放鬆，或你想加的點，都能一起收斂。',
    },
  ],
  introCards: [
    {
      title: '適合誰',
      description: '親子家庭、長輩同行、第一次到清邁，或想把移動節奏安排得更舒服的旅客。',
    },
    {
      title: '我們先確認',
      description: '日期、人數、住宿位置、行李與孩子需求，避免出發當天才發現車型或動線不合。',
    },
    {
      title: '溝通方式',
      description: '直接用 LINE 對話，不用填一大串表單。你先丟需求，我們再一起把行程修順。',
    },
  ],
  videoUrl:
    'https://res.cloudinary.com/dlgzrtl75/video/upload/vc_h264/v1769163410/790057116.088289_vz6u16.mp4',
  videoTitle: '清邁親子包車服務介紹',
  planningChecklist: ['住宿位置與接送動線', '孩子年齡、午睡與餐食需求', '行李件數、推車、兒童座椅', '適合慢玩還是想多跑幾個點'],
  features: [
    {
      icon: '🚐',
      title: '司機與中文導遊分工',
      description: '不是一人兼數職的臨時帶路，而是讓接送、說明與照顧旅伴節奏都更穩定。',
    },
    {
      icon: '👨‍👩‍👧‍👦',
      title: '真正站在親子家庭角度安排',
      description: '會先看孩子年齡、午睡需求、行李件數與移動距離，再決定路線和停留節奏。',
    },
    {
      icon: '🗺️',
      title: '可以從熱門路線延伸到客製行程',
      description: '不管是經典初訪、郊區一日遊、親子放鬆行程，或你想加進去的點，都能一起調整。',
    },
    {
      icon: '📍',
      title: '以住宿位置與當天動線規劃',
      description: '不是只看景點清單，而是把接送、回程、吃飯與孩子體力一起算進去。',
    },
    {
      icon: '💬',
      title: '出發前先把細節對齊',
      description: '上車人數、兒童座椅、班機時間、清單需求都先確認，減少現場手忙腳亂。',
    },
    {
      icon: '🧡',
      title: '不是制式接送，而是有人陪你把事情想前面',
      description: '我們希望你到清邁後能把注意力放在陪家人，而不是一直處理交通與資訊落差。',
    },
  ],
  faq: [
    {
      question: '清邁包車可以客製行程嗎？',
      answer: '可以。我們通常會先了解你的住宿地點、旅伴組成、想去的景點與旅行節奏，再幫你調整成適合家庭移動的版本。',
    },
    {
      question: '只有司機，還是會有中文導遊？',
      answer: '清微旅行的核心差異就是司機與中文導遊分工。不是所有路線都一定需要導遊，但若你的行程適合搭配，我們會在安排時一起說明。',
    },
    {
      question: '包車價格怎麼看？',
      answer: '不同車型、路線、出發時間與是否跨區都會影響費用。頁面上的價格可作為初步參考，實際還是以你的日期、人數與路線需求為準。',
    },
    {
      question: '親子家庭或長輩同行適合嗎？',
      answer: '很適合。這也是我們最常服務的旅客類型。我們會特別留意上車下車的節奏、停留時間、路線順序與長距離移動的舒適度。',
    },
  ],
  supportPanelTitle: '你可以先丟需求，我們幫你一起把安排順一點',
  supportPanelDescription:
    '如果你已經有日期、飯店或想去的地方，直接傳來最快。我們會先幫你看車型、動線與大概預算。',
  supportPanelFacts: [
    { label: '適合先提供', value: '日期 / 人數 / 飯店 / 想去的點' },
    { label: '常見需求', value: '兒童座椅 / 行李件數 / 接機 / 慢玩節奏' },
  ],
  bottomCtaTitle: '如果你想先把包車方向抓對，現在就可以開始',
  bottomCtaDescription:
    '先丟一個大方向就好。我們會依你的家庭組合與旅程節奏，給你比較適合的車型與安排建議。',
}

const carCharterQuery = `*[_type == "carCharter"][0]{
  heroTitle,
  heroSubtitle,
  heroCtaText,
  heroCtaLink,
  heroHighlights,
  introCards,
  videoUrl,
  videoPoster,
  videoTitle,
  planningChecklist,
  features,
  pricingSectionTitle,
  pricingVehicleTypes,
  pricingFootnotes,
  process,
  gallery,
  faq,
  supportPanelTitle,
  supportPanelDescription,
  supportPanelFacts,
  bottomCtaTitle,
  bottomCtaDescription
}`

async function getCarCharterData() {
  try {
    return await client.fetch<CarCharterData | null>(carCharterQuery)
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

function generateFaqSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export default async function CarCharterPage() {
  const [data, rawSiteSettings] = await Promise.all([getCarCharterData(), getSiteSettings()])
  const siteSettings = mergeSiteSettings(rawSiteSettings)

  const heroTitle = data?.heroTitle || defaultData.heroTitle
  const heroSubtitle = data?.heroSubtitle || defaultData.heroSubtitle
  const heroCtaText = data?.heroCtaText || defaultData.heroCtaText
  const heroCtaLink = data?.heroCtaLink || defaultData.heroCtaLink
  const features = data?.features?.length ? data.features : defaultData.features
  const heroHighlights = data?.heroHighlights?.length ? data.heroHighlights : defaultData.heroHighlights
  const introCards = data?.introCards?.length ? data.introCards : defaultData.introCards
  const faq = data?.faq?.length ? data.faq : defaultData.faq
  const videoUrl = data?.videoUrl || defaultData.videoUrl
  const videoTitle = data?.videoTitle || defaultData.videoTitle
  const pricingVehicles = data?.pricingVehicleTypes || []
  const gallery = data?.gallery || []
  const process = data?.process || []
  const planningChecklist = data?.planningChecklist?.length
    ? data.planningChecklist
    : defaultData.planningChecklist
  const pricingPreview = pricingVehicles.slice(0, 2)
  const supportFacts = [
    { label: '聯絡方式', value: siteSettings.telephone },
    ...((data?.supportPanelFacts?.length ? data.supportPanelFacts : defaultData.supportPanelFacts).filter(
      (item) => item?.label && item?.value
    ) as SupportFactItem[]),
  ]
  const supportPanelTitle = data?.supportPanelTitle || defaultData.supportPanelTitle
  const supportPanelDescription = data?.supportPanelDescription || defaultData.supportPanelDescription
  const bottomCtaTitle = data?.bottomCtaTitle || defaultData.bottomCtaTitle
  const bottomCtaDescription = data?.bottomCtaDescription || defaultData.bottomCtaDescription

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: heroTitle,
    description: heroSubtitle,
    provider: {
      '@type': 'LocalBusiness',
      name: siteSettings.businessName,
      telephone: siteSettings.telephone,
      email: siteSettings.email,
      areaServed: siteSettings.areaServed,
    },
    areaServed: {
      '@type': 'City',
      name: siteSettings.areaServed,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: String(siteSettings.aggregateRating.ratingValue),
      reviewCount: String(siteSettings.aggregateRating.reviewCount),
      bestRating: '5',
      worstRating: '1',
    },
    sameAs: Object.values(siteSettings.socialLinks).filter(Boolean),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'THB',
      price: '3200',
      description: '清邁市區包車價格參考，實際依路線與人數調整',
    },
  }

  const faqSchema = generateFaqSchema(faq)
  const isLineLink = heroCtaLink.includes('line.me')

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <section className="relative overflow-hidden rounded-[36px] bg-stone-950 px-6 py-8 shadow-[0_34px_100px_-45px_rgba(0,0,0,0.55)] md:px-10 md:py-12 lg:px-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,192,9,0.28),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_24%)]" />
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-light/90">
                  Chiang Mai Family Charter
                </p>
                <h1 className="mt-4 text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
                  {heroTitle}
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78 md:text-xl">
                  {heroSubtitle}
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  {isLineLink ? (
                    <LineCTAButton
                      location="Car Charter Hero CTA"
                      className="shadow-[0_20px_45px_-18px_rgba(247,192,9,0.88)]"
                    >
                      {heroCtaText}
                    </LineCTAButton>
                  ) : (
                    <Button href={heroCtaLink} external={heroCtaLink.startsWith('http')} size="lg">
                      {heroCtaText}
                    </Button>
                  )}
                  <Button
                    href="#pricing"
                    variant="outline"
                    size="lg"
                    className="border-white/35 text-white hover:border-white hover:bg-white hover:text-stone-900"
                  >
                    先看價格參考
                  </Button>
                </div>

                <div className="mt-8 grid gap-3 md:grid-cols-3">
                  {heroHighlights.slice(0, 3).map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm"
                    >
                      <p className="text-sm font-semibold text-white">
                        {item.icon ? `${item.icon} ${item.title}` : item.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/65">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/15 bg-white/94 p-6 shadow-[0_26px_70px_-35px_rgba(0,0,0,0.45)]">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  服務摘要
                </p>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-amber-50 px-4 py-4">
                    <p className="text-sm font-medium text-stone-500">Google 評價</p>
                    <p className="mt-1 text-2xl font-bold text-stone-900">
                      {siteSettings.aggregateRating.ratingValue} / {siteSettings.aggregateRating.reviewCount}+
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-stone-100 px-4 py-4">
                      <p className="text-sm font-medium text-stone-500">服務模式</p>
                      <p className="mt-1 text-xl font-bold text-stone-900">司機 + 導遊</p>
                    </div>
                    <div className="rounded-2xl bg-stone-100 px-4 py-4">
                      <p className="text-sm font-medium text-stone-500">平均回覆</p>
                      <p className="mt-1 text-xl font-bold text-stone-900">2 小時內</p>
                    </div>
                  </div>
                </div>

                {pricingPreview.length > 0 && (
                  <div className="mt-5 space-y-3">
                    {pricingPreview.map((vehicle) => (
                      <div
                        key={vehicle.name}
                        className="rounded-2xl border border-stone-200 bg-white px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-stone-900">
                              {vehicle.icon ? `${vehicle.icon} ${vehicle.name}` : vehicle.name}
                            </p>
                            <p className="mt-1 text-sm text-stone-500">
                              {vehicle.subtitle ||
                                (vehicle.maxPassengers
                                  ? `最多 ${vehicle.maxPassengers} 位旅客`
                                  : '常見包車車型')}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-primary">
                            {vehicle.routes?.[0]?.price || vehicle.airportTransfer?.price || '私訊詢問'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-5 text-sm leading-6 text-stone-600">
                  包車不只是交通。我們會先看住宿位置、旅伴組成與想玩的節奏，再一起決定車型、動線與停留時間。
                </p>
              </div>
            </div>
          </section>

          <div className="-mt-6 mb-20 grid gap-4 px-2 md:-mt-8 md:grid-cols-3">
            {introCards.slice(0, 3).map((card) => (
              <div
                key={card.title}
                className="rounded-[24px] border border-stone-200 bg-white px-5 py-5 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.35)]"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-400">
                  {card.title}
                </p>
                <p className="mt-2 text-base leading-7 text-stone-700">{card.description}</p>
              </div>
            ))}
          </div>

          <section className="mb-20 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="overflow-hidden rounded-[32px] border border-stone-200 bg-white p-3 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.35)]">
              <VideoPlayer
                videoUrl={videoUrl}
                poster={data?.videoPoster}
                title={videoTitle}
                aspect="responsive"
              />
            </div>
            <div className="rounded-[32px] bg-amber-50 px-6 py-6 md:px-7">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                出發前我們會先確認
              </p>
              <h2 className="mt-3 text-2xl font-bold text-stone-900">
                把細節先想好，旅程就會輕鬆很多
              </h2>
              <p className="mt-4 text-base leading-7 text-stone-700">
                包車安排通常不是卡在景點，而是卡在節奏、距離與現場狀況。我們會先幫你把常見問題往前解掉。
              </p>
              <ul className="mt-5 space-y-3">
                {planningChecklist.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-stone-700">
                    <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-semibold text-primary shadow-sm">
                      ✓
                    </span>
                    <span className="leading-7">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mb-20 rounded-[32px] bg-gradient-to-br from-stone-50 via-white to-amber-50 px-6 py-8 md:px-8 md:py-10">
            <SectionTitle
              title="這種包車方式，適合希望旅程穩一點的家庭"
              subtitle="不是把景點塞滿，而是把家庭旅行裡真正會卡住的地方先處理好。"
            />
            <FeatureGrid features={features} columns={3} />
          </section>

          {pricingVehicles.length > 0 && (
            <section
              id="pricing"
              className="mb-20 rounded-[32px] bg-stone-950 px-6 py-8 md:px-8 md:py-10"
            >
              <div className="mb-12 text-center">
                <h2 className="text-3xl font-bold text-white md:text-4xl">
                  {data?.pricingSectionTitle || '包車價格參考'}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-white/72">
                  先用車型與常見路線抓大方向，實際還是會依住宿位置、景點安排與人數調整。
                </p>
              </div>
              <PricingTable
                vehicleTypes={pricingVehicles}
                footnotes={data?.pricingFootnotes}
                footnoteClassName="text-white/60"
              />
            </section>
          )}

          {process.length > 0 && (
            <section className="mb-20 rounded-[32px] bg-stone-50 px-6 py-8 md:px-8 md:py-10">
              <SectionTitle
                title="從詢問到出發，大致會這樣進行"
                subtitle="你不用一次把所有資訊整理好，只要先把日期和大方向丟給我們就行。"
              />
              <ProcessSteps steps={process} />
            </section>
          )}

          {gallery.length > 0 && (
            <section className="mb-20 rounded-[32px] bg-white px-6 py-8 md:px-8 md:py-10">
              <SectionTitle
                title="車輛與出發氛圍"
                subtitle="實際配車仍會依人數、行李與行程安排調整，這裡先讓你抓整體感受。"
              />
              <ImageGallery images={gallery} columns={3} />
            </section>
          )}

          <section
            id="faq"
            className="mb-20 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
          >
            <div className="rounded-[32px] bg-stone-50 px-6 py-8 md:px-8 md:py-10">
              <SectionTitle
                title="常見問題"
                subtitle="如果你現在還在比對包車方式、價格與適合程度，通常會先卡在這幾題。"
              />
              <FAQSection items={faq} schemaType="none" />
            </div>

            <aside className="rounded-[32px] bg-stone-950 px-6 py-6 text-white shadow-[0_28px_90px_-45px_rgba(0,0,0,0.45)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-light/90">
                需要直接討論
              </p>
              <h2 className="mt-3 text-2xl font-bold">{supportPanelTitle}</h2>
              <p className="mt-4 text-base leading-7 text-white/72">{supportPanelDescription}</p>
              <div className="mt-6 space-y-3">
                {supportFacts.map((item) => (
                  <div
                    key={`${item.label}-${item.value}`}
                    className="rounded-2xl border border-white/12 bg-white/8 px-4 py-4"
                  >
                    <p className="text-sm font-medium text-white/72">{item.label}</p>
                    <p className="mt-1 text-base font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <LineCTAButton
                  location="Car Charter FAQ CTA"
                  className="w-full shadow-[0_20px_45px_-18px_rgba(247,192,9,0.88)]"
                >
                  LINE 直接討論包車需求
                </LineCTAButton>
              </div>
            </aside>
          </section>

          <section className="relative overflow-hidden rounded-[32px] bg-stone-950 px-8 py-10 text-center md:px-12 md:py-14">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,192,9,0.24),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_24%)]" />
            <div className="relative">
              <h2 className="text-3xl font-bold text-white md:text-4xl">
                {bottomCtaTitle}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
                {bottomCtaDescription}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <LineCTAButton
                  location="Car Charter Bottom CTA"
                  className="shadow-[0_20px_45px_-18px_rgba(247,192,9,0.88)]"
                >
                  LINE 詢問包車與報價
                </LineCTAButton>
                <Button
                  href="#faq"
                  variant="outline"
                  className="border-white/35 text-white hover:border-white hover:bg-white hover:text-stone-900"
                >
                  先看常見問題
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
