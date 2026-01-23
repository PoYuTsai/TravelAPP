/**
 * Navigation links and social media configuration
 * Centralized to avoid duplication across Header, Footer, and other components
 */

export const LINE_URL = 'https://line.me/R/ti/p/@037nyuwk'

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
    href: 'https://www.instagram.com/chiangway_travel',
    label: 'Instagram',
  },
  {
    href: 'https://www.facebook.com/profile.php?id=61569067776768',
    label: 'Facebook',
  },
  {
    href: 'https://www.tiktok.com/@chiangway_travel',
    label: 'TikTok',
  },
] as const

// Type exports for external use
export type NavLink = { href: string; label: string }
export type SocialLink = { href: string; label: string; trackingLabel?: string }
