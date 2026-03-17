import type { Metadata } from 'next'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'
import HomestayPageSchema from '@/components/schema/HomestayPageSchema'
import { FeatureGrid, FAQSection, VideoPlayer, RoomCards, ImageGallery, LocationInfo } from '@/components/cms'
import { defaultSiteSettings } from '@/lib/site-settings'

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

interface SocialProofStat {
  value?: string
  label?: string
  link?: string
  showStars?: boolean
}

interface SeasonalActivity {
  icon?: string
  title?: string
  description?: string
}

const defaultData = {
  heroName: 'Huen San Fang Hotel',
  heroTitle: '芳縣特色民宿',
  heroSubtitle: '遠離觀光客的喧囂，在清邁芳縣體驗真正的泰北生活。\n我們自己住這裡，也邀請你來住。',
  heroCtaText: 'LINE 詢問房況',
  heroCtaLink: defaultSiteSettings.socialLinks.line,
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
  socialProofTitle: '為什麼選擇我們',
  socialProofSubtitle: '12 年在地經營',
  socialProofStats: [
    { value: '12', label: '年在地經營' },
    { value: '1000+', label: '外國與泰國旅客' },
    { value: '134', label: 'Google 評論', link: 'https://share.google/na5VNjxNGGNlHbRdL', showStars: true },
    { value: '2', label: '特色季節團' },
  ],
  seasonalActivitiesTitle: '季節限定活動',
  seasonalActivities: [
    { icon: '🌸', title: '賞櫻團', description: '每年 1-2 月，芳縣櫻花盛開' },
    { icon: '🦅', title: '賞鳥團', description: '泰北豐富鳥類生態觀察' },
  ],
  bottomCtaTitle: '不只是住宿，是在地家庭的款待',
  bottomCtaDescription: '12 年來接待過上千組旅客，我們知道什麼是真正的泰北體驗',
  bottomCtaHelperText: '告訴我們你的旅行日期，我們幫你安排從清邁到芳縣的一切',
  bottomCtaText: 'LINE 詢問房況與接送',
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
  socialProofTitle,
  socialProofSubtitle,
  socialProofStats,
  seasonalActivitiesTitle,
  seasonalActivities,
  faq,
  bottomCtaTitle,
  bottomCtaDescription,
  bottomCtaHelperText,
  bottomCtaText
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
  const videoUrl = data?.videoUrl || defaultData.videoUrl
  const videoTitle = data?.videoTitle || defaultData.videoTitle
  const socialProofStats =
    data?.socialProofStats?.length > 0 ? data.socialProofStats : defaultData.socialProofStats
  const seasonalActivities =
    data?.seasonalActivities?.length > 0 ? data.seasonalActivities : defaultData.seasonalActivities
  const bottomCtaTitle = data?.bottomCtaTitle || defaultData.bottomCtaTitle
  const bottomCtaDescription = data?.bottomCtaDescription || defaultData.bottomCtaDescription
  const bottomCtaHelperText = data?.bottomCtaHelperText || defaultData.bottomCtaHelperText
  const bottomCtaText = data?.bottomCtaText || defaultData.bottomCtaText

  return (
    <>
      <HomestayPageSchema
        name={heroName}
        description={heroSubtitle}
        faqItems={data?.faq}
      />

      <div className="py-12 md:py-20">
        <section className="mb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <p className="mb-2 font-medium text-primary">{heroName}</p>
            <h1 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
              {heroTitle}
            </h1>
            <p className="mx-auto max-w-2xl whitespace-pre-line text-lg text-gray-600">
              {heroSubtitle}
            </p>
          </div>

          {data?.heroMainImage?.asset ? (
            <div className="relative mx-auto mb-8 aspect-[16/9] max-w-4xl overflow-hidden rounded-xl shadow-lg">
              <Image
                src={urlFor(data.heroMainImage.asset).width(1200).height(675).url()}
                alt={data.heroMainImage.alt || heroTitle}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-primary-light to-primary/20"
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

        <section className="mb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <VideoPlayer
            videoUrl={videoUrl}
            poster={data?.videoPoster}
            title={videoTitle}
            aspect="responsive"
          />
        </section>

        <section className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle title="民宿特色" />
            <FeatureGrid features={features} columns={4} />
          </div>
        </section>

        {data?.roomCards?.length > 0 && (
          <section className="py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <SectionTitle title="房型價格" />
              <RoomCards cards={data.roomCards} />
            </div>
          </section>
        )}

        {data?.gallery?.length > 0 && (
          <section className="bg-gray-50 py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <SectionTitle title="環境照片" />
              <ImageGallery images={data.gallery} columns={3} />
            </div>
          </section>
        )}

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

        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle
              title={data?.socialProofTitle || defaultData.socialProofTitle}
              subtitle={data?.socialProofSubtitle || defaultData.socialProofSubtitle}
            />

            <div className="mb-8 grid grid-cols-2 gap-6 md:grid-cols-4">
              {socialProofStats.map((stat: SocialProofStat, index: number) => {
                const content = (
                  <>
                    <div className="mb-2 text-3xl font-bold text-primary md:text-4xl">{stat.value}</div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                    {stat.showStars && (
                      <div className="mt-1 flex justify-center">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    )}
                  </>
                )

                return (
                  <div key={`${stat.label}-${index}`} className="p-4 text-center">
                    {stat.link ? (
                      <a
                        href={stat.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block transition-opacity hover:opacity-80"
                      >
                        {content}
                      </a>
                    ) : (
                      content
                    )}
                  </div>
                )
              })}
            </div>

            <div className="rounded-xl bg-gray-50 p-6 md:p-8">
              <h3 className="mb-4 text-center text-lg font-semibold text-gray-900">
                {data?.seasonalActivitiesTitle || defaultData.seasonalActivitiesTitle}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {seasonalActivities.map((activity: SeasonalActivity, index: number) => (
                  <div key={`${activity.title}-${index}`} className="rounded-lg border border-gray-100 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{activity.icon || '✨'}</span>
                      <div>
                        <div className="font-medium text-gray-900">{activity.title}</div>
                        <div className="text-sm text-gray-600">{activity.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {data?.faq?.length > 0 && (
          <section className="bg-gray-50 py-16">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <SectionTitle title="常見問題" />
              <FAQSection items={data.faq} />
            </div>
          </section>
        )}

        <section className="bg-primary py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="mb-4 text-2xl font-bold text-gray-900 md:text-3xl">
              {bottomCtaTitle}
            </h2>
            <p className="mb-2 text-gray-800">
              {bottomCtaDescription}
            </p>
            <p className="mb-6 text-sm text-gray-700">
              {bottomCtaHelperText}
            </p>
            <Button href={heroCtaLink} external={heroCtaLink.startsWith('http')} variant="secondary" size="lg">
              {bottomCtaText}
            </Button>
          </div>
        </section>
      </div>
    </>
  )
}
