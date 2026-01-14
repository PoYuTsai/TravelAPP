import { client } from '@/sanity/client'

// Disable caching for this page
export const revalidate = 0

import Hero from '@/components/sections/Hero'
import TrustNumbers from '@/components/sections/TrustNumbers'
import Services from '@/components/sections/Services'
import WhyUs from '@/components/sections/WhyUs'
import FeaturedArticles from '@/components/sections/FeaturedArticles'
import CTA from '@/components/sections/CTA'

const landingPageQuery = `*[_type == "landingPage"][0]{
  heroBackgroundImage,
  heroTitle,
  heroSubtitle,
  heroDescription,
  heroPrimaryCta,
  heroSecondaryCta,
  trustNumbers,
  servicesSectionTitle,
  servicesSectionSubtitle,
  servicesItems,
  whyUsSectionTitle,
  whyUsSectionSubtitle,
  whyUsReasons,
  articlesSectionTitle,
  articlesSectionSubtitle,
  articlesShowCount,
  articlesCtaText,
  articlesCtaLink,
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
  const data = await getLandingPageData()

  return (
    <>
      <Hero
        backgroundImage={data?.heroBackgroundImage}
        title={data?.heroTitle}
        subtitle={data?.heroSubtitle}
        description={data?.heroDescription}
        primaryCta={data?.heroPrimaryCta}
        secondaryCta={data?.heroSecondaryCta}
      />
      <TrustNumbers items={data?.trustNumbers} />
      <Services
        sectionTitle={data?.servicesSectionTitle}
        sectionSubtitle={data?.servicesSectionSubtitle}
        items={data?.servicesItems}
      />
      <WhyUs
        sectionTitle={data?.whyUsSectionTitle}
        sectionSubtitle={data?.whyUsSectionSubtitle}
        reasons={data?.whyUsReasons}
      />
      <FeaturedArticles
        sectionTitle={data?.articlesSectionTitle}
        sectionSubtitle={data?.articlesSectionSubtitle}
        showCount={data?.articlesShowCount}
        ctaText={data?.articlesCtaText}
        ctaLink={data?.articlesCtaLink}
      />
      <CTA
        title={data?.ctaTitle}
        description={data?.ctaDescription}
        primaryCta={data?.ctaPrimaryCta}
        secondaryCta={data?.ctaSecondaryCta}
      />
    </>
  )
}
