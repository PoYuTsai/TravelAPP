import Link from 'next/link'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
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

// Get related blog posts based on tour keywords
async function getRelatedBlogPosts(
  tourTitle: string,
  highlights: string[] = []
): Promise<BlogPost[]> {
  // Build search keywords from tour title and highlights
  const keywords = [
    ...tourTitle.split(/[\s,，、]+/).filter((w) => w.length > 1),
    ...highlights,
  ]
    .map((k) => k.toLowerCase())
    .slice(0, 5)

  // Try to find posts matching keywords in title or content
  // If no matches, fall back to recent posts
  const query = `*[_type == "post"][0...6] | order(publishedAt desc) {
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

    // Score posts by keyword matches
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

    // Sort by score (highest first), take top 3
    const sorted = scoredPosts.sort((a, b) => b.score - a.score)
    return sorted.slice(0, 3).map((s) => s.post)
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
    <section className="mt-12 pt-12 border-t border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">相關文章</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Link key={post._id} href={`/blog/${post.slug.current}`} className="group">
            <article className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow h-full flex flex-col">
              <div className="relative aspect-[4/3]">
                {post.mainImage ? (
                  <Image
                    src={urlFor(post.mainImage).width(800).height(600).quality(85).url()}
                    alt={post.mainImage.alt || post.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-primary/50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-primary/20 text-primary-dark px-2 py-0.5 rounded-full font-medium">
                    {getCategoryName(post.category || '')}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {post.title}
                </h3>
                <p className="text-gray-600 text-sm flex-1 line-clamp-2">{post.excerpt}</p>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  )
}
