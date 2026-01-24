import { MetadataRoute } from 'next'
import { client } from '@/sanity/client'
import { CATEGORY_NAMES } from '@/lib/constants'

async function getBlogSlugs() {
  const query = `*[_type == "post" && defined(slug.current)]{
    "slug": slug.current,
    _updatedAt
  }`
  try {
    return await client.fetch(query)
  } catch {
    return []
  }
}

async function getTourSlugs() {
  const query = `*[_type == "tour" && defined(slug.current)]{
    "slug": slug.current,
    _updatedAt
  }`
  try {
    return await client.fetch(query)
  } catch {
    return []
  }
}

async function getDayTourSlugs() {
  const query = `*[_type == "dayTour" && defined(slug.current)]{
    "slug": slug.current,
    _updatedAt
  }`
  try {
    return await client.fetch(query)
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://chiangway-travel.com'

  // 靜態頁面
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/tours`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/services/car-charter`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/homestay`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/cancellation`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ]

  // 部落格分類頁面
  const categoryPages: MetadataRoute.Sitemap = Object.keys(CATEGORY_NAMES).map((category) => ({
    url: `${baseUrl}/blog/category/${category}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  // 動態部落格文章
  const posts = await getBlogSlugs()
  const blogPages: MetadataRoute.Sitemap = posts.map((post: { slug: string; _updatedAt: string }) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post._updatedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // 動態行程套餐
  const tours = await getTourSlugs()
  const tourPages: MetadataRoute.Sitemap = tours.map((tour: { slug: string; _updatedAt: string }) => ({
    url: `${baseUrl}/tours/${tour.slug}`,
    lastModified: new Date(tour._updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // 動態一日遊
  const dayTours = await getDayTourSlugs()
  const dayTourPages: MetadataRoute.Sitemap = dayTours.map((tour: { slug: string; _updatedAt: string }) => ({
    url: `${baseUrl}/tours/${tour.slug}`,
    lastModified: new Date(tour._updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...categoryPages, ...blogPages, ...tourPages, ...dayTourPages]
}
