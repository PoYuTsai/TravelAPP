import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { client, urlFor } from '@/sanity/client'
import SectionTitle from '@/components/ui/SectionTitle'
import CategoryFilter from '@/components/blog/CategoryFilter'
import { CATEGORY_NAMES, getCategoryName } from '@/lib/constants'

export const metadata: Metadata = {
  title: '部落格 | 清邁旅遊攻略',
  description: '清邁親子旅遊攻略、景點推薦、美食分享、行程規劃，由住在清邁的台灣人親自撰寫的第一手資訊。',
  openGraph: {
    title: '部落格 | 清微旅行',
    description: '清邁親子旅遊攻略、景點推薦、美食分享，在地人的第一手資訊。',
  },
}

// Post 類型定義
interface Post {
  _id: string
  title: string
  slug: { current: string }
  excerpt?: string
  mainImage?: {
    asset: { _ref: string }
    alt?: string
  }
  category?: string
  featured?: boolean
  publishedAt?: string
}

// Use shared category names from constants

// Valid categories for security (prevent injection)
const VALID_CATEGORIES = Object.keys(CATEGORY_NAMES)

// 取得文章 - using parameterized queries for security
async function getPosts(category?: string): Promise<Post[]> {
  // Validate category against whitelist to prevent GROQ injection
  const isValidCategory = category && category !== 'all' && VALID_CATEGORIES.includes(category)

  const query = isValidCategory
    ? `*[_type == "post" && category == $category] | order(featured desc, publishedAt desc) {
        _id,
        title,
        slug,
        excerpt,
        mainImage,
        category,
        featured,
        publishedAt
      }`
    : `*[_type == "post"] | order(featured desc, publishedAt desc) {
        _id,
        title,
        slug,
        excerpt,
        mainImage,
        category,
        featured,
        publishedAt
      }`

  try {
    const posts = await client.fetch<Post[]>(query, isValidCategory ? { category } : {})
    return posts
  } catch {
    return []
  }
}

export const revalidate = 60 // 每 60 秒重新驗證

interface BlogPageProps {
  searchParams: Promise<{ category?: string }>
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams
  const category = params.category
  const posts = await getPosts(category)

  const featuredPost = posts.find((p) => p.featured)
  const otherPosts = posts.filter((p) => p._id !== featuredPost?._id)

  // 如果沒有文章，顯示提示
  if (posts.length === 0) {
    return (
      <div className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle
            title="部落格"
            subtitle="清邁旅遊資訊、親子攻略、在地推薦"
          />

          <Suspense fallback={<div className="flex justify-center gap-2 mb-8">{/* Loading */}</div>}>
            <CategoryFilter />
          </Suspense>

          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">
              {category ? `「${getCategoryName(category)}」分類暫無文章` : '文章正在準備中...'}
            </p>
            {category && (
              <Link href="/blog" className="text-primary hover:underline">
                ← 查看所有文章
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-12 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="部落格"
          subtitle="清邁旅遊資訊、親子攻略、在地推薦"
        />

        {/* 分類篩選 */}
        <Suspense fallback={<div className="flex justify-center gap-2 mb-8">{/* Loading */}</div>}>
          <CategoryFilter />
        </Suspense>

        {/* 精選文章 */}
        {featuredPost && !category && (
          <Link href={`/blog/${featuredPost.slug.current}`} className="block mb-12 group">
            <article className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
              <div className="md:flex">
                <div className="md:w-1/2 relative h-64 md:h-80">
                  {featuredPost.mainImage ? (
                    <Image
                      src={urlFor(featuredPost.mainImage).width(800).height(600).url()}
                      alt={featuredPost.mainImage.alt || featuredPost.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                      <span className="text-6xl">📝</span>
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                      精選文章
                    </span>
                  </div>
                </div>
                <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs bg-primary/20 text-primary-dark px-2 py-1 rounded-full font-medium">
                      {featuredPost.category ? (getCategoryName(featuredPost.category)) : '文章'}
                    </span>
                    {featuredPost.publishedAt && (
                      <span className="text-xs text-gray-400">
                        {new Date(featuredPost.publishedAt).toLocaleDateString('zh-TW')}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 group-hover:text-primary transition-colors">
                    {featuredPost.title}
                  </h2>
                  <p className="text-gray-600 mb-4 line-clamp-3">{featuredPost.excerpt}</p>
                  <span className="text-primary font-medium group-hover:underline">
                    閱讀全文 →
                  </span>
                </div>
              </div>
            </article>
          </Link>
        )}

        {/* 文章列表 */}
        {(category ? posts : otherPosts).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(category ? posts : otherPosts).map((post) => (
              <Link key={post._id} href={`/blog/${post.slug.current}`} className="group">
                <article className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow h-full flex flex-col">
                  <div className="relative h-48">
                    {post.mainImage ? (
                      <Image
                        src={urlFor(post.mainImage).width(600).height(400).url()}
                        alt={post.mainImage.alt || post.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                        <span className="text-4xl">📝</span>
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-primary/20 text-primary-dark px-2 py-1 rounded-full font-medium">
                        {post.category ? (getCategoryName(post.category)) : '文章'}
                      </span>
                      {post.publishedAt && (
                        <span className="text-xs text-gray-400">
                          {new Date(post.publishedAt).toLocaleDateString('zh-TW')}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-gray-600 text-sm flex-1 line-clamp-2">{post.excerpt}</p>
                    <span className="text-primary text-sm font-medium mt-4 group-hover:underline">
                      閱讀更多 →
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {/* SEO 說明文字 */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 mb-4">更多清邁旅遊攻略持續更新中...</p>
          <p className="text-sm text-gray-400">
            所有文章由住在清邁的台灣人 Eric 親自撰寫，提供最真實的在地資訊
          </p>
        </div>
      </div>
    </div>
  )
}
