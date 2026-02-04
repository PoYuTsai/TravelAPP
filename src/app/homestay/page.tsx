import type { Metadata } from 'next'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'
import HomestayPageSchema from '@/components/schema/HomestayPageSchema'
import { FeatureGrid, FAQSection, VideoPlayer, RoomCards, ImageGallery, LocationInfo } from '@/components/cms'

// ISR: Revalidate every 60 seconds
export const revalidate = 60

export const metadata: Metadata = {
  title: '清邁芳縣民宿｜遠離觀光區的在地生活體驗｜清微旅行',
  description: '清邁芳縣特色民宿 Huen San Fang Hotel，遠離觀光區的寧靜住宿。體驗真正的泰北農村生活，適合長住深度旅遊。清微旅行民宿主人親自接待，可搭配包車服務，交通完全不用擔心。',
  alternates: {
    canonical: 'https://chiangway-travel.com/homestay',
  },
  openGraph: {
    title: '清邁芳縣民宿｜遠離觀光區的在地生活體驗｜清微旅行',
    description: '清邁芳縣特色民宿，遠離觀光區的寧靜住宿。體驗真正的泰北農村生活，民宿主人親自接待。',
    url: 'https://chiangway-travel.com/homestay',
    images: [{ url: '/images/og-image.png', width: 1200, height: 630, alt: '清邁芳縣民宿 - 清微旅行' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '清邁芳縣民宿｜在地生活體驗｜清微旅行',
    description: '清邁芳縣特色民宿，遠離觀光區的寧靜住宿。體驗泰北農村生活，民宿主人親自接待。',
    images: ['/images/og-image.png'],
  },
}

// Default data
const defaultData = {
  heroName: 'Huen San Fang Hotel',
  heroTitle: '芳縣特色民宿',
  heroSubtitle: '遠離觀光客的喧囂，在清邁芳縣體驗真正的泰北生活。\n我們自己住這裡，也邀請你來住。',
  heroCtaText: 'LINE 詢問房況',
  heroCtaLink: 'https://line.me/R/ti/p/@037nyuwk',
  // Video (vc_h264 for iOS compatibility)
  videoUrl: 'https://res.cloudinary.com/dlgzrtl75/video/upload/vc_h264/v1769170451/hotelvideo_0123_gui5rb.mp4',
  videoTitle: '芳縣民宿環境介紹',
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
  videoUrl,
  videoPoster,
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
  // Video - always use default if Sanity doesn't have one
  const videoUrl = data?.videoUrl || defaultData.videoUrl
  const videoTitle = data?.videoTitle || defaultData.videoTitle

  return (
    <>
      <HomestayPageSchema
        name={heroName}
        description={heroSubtitle}
        faqItems={data?.faq}
      />
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

      {/* Social Proof - 社會證明 */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle title="為什麼選擇我們" subtitle="12 年在地經營" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="text-center p-4">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">12</div>
              <div className="text-sm text-gray-600">年在地經營</div>
            </div>
            <div className="text-center p-4">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">1000+</div>
              <div className="text-sm text-gray-600">外國與泰國旅客</div>
            </div>
            <div className="text-center p-4">
              <a
                href="https://share.google/na5VNjxNGGNlHbRdL"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:opacity-80 transition-opacity"
              >
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">134</div>
                <div className="text-sm text-gray-600">Google 評論</div>
                <div className="flex justify-center mt-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </a>
            </div>
            <div className="text-center p-4">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">2</div>
              <div className="text-sm text-gray-600">特色季節團</div>
            </div>
          </div>

          {/* Special Tours */}
          <div className="bg-gray-50 rounded-xl p-6 md:p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">季節限定活動</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌸</span>
                  <div>
                    <div className="font-medium text-gray-900">賞櫻團</div>
                    <div className="text-sm text-gray-600">每年 1-2 月，芳縣櫻花盛開</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🦅</span>
                  <div>
                    <div className="font-medium text-gray-900">賞鳥團</div>
                    <div className="text-sm text-gray-600">泰北豐富鳥類生態觀察</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

      {/* CTA - 差異化：強調在地經營 */}
      <section className="bg-primary py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            不只是住宿，是在地家庭的款待
          </h2>
          <p className="text-gray-800 mb-2">
            12 年來接待過上千組旅客，我們知道什麼是真正的泰北體驗
          </p>
          <p className="text-sm text-gray-700 mb-6">
            告訴我們你的旅行日期，我們幫你安排從清邁到芳縣的一切
          </p>
          <Button href={heroCtaLink} external={heroCtaLink.startsWith('http')} variant="secondary" size="lg">
            LINE 詢問房況與接送
          </Button>
        </div>
      </section>
      </div>
    </>
  )
}
