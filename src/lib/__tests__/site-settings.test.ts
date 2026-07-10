import { describe, expect, it } from 'vitest'
import {
  defaultSiteSettings,
  mergeSiteSettings,
  siteSettingsQuery,
  type SiteSettingsInput,
} from '@/lib/site-settings'
import { PUBLIC_PRICE_RANGE } from '@/lib/home-public-copy'

describe('mergeSiteSettings public policy guardrails', () => {
  it('keeps service promises code-owned while merging contact, social and reviews', () => {
    const input: SiteSettingsInput = {
      description: '保證中文司機，導遊一定隨車，安全座椅免費。',
      priceRange: 'NT$ 3,000 - 10,000',
      telephone: '+66-99-999-9999',
      socialLinks: {
        ...defaultSiteSettings.socialLinks,
        instagram: 'https://instagram.com/cms-account',
      },
      aggregateRating: { ratingValue: 4.9, reviewCount: 321 },
      footer: {
        ...defaultSiteSettings.footer,
        description: '中文司機與導遊全程包含',
        addressText: 'CMS address',
      },
      authorProfile: {
        ...defaultSiteSettings.authorProfile,
        eyebrow: '保證中文司機作者卡',
        imageAlt: '免費座椅與中文司機',
        name: 'CMS Author',
        description: '8 人依法必配導遊',
        serviceLabel: '舊服務',
        serviceValue: '中文司機 + 必含導遊',
        summary: '司機和導遊都會中文',
        primaryCtaText: '立即預約免費座椅',
        secondaryCtaText: '指定中文司機',
      },
      trustSection: {
        eyebrow: '保證中文司機',
        title: '安全座椅全部免費',
        description: '導遊一定隨車',
        cards: defaultSiteSettings.trustSection.cards.map((card, index) => ({
          ...card,
          title: `敵意卡片 ${index + 1}`,
          description: '中文司機與免費座椅',
          href: `https://example.com/trust-${index + 1}`,
          external: true,
          valueOverride: `CMS-${index + 1}`,
        })),
      },
      homeFaq: [{ question: '司機會中文嗎？', answer: '全部都會，座椅免費。' }],
      homeTestimonials: [{
        name: 'CMS Reviewer',
        content: '這是逐字客評。',
        highlight: '真實回饋',
        source: 'google',
      }],
    }

    const merged = mergeSiteSettings(input)

    expect(merged.description).toBe(defaultSiteSettings.description)
    expect(merged.priceRange).toBe(PUBLIC_PRICE_RANGE)
    expect(merged.footer.description).toBe(defaultSiteSettings.footer.description)
    expect(merged.authorProfile.description).toBe(defaultSiteSettings.authorProfile.description)
    expect(merged.authorProfile.serviceLabel).toBe(defaultSiteSettings.authorProfile.serviceLabel)
    expect(merged.authorProfile.serviceValue).toBe(defaultSiteSettings.authorProfile.serviceValue)
    expect(merged.authorProfile.eyebrow).toBe(defaultSiteSettings.authorProfile.eyebrow)
    expect(merged.authorProfile.imageAlt).toBe(defaultSiteSettings.authorProfile.imageAlt)
    expect(merged.authorProfile.summary).toBe(defaultSiteSettings.authorProfile.summary)
    expect(merged.authorProfile.primaryCtaText).toBe(defaultSiteSettings.authorProfile.primaryCtaText)
    expect(merged.authorProfile.secondaryCtaText).toBe(defaultSiteSettings.authorProfile.secondaryCtaText)
    expect(merged.trustSection.eyebrow).toBe(defaultSiteSettings.trustSection.eyebrow)
    expect(merged.trustSection.title).toBe(defaultSiteSettings.trustSection.title)
    expect(merged.trustSection.description).toBe(defaultSiteSettings.trustSection.description)
    expect(merged.trustSection.cards.map(({ title, description }) => ({ title, description }))).toEqual(
      defaultSiteSettings.trustSection.cards.map(({ title, description }) => ({ title, description })),
    )
    expect(merged.homeFaq).toEqual(defaultSiteSettings.homeFaq)

    expect(merged.telephone).toBe('+66-99-999-9999')
    expect(merged.socialLinks.instagram).toBe('https://instagram.com/cms-account')
    expect(merged.aggregateRating).toEqual({ ratingValue: 4.9, reviewCount: 321 })
    expect(merged.footer.addressText).toBe('CMS address')
    expect(merged.authorProfile.name).toBe('CMS Author')
    expect(merged.trustSection.cards.map(({ metric, href, external, valueOverride }) => ({
      metric,
      href,
      external,
      valueOverride,
    }))).toEqual(input.trustSection?.cards.map(({ metric, href, external, valueOverride }) => ({
      metric,
      href,
      external,
      valueOverride,
    })))
    expect(merged.homeTestimonials).toEqual(input.homeTestimonials)
  })

  it('does not query latent author or trust copy fields from Sanity', () => {
    expect(siteSettingsQuery).not.toMatch(
      /\b(?:eyebrow|imageAlt|summary|primaryCtaText|secondaryCtaText|title|description)\b/,
    )
    expect(siteSettingsQuery).toMatch(/authorProfile\s*\{\s*name\s*\}/)
    expect(siteSettingsQuery).toMatch(/trustSection\s*\{[\s\S]*cards\[\]\s*\{[\s\S]*metric/)
    expect(siteSettingsQuery).toMatch(/cards\[\]\s*\{[\s\S]*href[\s\S]*valueOverride/)
  })
})
