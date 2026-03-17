import type { Metadata } from 'next'
import type { PortableTextBlock } from '@portabletext/types'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { client, urlFor } from '@/sanity/client'
import TableOfContents from '@/components/blog/TableOfContents'
import Breadcrumb from '@/components/ui/Breadcrumb'
import AuthorCard from '@/components/blog/AuthorCard'
import ArticleSchema from '@/components/blog/ArticleSchema'
import ArticleViewTracker from '@/components/analytics/ArticleViewTracker'
import ScrollDepthTracker from '@/components/analytics/ScrollDepthTracker'
import PortableTextRenderer from '@/components/blog/PortableTextRenderer'
import RelatedPosts from '@/components/blog/RelatedPosts'
import Button from '@/components/ui/Button'
import LineCTAButton from '@/components/ui/LineCTAButton'
import { getCategoryName } from '@/lib/constants'
import { mergeSiteSettings, siteSettingsQuery } from '@/lib/site-settings'

interface Post {
  _id: string
  title: string
  slug: { current: string }
  excerpt?: string
  seoDescription?: string
  mainImage?: {
    alt?: string
  }
  body?: PortableTextBlock[]
  category?: string
  featured?: boolean
  publishedAt?: string
  updatedAt?: string
}

const postQuery = `*[_type == "post" && slug.current == $slug][0] {
  _id,
  title,
  slug,
  excerpt,
  seoDescription,
  mainImage,
  body[] {
    ...,
    _type == "toursBlock" => {
      ...,
      tours[]-> {
        title,
        slug,
        excerpt
      }
    }
  },
  category,
  featured,
  publishedAt,
  updatedAt
}`

const slugsQuery = `*[_type == "post" && defined(slug.current)][].slug.current`

async function getPost(slug: string): Promise<Post | null> {
  try {
    return await client.fetch<Post | null>(postQuery, { slug })
  } catch {
    return null
  }
}

async function getSiteSettings() {
  try {
    return await client.fetch(siteSettingsQuery)
  } catch {
    return null
  }
}

export async function generateStaticParams() {
  try {
    const slugs = await client.fetch<string[]>(slugsQuery)
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) {
    return { title: '找不到文章' }
  }

  const description = post.seoDescription || post.excerpt || `${post.title} - 清微旅行`
  const imageUrl = post.mainImage
    ? urlFor(post.mainImage).width(1200).height(630).fit('crop').crop('focalpoint').url()
    : undefined

  return {
    title: post.title,
    description,
    alternates: {
      canonical: `https://chiangway-travel.com/blog/${slug}`,
    },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      locale: 'zh_TW',
      siteName: '清微旅行 Chiangway Travel',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      authors: ['清微旅行'],
      images: imageUrl ? [imageUrl] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  }
}

export const revalidate = 60

function formatDate(date?: string) {
  if (!date) return null
  return new Date(date).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [post, rawSiteSettings] = await Promise.all([getPost(slug), getSiteSettings()])

  if (!post) {
    notFound()
  }

  const siteSettings = mergeSiteSettings(rawSiteSettings)
  const description = post.seoDescription || post.excerpt || ''
  const categoryName = getCategoryName(post.category || '') || '清邁文章'
  const publishedLabel = formatDate(post.publishedAt)
  const updatedLabel = formatDate(post.updatedAt)
  const coverImageUrl = post.mainImage ? urlFor(post.mainImage).width(1600).fit('max').auto('format').url() : null
  const hasUpdatedDate = Boolean(post.updatedAt && post.updatedAt !== post.publishedAt)
  const readingChecklist = [
    '先抓這篇文章適合解什麼問題',
    '看到景點或交通資訊時，再對照你們家的節奏',
    '如果已經有日期，直接用 LINE 問實際安排最快',
  ]

  return (
    <>
      <ArticleSchema
        title={post.title}
        description={description}
        slug={slug}
        datePublished={post.publishedAt}
        dateModified={post.updatedAt}
        image={post.mainImage ? urlFor(post.mainImage).width(1200).url() : undefined}
      />
      <ArticleViewTracker title={post.title} slug={slug} />
      <ScrollDepthTracker pageTitle={post.title} />

      <div className="py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: '首頁', href: '/' },
              { label: '清邁旅遊文章', href: '/blog' },
              { label: post.title },
            ]}
          />

          <section className="relative mt-4 overflow-hidden rounded-[36px] bg-stone-950 px-6 py-8 shadow-[0_34px_100px_-45px_rgba(0,0,0,0.55)] md:px-10 md:py-12 lg:px-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,192,9,0.28),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_24%)]" />
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-end">
              <div className="max-w-3xl">
                <div className="flex flex-wrap gap-2.5">
                  {post.category && (
                    <Link
                      href={`/blog/category/${post.category}`}
                      className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-sm font-medium text-white/82 backdrop-blur-sm transition-colors hover:bg-white/14"
                    >
                      {categoryName}
                    </Link>
                  )}
                  {publishedLabel && (
                    <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-sm font-medium text-white/82 backdrop-blur-sm">
                      發布於 {publishedLabel}
                    </span>
                  )}
                  {hasUpdatedDate && updatedLabel && (
                    <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-sm font-medium text-white/82 backdrop-blur-sm">
                      更新於 {updatedLabel}
                    </span>
                  )}
                </div>

                <h1 className="mt-5 text-4xl font-bold leading-tight text-white md:text-5xl">
                  {post.title}
                </h1>
                {post.excerpt && (
                  <p className="mt-5 max-w-2xl text-lg leading-8 text-white/76 md:text-xl">
                    {post.excerpt}
                  </p>
                )}

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Button
                    href="#article-content"
                    size="lg"
                    className="shadow-[0_20px_45px_-18px_rgba(247,192,9,0.88)]"
                  >
                    開始閱讀重點
                  </Button>
                  <Button
                    href="/tours"
                    variant="outline"
                    size="lg"
                    className="border-white/35 text-white hover:border-white hover:bg-white hover:text-stone-900"
                  >
                    看清邁行程案例
                  </Button>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/15 bg-white/94 p-6 shadow-[0_26px_70px_-35px_rgba(0,0,0,0.45)]">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  閱讀摘要
                </p>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-amber-50 px-4 py-4">
                    <p className="text-sm font-medium text-stone-500">品牌信任</p>
                    <p className="mt-1 text-2xl font-bold text-stone-900">
                      {siteSettings.aggregateRating.ratingValue} / {siteSettings.aggregateRating.reviewCount}+
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-stone-100 px-4 py-4">
                      <p className="text-sm font-medium text-stone-500">文章類型</p>
                      <p className="mt-1 text-xl font-bold text-stone-900">{categoryName || '清邁文章'}</p>
                    </div>
                    <div className="rounded-2xl bg-stone-100 px-4 py-4">
                      <p className="text-sm font-medium text-stone-500">適合讀者</p>
                      <p className="mt-1 text-xl font-bold text-stone-900">親子自由行</p>
                    </div>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-6 text-stone-600">
                  這篇文章的目標不是把資訊塞滿，而是幫你更快判斷這個主題跟你們家的旅程有沒有關。
                </p>
                <div className="mt-5">
                  <LineCTAButton location="Article Hero CTA" className="w-full">
                    LINE 詢問清邁安排
                  </LineCTAButton>
                </div>
              </div>
            </div>
          </section>

          {coverImageUrl && (
            <div className="-mt-6 mb-16 px-2 md:-mt-8">
              <div className="overflow-hidden rounded-[30px] border border-stone-200 bg-white p-3 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.35)]">
                <div className="overflow-hidden rounded-[24px]">
                  <Image
                    src={coverImageUrl}
                    alt={post.mainImage?.alt || post.title}
                    width={1600}
                    height={1000}
                    className="h-auto w-full"
                    sizes="(max-width: 768px) 100vw, 1200px"
                    priority
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <article id="article-content" className="min-w-0">
              <div className="rounded-[32px] bg-white px-6 py-6 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.2)] md:px-8">
                {post.body ? (
                  <PortableTextRenderer content={post.body} />
                ) : (
                  <div className="py-12 text-center text-gray-500">
                    <p>這篇文章目前還沒有內容。</p>
                  </div>
                )}
              </div>

              <div className="mt-14 rounded-[32px] bg-amber-50 px-8 py-10 text-center md:px-10 md:py-12">
                <h2 className="text-3xl font-bold text-stone-900 md:text-4xl">
                  看完這篇，如果你已經有日期，下一步就可以開始問了
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-stone-700 md:text-lg">
                  你不需要先把所有細節整理完。先丟日期、人數、孩子年齡或飯店位置，我們就能先幫你抓方向。
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <LineCTAButton
                    location="Article Bottom CTA"
                    className="shadow-[0_20px_45px_-18px_rgba(247,192,9,0.88)]"
                  >
                    LINE 問清邁行程
                  </LineCTAButton>
                  <Button href="/tours" variant="secondary">
                    看清邁行程案例
                  </Button>
                </div>
              </div>
            </article>

            <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
              <AuthorCard
                variant="sidebar"
                ratingValue={siteSettings.aggregateRating.ratingValue}
                reviewCount={siteSettings.aggregateRating.reviewCount}
                profile={siteSettings.authorProfile}
              />
              <TableOfContents />
              <div className="rounded-[28px] bg-stone-950 px-5 py-6 text-white shadow-[0_24px_70px_-40px_rgba(0,0,0,0.35)]">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-light/90">
                  Reading Notes
                </p>
                <h2 className="mt-2 text-xl font-bold">這篇可以這樣讀</h2>
                <ul className="mt-4 space-y-3">
                  {readingChecklist.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-6 text-white/76">
                      <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs text-primary-light">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>

          <Suspense
            fallback={
              <div className="mt-16 border-t border-stone-200 pt-12 text-center text-stone-500">
                載入相關文章中...
              </div>
            }
          >
            <RelatedPosts currentPostId={post._id} category={post.category} />
          </Suspense>
        </div>
      </div>
    </>
  )
}
