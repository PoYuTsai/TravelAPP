/**
 * Navigation links and social media configuration
 * Centralized to avoid duplication across Header, Footer, and other components
 */
import { defaultSiteSettings } from '@/lib/site-settings'

export const LINE_URL = defaultSiteSettings.socialLinks.line

export const headerNavLinks = [
  { href: '/', label: '首頁' },
  { href: '/services/car-charter', label: '包車服務' },
  { href: '/tours', label: '行程案例' },
  { href: '/blog', label: '部落格' },
] as const

export const footerNavLinks = [
  { href: '/', label: '首頁' },
  { href: '/services/car-charter', label: '包車服務' },
  { href: '/tours', label: '行程案例' },
  { href: '/homestay', label: '芳縣民宿' },
  { href: '/blog', label: '部落格' },
  { href: '/blog/eric-story-taiwan-to-chiang-mai', label: '我們的故事' },
] as const

export const legalLinks = [
  { href: '/privacy', label: '隱私權政策' },
  { href: '/terms', label: '服務條款' },
  { href: '/cancellation', label: '取消政策' },
] as const

export const socialLinks = [
  {
    href: LINE_URL,
    label: 'LINE',
    trackingLabel: 'LINE',
  },
  {
    href: defaultSiteSettings.socialLinks.instagram,
    label: 'Instagram',
  },
  {
    href: defaultSiteSettings.socialLinks.facebook,
    label: 'Facebook',
  },
  {
    href: defaultSiteSettings.socialLinks.tiktok,
    label: 'TikTok',
  },
] as const

// Type exports for external use
export type NavLink = { href: string; label: string }
export type SocialLink = { href: string; label: string; trackingLabel?: string }
