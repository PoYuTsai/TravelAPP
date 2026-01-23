import { client } from '@/sanity/client'
import { fetchTotalFamilyCount } from '@/lib/notion'

// ISR: Revalidate every 60 seconds
export const revalidate = 60

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
        title={data?.heroTitle || '清邁親子自由行，交給在地家庭'}
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
