/**
 * Shared TypeScript types for the application
 */

// Sanity image type
export interface SanityImage {
  _type: 'image'
  asset: {
    _ref: string
    _type: 'reference'
  }
  alt?: string
  caption?: string
  hotspot?: {
    x: number
    y: number
    height: number
    width: number
  }
}

// Sanity slug type
export interface SanitySlug {
  _type: 'slug'
  current: string
}

// Blog post type
export interface BlogPost {
  _id: string
  title: string
  slug: SanitySlug
  excerpt?: string
  category?: string
  publishedAt?: string
  coverImage?: SanityImage
  content?: unknown[]
}

// Tour package type
export interface TourPackage {
  _id: string
  title: string
  slug: SanitySlug
  subtitle?: string
  coverImage?: SanityImage
  days?: number
  priceFrom?: number
  priceNote?: string
  highlights?: string[]
  isPopular?: boolean
}

// Day tour type
export interface DayTour {
  _id: string
  title: string
  slug: SanitySlug
  subtitle?: string
  coverImage?: SanityImage
  duration?: string
  priceFrom?: number
  priceNote?: string
  highlights?: string[]
}

// Tour stop type
export interface TourStop {
  _key: string
  name: string
  description?: string
  duration?: string
  images?: SanityImage[]
}

// Feature type (for service pages)
export interface Feature {
  icon?: string
  title: string
  description?: string
}

// FAQ item type
export interface FAQItem {
  question: string
  answer: string
}

// CTA button type
export interface CTAButton {
  text: string
  link: string
}

// Trust point type
export interface TrustPoint {
  text: string
}

// Video aspect ratio
export type VideoAspect = 'portrait' | 'landscape' | 'square'
