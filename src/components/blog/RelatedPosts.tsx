import Link from 'next/link'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
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
  category: string
}

// Get related posts by category (excluding current post)
async function getRelatedPosts(currentPostId: string, category: string): Promise<Post[]> {
  const query = `*[_type == "post" && _id != $currentPostId && category == $category][0...3] | order(publishedAt desc) {
    _id,
    title,
    slug,
    excerpt,
    mainImage,
    category,
    publishedAt
  }`

  try {
    const posts = await client.fetch<Post[]>(query, { currentPostId, category })

    // If not enough posts in same category, get recent posts
    if (posts.length < 3) {
      const moreQuery = `*[_type == "post" && _id != $currentPostId && _id != $existingIds][0...${3 - posts.length}] | order(publishedAt desc) {
        _id,
        title,
        slug,
        excerpt,
        mainImage,
        category,
        publishedAt
      }`
      const existingIds = posts.map((p) => p._id)
      const morePosts = await client.fetch<Post[]>(moreQuery, {
        currentPostId,
        existingIds: existingIds.join(','),
      })
      return [...posts, ...morePosts]
    }

    return posts
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
    <section className="mt-16 pt-12 border-t border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">相關文章</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map((post) => (
          <Link key={post._id} href={`/blog/${post.slug.current}`} className="group">
            <article className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow h-full flex flex-col">
              <div className="relative h-40">
                {post.mainImage ? (
                  <Image
                    src={urlFor(post.mainImage).width(400).height(250).url()}
                    alt={post.mainImage.alt || post.title}
                    fill
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
