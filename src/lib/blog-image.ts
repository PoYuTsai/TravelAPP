import type { SanityImageSource } from '@sanity/image-url'
import { urlFor } from '@/sanity/client'

export const BLOG_ARTICLE_HERO_IMAGE_WIDTH = 1800
export const BLOG_ARTICLE_BODY_IMAGE_WIDTH = 1600
export const BLOG_ARTICLE_BODY_LIGHTBOX_WIDTH = 2400

export const BLOG_ARTICLE_HERO_IMAGE_SIZES = '(max-width: 768px) 100vw, 896px'
export const BLOG_ARTICLE_BODY_IMAGE_SIZES = '(max-width: 768px) 100vw, 896px'
export const BLOG_ARTICLE_PORTRAIT_IMAGE_SIZES = '(max-width: 768px) 50vw, 360px'

const buildBlogImageUrl = (source: SanityImageSource, width: number) =>
  urlFor(source)
    .width(width)
    .fit('max')
    .auto('format')
    .quality(90)
    .url()

export function getBlogArticleHeroImageUrl(source: SanityImageSource) {
  return buildBlogImageUrl(source, BLOG_ARTICLE_HERO_IMAGE_WIDTH)
}

export function getBlogArticleBodyImageUrl(source: SanityImageSource) {
  return buildBlogImageUrl(source, BLOG_ARTICLE_BODY_IMAGE_WIDTH)
}

export function getBlogArticleLightboxImageUrl(source: SanityImageSource) {
  return buildBlogImageUrl(source, BLOG_ARTICLE_BODY_LIGHTBOX_WIDTH)
}
