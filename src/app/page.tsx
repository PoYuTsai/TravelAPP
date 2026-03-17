import type { Metadata } from 'next'
import { client } from '@/sanity/client'
import { fetchTotalFamilyCount } from '@/lib/notion'
import { mergeSiteSettings, siteSettingsQuery } from '@/lib/site-settings'
import Hero from '@/components/sections/Hero'
import TrustNumbers from '@/components/sections/TrustNumbers'
import WhoWeAre from '@/components/sections/WhoWeAre'
import ToursPreview from '@/components/sections/ToursPreview'
import Testimonials from '@/components/sections/Testimonials'
import FeaturedArticles from '@/components/sections/FeaturedArticles'
import CTA from '@/components/sections/CTA'

export const revalidate = 60

export const metadata: Metadata = {
  title: '清邁親子包車與客製旅遊｜住在清邁的 Eric + Min 協助安排 | 清微旅行',
  description:
    '清微旅行由住在清邁的台灣爸爸 Eric 與泰國媽媽 Min 協助安排，專注親子包車、客製行程與中文導遊分工服務。',
  openGraph: {
    title: '清邁親子包車與客製旅遊｜住在清邁的 Eric + Min 協助安排 | 清微旅行',
    description:
      '從清邁親子包車、自由行規劃到客製路線安排，幫家庭旅客把節奏、交通和在地體驗先整理順。',
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
    title: '清邁親子包車與客製旅遊｜清微旅行',
    description: '由住在清邁的在地家庭協助安排，讓親子清邁自由行不只是移動，而是更順的旅程。',
    images: ['/images/og-image.png'],
  },
  alternates: {
    canonical: 'https://chiangway-travel.com/',
  },
}

const landingPageQuery = `*[_type == "landingPage"][0]{
  heroBackgroundImage,
  heroTitle,
  heroSubtitle,
  heroEyebrow,
  heroDescription,
  heroProofItems,
  heroHelperText,
  heroPanelEyebrow,
  heroPanelTitle,
  heroPanelDescription,
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
  ctaEyebrow,
  ctaTitle,
  ctaDescription,
  ctaHelperText,
  ctaPlanningTitle,
  ctaPlanningSteps,
  ctaResponseTitle,
  ctaResponseDescription,
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

async function getSiteSettings() {
  try {
    const settings = await client.fetch(siteSettingsQuery)
    return mergeSiteSettings(settings)
  } catch {
    return mergeSiteSettings(null)
  }
}

export default async function Home() {
  const [data, familyCount, siteSettings] = await Promise.all([
    getLandingPageData(),
    fetchTotalFamilyCount(),
    getSiteSettings(),
  ])

  return (
    <>
      <Hero
        backgroundImage={data?.heroBackgroundImage}
        eyebrow={data?.heroEyebrow}
        title={data?.heroTitle}
        subtitle={data?.heroSubtitle}
        description={data?.heroDescription}
        proofItems={data?.heroProofItems}
        helperText={data?.heroHelperText}
        panelEyebrow={data?.heroPanelEyebrow}
        panelTitle={data?.heroPanelTitle}
        panelDescription={data?.heroPanelDescription}
        primaryCta={data?.heroPrimaryCta}
        secondaryCta={data?.heroSecondaryCta}
        familyCountValue={familyCount}
        reviewCount={siteSettings.aggregateRating.reviewCount}
        ratingValue={siteSettings.aggregateRating.ratingValue}
      />
      <TrustNumbers
        familyCountValue={familyCount}
        reviewCount={siteSettings.aggregateRating.reviewCount}
        ratingValue={siteSettings.aggregateRating.ratingValue}
        sectionEyebrow={siteSettings.trustSection.eyebrow}
        sectionTitle={siteSettings.trustSection.title}
        sectionDescription={siteSettings.trustSection.description}
        cards={siteSettings.trustSection.cards}
      />
      <WhoWeAre
        videoUrl={data?.whoWeAreVideoUrl}
        videoPoster={data?.whoWeAreVideoPoster}
        videoAspect={data?.whoWeAreVideoAspect}
        title={data?.whoWeAreTitle}
        subtitle={data?.whoWeAreSubtitle}
        description={data?.whoWeAreDescription}
        trustPoints={data?.whoWeAreTrustPoints?.map((text: string) => ({ text }))}
        storyLink={data?.whoWeAreStoryLink || '/blog/eric-story-taiwan-to-chiang-mai'}
        storyLinkText={data?.whoWeAreStoryLinkText || '看我們為什麼住在清邁'}
      />
      <ToursPreview />
      <Testimonials testimonials={siteSettings.homeTestimonials} />
      <FeaturedArticles
        sectionTitle={data?.articlesSectionTitle}
        sectionSubtitle={data?.articlesSectionSubtitle}
        showCount={data?.articlesShowCount}
      />
      <CTA
        eyebrow={data?.ctaEyebrow}
        title={data?.ctaTitle}
        description={data?.ctaDescription}
        helperText={data?.ctaHelperText}
        planningTitle={data?.ctaPlanningTitle}
        planningSteps={data?.ctaPlanningSteps}
        responseTitle={data?.ctaResponseTitle}
        responseDescription={data?.ctaResponseDescription}
        primaryCta={data?.ctaPrimaryCta}
        secondaryCta={data?.ctaSecondaryCta}
      />
    </>
  )
}
