// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { sanitizeQuoteHtml } from '@/sanity/tools/pricing/quoteHtml'

describe('sanitizeQuoteHtml', () => {
  it('keeps safe image tags for quote pdf rendering', () => {
    const html = sanitizeQuoteHtml('<div><img src="/images/quote-hero-eric-min.jpg" alt="hero" class="hero-image" /></div>')

    expect(html).toContain('<img')
    expect(html).toContain('src="/images/quote-hero-eric-min.jpg"')
  })

  it('strips dangerous inline handlers from images', () => {
    const html = sanitizeQuoteHtml('<img src="/images/quote-hero-eric-min.jpg" onerror="alert(1)" alt="hero" />')

    expect(html).toContain('<img')
    expect(html).not.toContain('onerror')
  })

  it('removes javascript image sources', () => {
    const html = sanitizeQuoteHtml('<img src="javascript:alert(1)" alt="bad" />')

    expect(html).toContain('<img')
    expect(html).not.toContain('src=')
  })
})
