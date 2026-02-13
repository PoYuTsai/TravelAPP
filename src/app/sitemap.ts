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

// 合併查詢所有 tour 類型（tourPackage + dayTour），避免 sitemap 中的重複 URL
async function getAllTourSlugs() {
  const query = `*[(_type == "tourPackage" || _type == "dayTour") && defined(slug.current)]{
    "slug": slug.current,
    _updatedAt
  } | order(_updatedAt desc)`
  try {
    const results = await client.fetch(query)
    // 使用 Map 去除重複的 slug，保留最新的 _updatedAt
    const uniqueSlugs = new Map<string, { slug: string; _updatedAt: string }>()
    results.forEach((item: { slug: string; _updatedAt: string }) => {
      if (!uniqueSlugs.has(item.slug) || new Date(item._updatedAt) > new Date(uniqueSlugs.get(item.slug)!._updatedAt)) {
        uniqueSlugs.set(item.slug, item)
      }
    })
    return Array.from(uniqueSlugs.values())
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://chiangway-travel.com'

  // 靜態頁面 - 使用固定版本日期（避免每次生成都變更）
  const lastUpdated = new Date('2026-02-13')
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: lastUpdated, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/tours`, lastModified: lastUpdated, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/services/car-charter`, lastModified: lastUpdated, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/homestay`, lastModified: lastUpdated, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: lastUpdated, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/contact`, lastModified: lastUpdated, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/privacy`, lastModified: lastUpdated, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: lastUpdated, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/cancellation`, lastModified: lastUpdated, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // 部落格分類頁面
  const categoryPages: MetadataRoute.Sitemap = Object.keys(CATEGORY_NAMES).map((category) => ({
    url: `${baseUrl}/blog/category/${category}`,
    lastModified: lastUpdated,
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

  // 動態行程（合併 tourPackage + dayTour，避免重複 URL）
  const tours = await getAllTourSlugs()
  const tourPages: MetadataRoute.Sitemap = tours.map((tour: { slug: string; _updatedAt: string }) => ({
    url: `${baseUrl}/tours/${tour.slug}`,
    lastModified: new Date(tour._updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...categoryPages, ...blogPages, ...tourPages]
}
