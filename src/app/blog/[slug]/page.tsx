import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { client, urlFor } from '@/sanity/client'
import TableOfContents from '@/components/blog/TableOfContents'
import Breadcrumb from '@/components/blog/Breadcrumb'
import AuthorCard from '@/components/blog/AuthorCard'
import ArticleSchema from '@/components/blog/ArticleSchema'
import PortableTextRenderer from '@/components/blog/PortableTextRenderer'
import Button from '@/components/ui/Button'

// Sanity 查詢 - 取得單篇文章
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

// Sanity 查詢 - 取得所有 slug
const slugsQuery = `*[_type == "post" && defined(slug.current)][].slug.current`

// 分類名稱對照
const categoryNames: Record<string, string> = {
  guide: '攻略',
  attraction: '景點',
  food: '美食',
  accommodation: '住宿',
  transportation: '交通',
  itinerary: '行程',
}

// 取得文章
async function getPost(slug: string) {
  try {
    const post = await client.fetch(postQuery, { slug })
    return post
  } catch {
    return null
  }
}

// 產生靜態路徑
export async function generateStaticParams() {
  try {
    const slugs = await client.fetch(slugsQuery)
    return slugs.map((slug: string) => ({ slug }))
  } catch {
    return []
  }
}

// 產生 metadata
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug)

  if (!post) {
    return { title: '文章不存在' }
  }

  const description = post.seoDescription || post.excerpt || `${post.title} - 清微旅行`
  const imageUrl = post.mainImage ? urlFor(post.mainImage).width(1200).height(630).url() : undefined

  return {
    title: post.title,
    description,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
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

export const revalidate = 60 // 每 60 秒重新驗證

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)

  if (!post) {
    notFound()
  }

  const breadcrumbItems = [
    { label: '首頁', href: '/' },
    { label: '部落格', href: '/blog' },
    { label: post.title },
  ]

  const description = post.seoDescription || post.excerpt || ''

  return (
    <>
      <ArticleSchema
        title={post.title}
        description={description}
        slug={params.slug}
        datePublished={post.publishedAt}
        dateModified={post.updatedAt}
        image={post.mainImage ? urlFor(post.mainImage).width(1200).url() : undefined}
      />

      <article className="py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={breadcrumbItems} />

          {/* 文章標頭 */}
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm bg-primary/20 text-primary-dark px-3 py-1 rounded-full font-medium">
                {categoryNames[post.category] || post.category}
              </span>
              {post.publishedAt && (
                <time className="text-sm text-gray-500" dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              )}
              {post.updatedAt && post.updatedAt !== post.publishedAt && (
                <span className="text-sm text-gray-400">
                  （更新於 {new Date(post.updatedAt).toLocaleDateString('zh-TW')}）
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="mt-4 text-lg text-gray-600">{post.excerpt}</p>
            )}
          </header>

          {/* 封面圖片 */}
          {post.mainImage && (
            <div className="mb-8 rounded-2xl overflow-hidden">
              <Image
                src={urlFor(post.mainImage).width(1200).height(630).url()}
                alt={post.mainImage.alt || post.title}
                width={1200}
                height={630}
                className="w-full h-auto"
                priority
              />
            </div>
          )}

          {/* 作者資訊 */}
          <AuthorCard />

          {/* 文章目錄 */}
          <TableOfContents />

          {/* 文章內容 */}
          <div className="mt-8">
            {post.body ? (
              <PortableTextRenderer content={post.body} />
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>文章內容正在準備中...</p>
              </div>
            )}
          </div>

          {/* 文章底部 CTA */}
          <div className="mt-16 p-8 bg-gradient-to-br from-primary-light to-primary/20 rounded-2xl text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              讓我們幫你規劃清邁親子之旅
            </h3>
            <p className="text-gray-600 mb-6 max-w-lg mx-auto">
              我們是住在清邁的台泰夫妻，提供專業的親子包車服務。免費諮詢，讓在地人帶你玩最道地的清邁！
            </p>
            <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
              LINE 免費諮詢
            </Button>
          </div>

          {/* 作者資訊（底部再次顯示）*/}
          <div className="mt-12">
            <AuthorCard />
          </div>
        </div>
      </article>
    </>
  )
}
