import Link from 'next/link'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'
import { getCategoryName } from '@/lib/constants'

interface BlogPost {
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

interface RelatedBlogPostsProps {
  tourTitle: string
  tourHighlights?: string[]
}

async function getRelatedBlogPosts(
  tourTitle: string,
  highlights: string[] = []
): Promise<BlogPost[]> {
  const keywords = Array.from(
    new Set(
      [tourTitle, ...highlights]
        .flatMap((item) => item.split(/[\s,、，/]+/))
        .map((keyword) => keyword.trim().toLowerCase())
        .filter((keyword) => keyword.length > 1)
    )
  ).slice(0, 6)

  const query = `*[_type == "post"] | order(publishedAt desc)[0...12] {
    _id,
    title,
    slug,
    excerpt,
    mainImage,
    category,
    publishedAt
  }`

  try {
    const allPosts = await client.fetch<BlogPost[]>(query)

    const scoredPosts = allPosts.map((post) => {
      const titleLower = post.title.toLowerCase()
      const excerptLower = (post.excerpt || '').toLowerCase()
      let score = 0

      for (const keyword of keywords) {
        if (titleLower.includes(keyword)) score += 2
        if (excerptLower.includes(keyword)) score += 1
      }

      return { post, score }
    })

    return scoredPosts
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.post)
  } catch {
    return []
  }
}

export default async function RelatedBlogPosts({
  tourTitle,
  tourHighlights,
}: RelatedBlogPostsProps) {
  const posts = await getRelatedBlogPosts(tourTitle, tourHighlights)

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
          <h2 className="mt-3 text-3xl font-bold text-stone-900">搭配閱讀這些文章會更有感</h2>
          <p className="mt-3 text-base leading-7 text-stone-600">
            如果你還在比較地點、玩法或清邁旅行細節，這幾篇文章通常會剛好補上你現在在想的問題。
          </p>
        </div>
        <Button href="/blog" variant="outline" size="sm">
          查看全部文章
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
                    {getCategoryName(post.category || '')}
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
                    <p className="text-sm font-medium text-stone-900">先用文章補資訊</p>
                    <p className="mt-1 text-xs text-stone-500">看完再回來比較行程會更快</p>
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
