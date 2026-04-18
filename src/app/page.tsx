import type { Metadata } from 'next'
import { client } from '@/sanity/client'
import { HOMEPAGE_ENTITY_SENTENCE, ensureEntitySentence } from '@/lib/brand-entity'
import { fetchTotalFamilyCount } from '@/lib/notion'

// ISR: Revalidate every 60 seconds
export const revalidate = 60

export const metadata: Metadata = {
  title: '爸媽開的清邁親子包車｜深受台灣家庭信賴｜清微旅行',
  description: '清微旅行 — 台灣爸爸 Eric × 泰國媽媽 Min 經營的清邁親子包車。司機導遊專業分工、兒童座椅、中文溝通，深受台灣家庭信賴。',
  openGraph: {
    title: '爸媽開的清邁親子包車｜深受台灣家庭信賴｜清微旅行',
    description: '台灣爸爸 Eric × 泰國媽媽 Min 經營的清邁親子包車。司機導遊專業分工、兒童座椅、中文溝通，深受台灣家庭信賴。',
    url: 'https://chiangway-travel.com/',
    siteName: '清微旅行 Chiangway Travel',
    locale: 'zh_TW',
    type: 'website',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: '爸媽開的清邁親子包車 — 清微旅行',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '爸媽開的清邁親子包車｜清微旅行',
    description: '台灣爸爸 Eric × 泰國媽媽 Min 經營的清邁親子包車。司機導遊專業分工、兒童座椅、中文溝通，深受台灣家庭信賴。',
    images: ['/images/og-image.png'],
  },
  alternates: {
    canonical: 'https://chiangway-travel.com/',
  },
}

const homepageMetadataDescription = ensureEntitySentence(
  typeof metadata.description === 'string' ? metadata.description : '',
  HOMEPAGE_ENTITY_SENTENCE,
  ['清微旅行', '清邁親子包車']
)

metadata.description = homepageMetadataDescription

if (metadata.openGraph) {
  metadata.openGraph.description = homepageMetadataDescription
}

if (metadata.twitter) {
  metadata.twitter.description = homepageMetadataDescription
}

import Hero from '@/components/sections/Hero'
import TrustNumbers from '@/components/sections/TrustNumbers'
import WhoWeAre from '@/components/sections/WhoWeAre'
import ToursPreview from '@/components/sections/ToursPreview'
import Testimonials from '@/components/sections/Testimonials'
import FeaturedArticles from '@/components/sections/FeaturedArticles'
import CTA from '@/components/sections/CTA'
import HomePageFaqSchema from '@/components/schema/HomePageFaqSchema'

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
  const heroDescription = ensureEntitySentence(
    data?.heroDescription,
    HOMEPAGE_ENTITY_SENTENCE,
    ['清微旅行', '清邁親子包車']
  )

  return (
    <>
      <HomePageFaqSchema />
      <Hero
        backgroundImage={data?.heroBackgroundImage}
        title={data?.heroTitle || '爸媽開的清邁親子包車'}
        subtitle={data?.heroSubtitle || '台灣爸爸 Eric × 泰國媽媽 Min，深受台灣家庭信賴'}
        description={heroDescription}
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
        title={data?.ctaTitle || '讓爸媽幫你規劃親子行程'}
        description={data?.ctaDescription || '聊聊你的想法，我們幫你安排最適合小孩的清邁旅程'}
        primaryCta={data?.ctaPrimaryCta}
        secondaryCta={data?.ctaSecondaryCta}
      />
    </>
  )
}
