import { describe, expect, it } from 'vitest'
import {
  defaultSiteSettings,
  mergeSiteSettings,
  type SiteSettingsInput,
} from '@/lib/site-settings'

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
        name: 'CMS Author',
        description: '8 人依法必配導遊',
        serviceLabel: '舊服務',
        serviceValue: '中文司機 + 必含導遊',
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
    expect(merged.priceRange).toBe('THB 750–3,500／人／日')
    expect(merged.footer.description).toBe(defaultSiteSettings.footer.description)
    expect(merged.authorProfile.description).toBe(defaultSiteSettings.authorProfile.description)
    expect(merged.authorProfile.serviceLabel).toBe(defaultSiteSettings.authorProfile.serviceLabel)
    expect(merged.authorProfile.serviceValue).toBe(defaultSiteSettings.authorProfile.serviceValue)
    expect(merged.homeFaq).toEqual(defaultSiteSettings.homeFaq)

    expect(merged.telephone).toBe('+66-99-999-9999')
    expect(merged.socialLinks.instagram).toBe('https://instagram.com/cms-account')
    expect(merged.aggregateRating).toEqual({ ratingValue: 4.9, reviewCount: 321 })
    expect(merged.footer.addressText).toBe('CMS address')
    expect(merged.authorProfile.name).toBe('CMS Author')
    expect(merged.homeTestimonials).toEqual(input.homeTestimonials)
  })
})
