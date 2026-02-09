import type { Metadata } from 'next'
import { client } from '@/sanity/client'
import { fetchTotalFamilyCount } from '@/lib/notion'

// ISR: Revalidate every 60 seconds
export const revalidate = 60

export const metadata: Metadata = {
  title: '清邁親子包車2026｜台灣爸爸×泰國媽媽的在地服務｜清微旅行',
  description: '清邁親子包車首選！台灣爸爸 Eric + 泰國媽媽 Min，在地家庭提供司機導遊分工服務。兒童座椅、中文溝通、客製行程，100+ 組家庭好評推薦。清邁一日 NT$3,200 起。',
  openGraph: {
    title: '清邁親子包車2026｜台灣爸爸×泰國媽媽的在地服務｜清微旅行',
    description: '清邁親子包車首選！台灣爸爸 Eric + 泰國媽媽 Min，司機導遊分工、兒童座椅、中文溝通。100+ 組家庭好評推薦。',
    url: 'https://chiangway-travel.com/',
    siteName: '清微旅行 Chiangway Travel',
    locale: 'zh_TW',
    type: 'website',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: '清微旅行 - 清邁親子包車',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '清邁親子包車2026｜台灣爸爸×泰國媽媽｜清微旅行',
    description: '清邁親子包車首選！司機導遊分工、兒童座椅、中文溝通。100+ 組家庭好評推薦。',
    images: ['/images/og-image.png'],
  },
  alternates: {
    canonical: 'https://chiangway-travel.com/',
  },
}

import Hero from '@/components/sections/Hero'
import TrustNumbers from '@/components/sections/TrustNumbers'
import WhoWeAre from '@/components/sections/WhoWeAre'
import ToursPreview from '@/components/sections/ToursPreview'
import Testimonials from '@/components/sections/Testimonials'
import FeaturedArticles from '@/components/sections/FeaturedArticles'
import CTA from '@/components/sections/CTA'

const landingPageQuery = `*[_type == "landingPage"][0]{
  heroBackgroundImage,
  heroTitle,
  heroSubtitle,
  heroDescription,
  heroPrimaryCta,
  heroSecondaryCta,
  whoWeAreVideoUrl,
  whoWeAreVideoPoster,
  whoWeAreVideoAspect,
  whoWeAreTitle,
  whoWeAreSubtitle,
  whoWeAreDescription,
  whoWeAreTrustPoints,
  whoWeAreStoryLink,
  whoWeAreStoryLinkText,
  articlesSectionTitle,
  articlesSectionSubtitle,
  articlesShowCount,
  ctaTitle,
  ctaDescription,
  ctaPrimaryCta,
  ctaSecondaryCta
}`

async function getLandingPageData() {
  try {
    return await client.fetch(landingPageQuery)
  } catch {
    return null
  }
}

export default async function Home() {
  // Fetch data in parallel
  const [data, familyCount] = await Promise.all([
    getLandingPageData(),
    fetchTotalFamilyCount(),
  ])

  return (
    <>
      <Hero
        backgroundImage={data?.heroBackgroundImage}
        title={data?.heroTitle || '清邁親子包車，交給 Eric & Min'}
        subtitle={data?.heroSubtitle || '專為爸媽設計的包車旅程'}
        description={data?.heroDescription}
        primaryCta={data?.heroPrimaryCta}
        secondaryCta={data?.heroSecondaryCta}
      />
      <TrustNumbers familyCountValue={familyCount} />
      <WhoWeAre
        videoUrl={data?.whoWeAreVideoUrl}
        videoPoster={data?.whoWeAreVideoPoster}
        videoAspect={data?.whoWeAreVideoAspect}
        title={data?.whoWeAreTitle}
        subtitle={data?.whoWeAreSubtitle}
        description={data?.whoWeAreDescription}
        trustPoints={data?.whoWeAreTrustPoints?.map((text: string) => ({ text }))}
        storyLink={data?.whoWeAreStoryLink || '/blog/eric-story-taiwan-to-chiang-mai'}
        storyLinkText={data?.whoWeAreStoryLinkText || '閱讀我們的故事'}
      />
      <ToursPreview />
      <Testimonials />
      <FeaturedArticles
        sectionTitle={data?.articlesSectionTitle}
        sectionSubtitle={data?.articlesSectionSubtitle}
        showCount={data?.articlesShowCount}
      />
      <CTA
        title={data?.ctaTitle || '每個家庭都不一樣'}
        description={data?.ctaDescription || '聊聊你們的想法，我們幫你規劃'}
        primaryCta={data?.ctaPrimaryCta}
        secondaryCta={data?.ctaSecondaryCta}
      />
    </>
  )
}
