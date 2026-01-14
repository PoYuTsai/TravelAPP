import type { Metadata } from 'next'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'
import { FeatureGrid, FAQSection, YouTubeEmbed, RoomCards, ImageGallery, LocationInfo } from '@/components/cms'

// Disable caching for this page
export const revalidate = 0

export const metadata: Metadata = {
  title: '芳縣特色民宿 | Huen San Fang Hotel | 清微旅行',
  description: '遠離觀光區的寧靜民宿，體驗泰北在地生活。適合長住深度旅遊，民宿主人親自接待。',
}

// Default data
const defaultData = {
  heroName: 'Huen San Fang Hotel',
  heroTitle: '芳縣特色民宿',
  heroSubtitle: '遠離觀光客的喧囂，在清邁芳縣體驗真正的泰北生活。\n我們自己住這裡，也邀請你來住。',
  heroCtaText: 'LINE 詢問房況',
  heroCtaLink: 'https://line.me/R/ti/p/@037nyuwk',
  features: [
    { icon: '🌿', title: '遠離觀光區', description: '位於芳縣，享受真正的泰北寧靜' },
    { icon: '🏡', title: '在地生活體驗', description: '不只是住宿，更是體驗當地人的日常' },
    { icon: '👨‍👩‍👧', title: '民宿主人接待', description: '我們親自接待，有問題隨時找得到人' },
    { icon: '🚐', title: '包車搭配', description: '搭配包車服務，交通接送都安排好' },
  ],
  locationDescription: '芳縣位於清邁北方約 150 公里，車程約 2.5 小時。這裡遠離觀光區，是真正的泰北農村生活。適合想要深度體驗、長住的旅客。\n\n我們可以安排從清邁市區的接送，搭配包車行程，交通完全不用擔心。',
  locationFromChiangMai: '車程約 2.5 小時',
}

const homestayQuery = `*[_type == "homestay"][0]{
  heroName,
  heroTitle,
  heroSubtitle,
  heroCtaText,
  heroCtaLink,
  heroMainImage,
  videoShow,
  videoYoutubeId,
  videoTitle,
  features,
  roomCards,
  gallery,
  locationDescription,
  locationFromChiangMai,
  locationGoogleMapUrl,
  faq
}`

async function getHomestayData() {
  try {
    return await client.fetch(homestayQuery)
  } catch {
    return null
  }
}

export default async function HomestayPage() {
  const data = await getHomestayData()

  const heroName = data?.heroName || defaultData.heroName
  const heroTitle = data?.heroTitle || defaultData.heroTitle
  const heroSubtitle = data?.heroSubtitle || defaultData.heroSubtitle
  const heroCtaText = data?.heroCtaText || defaultData.heroCtaText
  const heroCtaLink = data?.heroCtaLink || defaultData.heroCtaLink
  const features = data?.features?.length > 0 ? data.features : defaultData.features

  return (
    <div className="py-12 md:py-20">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="text-center mb-8">
          <p className="text-primary font-medium mb-2">{heroName}</p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {heroTitle}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto whitespace-pre-line">
            {heroSubtitle}
          </p>
        </div>

        {/* Hero Image or Placeholder */}
        {data?.heroMainImage?.asset ? (
          <div className="relative aspect-[16/9] max-w-4xl mx-auto rounded-xl overflow-hidden shadow-lg mb-8">
            <Image
              src={urlFor(data.heroMainImage.asset).width(1200).height(675).url()}
              alt={data.heroMainImage.alt || heroTitle}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-square bg-gradient-to-br from-primary-light to-primary/20 rounded-xl flex items-center justify-center"
              >
                <span className="text-4xl">🏠</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center">
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
          <SectionTitle title="民宿特色" />
          <FeatureGrid features={features} columns={4} />
        </div>
      </section>

      {/* Room Cards */}
      {data?.roomCards?.length > 0 && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle title="房型價格" />
            <RoomCards cards={data.roomCards} />
          </div>
        </section>
      )}

      {/* Gallery */}
      {data?.gallery?.length > 0 && (
        <section className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle title="環境照片" />
            <ImageGallery images={data.gallery} columns={3} />
          </div>
        </section>
      )}

      {/* Location */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle title="位置" subtitle="芳縣 Fang District" />
          <LocationInfo
            description={data?.locationDescription || defaultData.locationDescription}
            fromChiangMai={data?.locationFromChiangMai || defaultData.locationFromChiangMai}
            googleMapUrl={data?.locationGoogleMapUrl}
          />
        </div>
      </section>

      {/* FAQ */}
      {data?.faq?.length > 0 && (
        <section className="bg-gray-50 py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle title="常見問題" />
            <FAQSection items={data.faq} />
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-primary py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            想來住住看嗎？
          </h2>
          <p className="text-gray-800 mb-6">
            告訴我們你的旅行日期，我們幫你安排
          </p>
          <Button href={heroCtaLink} external={heroCtaLink.startsWith('http')} variant="secondary" size="lg">
            {heroCtaText}
          </Button>
        </div>
      </section>
    </div>
  )
}
