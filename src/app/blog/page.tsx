import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { client, urlFor } from '@/sanity/client'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'
import LineCTAButton from '@/components/ui/LineCTAButton'
import CategoryFilter from '@/components/blog/CategoryFilter'
import SearchBox from '@/components/blog/SearchBox'
import Pagination from '@/components/blog/Pagination'
import BlogPageSchema from '@/components/schema/BlogPageSchema'
import { CATEGORY_NAMES, getCategoryName } from '@/lib/constants'

const POSTS_PER_PAGE = 9

export const metadata: Metadata = {
  title: '部落格 | 清邁旅遊攻略',
  description: '清邁親子旅遊攻略、景點推薦、美食分享、行程規劃，由住在清邁的台灣人親自撰寫的第一手資訊。',
  openGraph: {
    title: '部落格 | 清邁旅遊攻略',
    description: '清邁親子旅遊攻略、景點推薦、美食分享，在地人的第一手資訊。',
    url: 'https://chiangway-travel.com/blog',
    images: [{ url: '/images/og-image.png', width: 1200, height: 630, alt: '清微旅行部落格' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '部落格 | 清邁旅遊攻略',
    description: '清邁親子旅遊攻略、景點推薦、美食分享，在地人的第一手資訊。',
    images: ['/images/og-image.png'],
  },
  alternates: {
    canonical: 'https://chiangway-travel.com/blog',
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
async function getPosts(category?: string, searchQuery?: string): Promise<Post[]> {
  // Validate category against whitelist to prevent GROQ injection
  const isValidCategory = category && category !== 'all' && VALID_CATEGORIES.includes(category)
  // Sanitize search query (max 100 chars, remove special chars)
  const sanitizedSearch = searchQuery
    ? searchQuery.slice(0, 100).replace(/[*\[\]{}()]/g, '')
    : null

  let query: string
  let params: Record<string, string> = {}

  if (sanitizedSearch) {
    // Search query - search in title and excerpt
    query = `*[_type == "post" && (title match $search || excerpt match $search)] | order(featured desc, publishedAt desc) {
        _id,
        title,
        slug,
        excerpt,
        mainImage,
        category,
        featured,
        publishedAt
      }`
    params = { search: `*${sanitizedSearch}*` }
  } else if (isValidCategory) {
    query = `*[_type == "post" && category == $category] | order(featured desc, publishedAt desc) {
        _id,
        title,
        slug,
        excerpt,
        mainImage,
        category,
        featured,
        publishedAt
      }`
    params = { category }
  } else {
    query = `*[_type == "post"] | order(featured desc, publishedAt desc) {
        _id,
        title,
        slug,
        excerpt,
        mainImage,
        category,
        featured,
        publishedAt
      }`
  }

  try {
    const posts = await client.fetch<Post[]>(query, params)
    return posts
  } catch {
    return []
  }
}

export const revalidate = 60 // 每 60 秒重新驗證

interface BlogPageProps {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams
  const category = params.category
  const searchQuery = params.q
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const allPosts = await getPosts(category, searchQuery)

  const featuredPost = allPosts.find((p) => p.featured)
  const regularPosts = allPosts.filter((p) => p._id !== featuredPost?._id)

  // 分頁計算
  const totalPosts = regularPosts.length
  const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE)
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE
  const paginatedPosts = regularPosts.slice(startIndex, startIndex + POSTS_PER_PAGE)

  // 只在第一頁且無分類篩選時顯示精選文章
  const showFeatured = currentPage === 1 && !category && !searchQuery && featuredPost
  const activeCategoryName = category ? getCategoryName(category) : null
  const pageEyebrow = searchQuery
    ? 'Search Results'
    : activeCategoryName
      ? `${activeCategoryName} Category`
      : 'Chiang Mai Journal'
  const pageTitle = searchQuery
    ? `搜尋「${searchQuery}」的相關文章`
    : activeCategoryName
      ? `${activeCategoryName} 主題文章`
      : '清邁旅遊攻略與在地帶路筆記'
  const pageDescription = searchQuery
    ? '從在地家庭的觀點，快速找到和你現在正在規劃的主題最相關的文章。'
    : activeCategoryName
      ? `集中整理 ${activeCategoryName} 相關內容，幫你更快找到需要的資訊。`
      : '從景點、交通、故事到親子行程安排，先看懂在地節奏，再決定怎麼玩。'

  const heroSection = (
    <section className="relative overflow-hidden rounded-[36px] bg-stone-950 px-6 py-8 shadow-[0_34px_100px_-45px_rgba(0,0,0,0.55)] md:px-10 md:py-12 lg:px-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,192,9,0.28),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_24%)]" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-light/90">
            {pageEyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
            {pageTitle}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78 md:text-xl">
            {pageDescription}
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-sm text-white/82 backdrop-blur-sm">
              親子旅遊節奏
            </span>
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-sm text-white/82 backdrop-blur-sm">
              清邁在地觀點
            </span>
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-sm text-white/82 backdrop-blur-sm">
              可直接延伸到行程規劃
            </span>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/15 bg-white/94 p-6 shadow-[0_26px_70px_-35px_rgba(0,0,0,0.45)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            這裡可以怎麼看
          </p>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-amber-50 px-4 py-4">
              <p className="text-sm font-medium text-stone-500">目前文章數</p>
              <p className="mt-1 text-2xl font-bold text-stone-900">{allPosts.length} 篇</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-stone-100 px-4 py-4">
                <p className="text-sm font-medium text-stone-500">主題分類</p>
                <p className="mt-1 text-xl font-bold text-stone-900">{VALID_CATEGORIES.length}</p>
              </div>
              <div className="rounded-2xl bg-stone-100 px-4 py-4">
                <p className="text-sm font-medium text-stone-500">精選內容</p>
                <p className="mt-1 text-xl font-bold text-stone-900">{featuredPost ? '有' : '準備中'}</p>
              </div>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-stone-600">
            如果你還不確定要從哪篇開始，先搜尋關鍵字，或直接看精選文章，通常最容易找到方向。
          </p>
        </div>
      </div>
    </section>
  )

  const controlsPanel = (
    <div className="-mt-6 mb-12 px-2 md:-mt-8">
      <div className="rounded-[28px] border border-stone-200 bg-white px-5 py-6 shadow-[0_24px_80px_-45px_rgba(0,0,0,0.35)] md:px-6">
        <Suspense fallback={<div className="h-12 mb-6" />}>
          <SearchBox />
        </Suspense>

        <Suspense fallback={<div className="flex justify-center gap-2 mb-8" />}>
          <CategoryFilter />
        </Suspense>

        {searchQuery && (
          <div className="mt-2 text-center">
            <p className="text-gray-600">
              搜尋「<span className="font-medium text-primary">{searchQuery}</span>」找到 {allPosts.length} 篇文章
            </p>
            <Link href="/blog" className="mt-2 inline-block text-sm text-gray-500 hover:text-primary">
              清除搜尋
            </Link>
          </div>
        )}
      </div>
    </div>
  )

  // 如果沒有文章，顯示提示
  if (allPosts.length === 0) {
    return (
      <div className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {heroSection}
          {controlsPanel}

          <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50 py-16 text-center">
            <p className="text-gray-500 mb-4">
              {searchQuery
                ? `找不到包含「${searchQuery}」的文章`
                : category
                  ? `「${getCategoryName(category)}」分類暫無文章`
                  : '文章正在準備中...'}
            </p>
            {(category || searchQuery) && (
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
    <>
      <BlogPageSchema postCount={allPosts.length} posts={allPosts} />
      <div className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {heroSection}
          {controlsPanel}

        {/* 精選文章 - 只在第一頁且無篩選時顯示 */}
        {showFeatured && (
          <section className="mb-14">
            <SectionTitle
              title="先從這篇開始"
              subtitle="如果你是第一次接觸清微的內容，這篇最適合當入口。"
            />
            <Link href={`/blog/${featuredPost.slug.current}`} className="group block">
            <article className="overflow-hidden rounded-[32px] border border-stone-200 bg-white shadow-[0_28px_90px_-40px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_38px_110px_-45px_rgba(0,0,0,0.45)]">
              <div className="md:flex">
                <div className="relative h-72 md:h-auto md:w-1/2">
                  {featuredPost.mainImage ? (
                    <Image
                      src={urlFor(featuredPost.mainImage).width(800).height(600).quality(85).url()}
                      alt={featuredPost.mainImage.alt || featuredPost.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                      <span className="text-6xl">📝</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-transparent to-transparent" />
                  <div className="absolute left-4 top-4">
                    <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-stone-950 shadow-sm">
                      精選文章
                    </span>
                  </div>
                </div>
                <div className="flex flex-col justify-center p-6 md:w-1/2 md:p-8 lg:p-10">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary-dark">
                      {featuredPost.category ? (getCategoryName(featuredPost.category)) : '文章'}
                    </span>
                    {featuredPost.publishedAt && (
                      <span className="text-xs text-gray-400">
                        {new Date(featuredPost.publishedAt).toLocaleDateString('zh-TW')}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 transition-colors group-hover:text-primary md:text-3xl">
                    {featuredPost.title}
                  </h2>
                  <p className="mt-4 line-clamp-4 text-base leading-7 text-gray-600">{featuredPost.excerpt}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-5">
                    <div>
                      <p className="text-sm font-medium text-stone-900">看完後你通常會更清楚</p>
                      <p className="mt-1 text-sm text-stone-500">自己適合自由排行程，還是直接找我們一起規劃</p>
                    </div>
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/12 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-stone-950">
                      <svg className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </article>
            </Link>
          </section>
        )}

        {/* 文章列表 */}
        {paginatedPosts.length > 0 && (
          <section>
            <SectionTitle
              title={searchQuery || activeCategoryName ? '相關文章' : '繼續往下看'}
              subtitle={searchQuery || activeCategoryName ? '把主題再往下看深一點。' : '從不同主題慢慢拼出最適合你們家的清邁版本。'}
            />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {paginatedPosts.map((post) => (
              <Link key={post._id} href={`/blog/${post.slug.current}`} className="group">
                <article className="flex h-full flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_24px_70px_-40px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_34px_90px_-40px_rgba(0,0,0,0.45)]">
                  <div className="relative aspect-[4/3]">
                    {post.mainImage ? (
                      <Image
                        src={urlFor(post.mainImage).width(600).height(450).quality(85).url()}
                        alt={post.mainImage.alt || post.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                        <span className="text-4xl">📝</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/50 via-transparent to-transparent" />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary-dark">
                        {post.category ? (getCategoryName(post.category)) : '文章'}
                      </span>
                      {post.publishedAt && (
                        <span className="text-xs text-gray-400">
                          {new Date(post.publishedAt).toLocaleDateString('zh-TW')}
                        </span>
                      )}
                    </div>
                    <h3 className="line-clamp-2 text-xl font-bold text-gray-900 transition-colors group-hover:text-primary">
                      {post.title}
                    </h3>
                    <p className="mt-3 flex-1 line-clamp-3 text-sm leading-7 text-gray-600">{post.excerpt}</p>
                    <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
                      <div>
                        <p className="text-sm font-medium text-stone-900">讀完這篇再決定下一步</p>
                        <p className="mt-1 text-xs text-stone-500">看要繼續研究、轉看行程，或直接聊需求</p>
                      </div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-stone-950">
                        <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
          </section>
        )}

          {/* 分頁導航 */}
          <Suspense fallback={null}>
            <Pagination currentPage={currentPage} totalPages={totalPages} />
          </Suspense>

          <section className="relative mt-16 overflow-hidden rounded-[32px] bg-stone-950 px-8 py-10 text-center md:px-12 md:py-14">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,192,9,0.24),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_24%)]" />
            <div className="relative">
              <h2 className="text-3xl font-bold text-white md:text-4xl">
                看完文章，接下來可以這樣做
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
                如果你已經有大方向，就去看行程案例；如果你想直接把需求攤開，也可以直接來聊。
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button href="/tours" variant="outline" className="border-white/35 text-white hover:border-white hover:bg-white hover:text-stone-900">
                  看行程案例
                </Button>
                <LineCTAButton
                  location="Blog Bottom CTA"
                  className="shadow-[0_20px_45px_-18px_rgba(247,192,9,0.88)]"
                >
                  LINE 聊聊你的清邁計畫
                </LineCTAButton>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
