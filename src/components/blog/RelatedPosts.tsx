import Link from 'next/link'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'
import { getCategoryName } from '@/lib/constants'

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
  publishedAt?: string
}

interface RelatedPostsProps {
  currentPostId: string
  category?: string
}

async function getRelatedPosts(currentPostId: string, category?: string): Promise<Post[]> {
  try {
    const sameCategoryPosts = category
      ? await client.fetch<Post[]>(
          `*[_type == "post" && _id != $currentPostId && category == $category] | order(publishedAt desc)[0...3]{
            _id,
            title,
            slug,
            excerpt,
            mainImage,
            category,
            publishedAt
          }`,
          { currentPostId, category }
        )
      : []

    if (sameCategoryPosts.length >= 3) {
      return sameCategoryPosts
    }

    const excludeIds = [currentPostId, ...sameCategoryPosts.map((post) => post._id)]
    const fallbackPosts = await client.fetch<Post[]>(
      `*[_type == "post" && !(_id in $excludeIds)] | order(publishedAt desc)[0...$limit]{
        _id,
        title,
        slug,
        excerpt,
        mainImage,
        category,
        publishedAt
      }`,
      {
        excludeIds,
        limit: 3 - sameCategoryPosts.length,
      }
    )

    return [...sameCategoryPosts, ...fallbackPosts]
  } catch {
    return []
  }
}

export default async function RelatedPosts({ currentPostId, category }: RelatedPostsProps) {
  const posts = await getRelatedPosts(currentPostId, category)

  if (posts.length === 0) {
    return null
  }

  return (
    <section className="mt-16 border-t border-stone-200 pt-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
            Related Reading
          </p>
          <h2 className="mt-3 text-3xl font-bold text-stone-900">接著讀這幾篇會更完整</h2>
          <p className="mt-3 text-base leading-7 text-stone-600">
            如果你還在比較清邁景點、交通或親子玩法，下面這幾篇通常會剛好補上下一個問題。
          </p>
        </div>
        <Button href="/blog" variant="outline" size="sm">
          看全部文章
        </Button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {posts.map((post) => (
          <Link key={post._id} href={`/blog/${post.slug.current}`} className="group block">
            <article className="flex h-full flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_24px_70px_-40px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_34px_90px_-40px_rgba(0,0,0,0.45)]">
              <div className="relative aspect-[4/3]">
                {post.mainImage ? (
                  <Image
                    src={urlFor(post.mainImage).width(800).height(600).quality(85).url()}
                    alt={post.mainImage.alt || post.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-light to-primary/20">
                    <span className="text-4xl">📝</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/55 via-transparent to-transparent" />
              </div>

              <div className="flex flex-1 flex-col p-6">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary-dark">
                    {getCategoryName(post.category || '') || '清邁文章'}
                  </span>
                  {post.publishedAt && (
                    <span className="text-xs text-stone-400">
                      {new Date(post.publishedAt).toLocaleDateString('zh-TW')}
                    </span>
                  )}
                </div>
                <h3 className="line-clamp-2 text-xl font-bold text-stone-900 transition-colors group-hover:text-primary">
                  {post.title}
                </h3>
                <p className="mt-3 flex-1 line-clamp-3 text-sm leading-7 text-stone-600">
                  {post.excerpt}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
                  <div>
                    <p className="text-sm font-medium text-stone-900">先補資訊，再排行程</p>
                    <p className="mt-1 text-xs text-stone-500">把文章看順後，決策會更快</p>
                  </div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-stone-950">
                    <svg
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
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
  )
}
