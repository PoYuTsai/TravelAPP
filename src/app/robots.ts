import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/studio/', '/api-docs/'],
    },
    sitemap: 'https://chiangway-travel.com/sitemap.xml',
  }
}
