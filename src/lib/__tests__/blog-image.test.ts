import { describe, expect, it, vi } from 'vitest'

const calls = {
  width: [] as number[],
  fit: [] as string[],
  auto: [] as string[],
  quality: [] as number[],
}

vi.mock('@/sanity/client', () => ({
  urlFor: () => {
    const builder = {
      width(value: number) {
        calls.width.push(value)
        return builder
      },
      fit(value: string) {
        calls.fit.push(value)
        return builder
      },
      auto(value: string) {
        calls.auto.push(value)
        return builder
      },
      quality(value: number) {
        calls.quality.push(value)
        return builder
      },
      url() {
        return 'https://cdn.sanity.io/mock-image.jpg'
      },
    }

    return builder
  },
}))

import {
  BLOG_ARTICLE_BODY_IMAGE_SIZES,
  BLOG_ARTICLE_BODY_IMAGE_WIDTH,
  BLOG_ARTICLE_BODY_LIGHTBOX_WIDTH,
  BLOG_ARTICLE_HERO_IMAGE_SIZES,
  BLOG_ARTICLE_HERO_IMAGE_WIDTH,
  BLOG_ARTICLE_PORTRAIT_IMAGE_SIZES,
  getBlogArticleBodyImageUrl,
  getBlogArticleHeroImageUrl,
  getBlogArticleLightboxImageUrl,
} from '@/lib/blog-image'

describe('blog image sizing', () => {
  it('uses higher-resolution widths for article images on desktop displays', () => {
    expect(BLOG_ARTICLE_HERO_IMAGE_WIDTH).toBeGreaterThan(1200)
    expect(BLOG_ARTICLE_BODY_IMAGE_WIDTH).toBeGreaterThan(800)
    expect(BLOG_ARTICLE_BODY_LIGHTBOX_WIDTH).toBeGreaterThan(BLOG_ARTICLE_BODY_IMAGE_WIDTH)
  })

  it('keeps responsive sizes aligned with the blog layout widths', () => {
    expect(BLOG_ARTICLE_HERO_IMAGE_SIZES).toBe('(max-width: 768px) 100vw, 896px')
    expect(BLOG_ARTICLE_BODY_IMAGE_SIZES).toBe('(max-width: 768px) 100vw, 896px')
    expect(BLOG_ARTICLE_PORTRAIT_IMAGE_SIZES).toBe('(max-width: 768px) 50vw, 360px')
  })

  it('builds high-resolution sanity URLs for hero, body, and lightbox images', () => {
    getBlogArticleHeroImageUrl({ asset: { _ref: 'image-hero' } })
    getBlogArticleBodyImageUrl({ asset: { _ref: 'image-body' } })
    getBlogArticleLightboxImageUrl({ asset: { _ref: 'image-lightbox' } })

    expect(calls.width).toEqual([
      BLOG_ARTICLE_HERO_IMAGE_WIDTH,
      BLOG_ARTICLE_BODY_IMAGE_WIDTH,
      BLOG_ARTICLE_BODY_LIGHTBOX_WIDTH,
    ])
    expect(calls.fit).toEqual(['max', 'max', 'max'])
    expect(calls.auto).toEqual(['format', 'format', 'format'])
    expect(calls.quality).toEqual([90, 90, 90])
  })
})
