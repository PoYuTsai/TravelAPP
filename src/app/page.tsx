import type { Metadata } from 'next'
import { client } from '@/sanity/client'
import { SITEWIDE_METADATA_DESCRIPTION } from '@/lib/home-public-copy'
import { fetchTotalFamilyCount } from '@/lib/notion'

// ISR: Revalidate every 60 seconds
export const revalidate = 60

export const metadata: Metadata = {
  title: '爸媽開的清邁親子包車｜深受台灣家庭信賴｜清微旅行',
  description: SITEWIDE_METADATA_DESCRIPTION,
  openGraph: {
    title: '爸媽開的清邁親子包車｜深受台灣家庭信賴｜清微旅行',
    description: SITEWIDE_METADATA_DESCRIPTION,
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
    description: SITEWIDE_METADATA_DESCRIPTION,
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
import HomePageFaqSchema from '@/components/schema/HomePageFaqSchema'

const landingPageQuery = `*[_type == "landingPage"][0]{
  heroBackgroundImage,
  whoWeAreVideoUrl,
  whoWeAreVideoPoster,
  whoWeAreVideoAspect,
  whoWeAreStoryLink,
  whoWeAreStoryLinkText,
  articlesSectionTitle,
  articlesSectionSubtitle,
  articlesShowCount
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
      <HomePageFaqSchema />
      <Hero
        backgroundImage={data?.heroBackgroundImage}
      />
      <TrustNumbers familyCountValue={familyCount} />
      <WhoWeAre
        videoUrl={data?.whoWeAreVideoUrl}
        videoPoster={data?.whoWeAreVideoPoster}
        videoAspect={data?.whoWeAreVideoAspect}
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
      <CTA />
    </>
  )
}
