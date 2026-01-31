import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { client, urlFor } from '@/sanity/client'
import SectionTitle from '@/components/ui/SectionTitle'
import CollectionPageSchema from '@/components/blog/CollectionPageSchema'
import { CATEGORY_NAMES, getCategoryName } from '@/lib/constants'

export const revalidate = 60

// Post type
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

// Valid categories
const VALID_CATEGORIES = Object.keys(CATEGORY_NAMES)

// Generate static params for all categories
export async function generateStaticParams() {
  return VALID_CATEGORIES.map((slug) => ({ slug }))
}

// Generate metadata for each category
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const categoryName = getCategoryName(slug)

  if (!VALID_CATEGORIES.includes(slug)) {
    return { title: '分類不存在' }
  }

  return {
    title: `${categoryName} | 清邁旅遊部落格`,
    description: `清邁${categoryName}相關文章，由住在清邁的台灣人親自撰寫的第一手資訊。`,
    openGraph: {
      title: `${categoryName} | 清邁旅遊部落格`,
      description: `清邁${categoryName}相關文章，在地人的第一手資訊。`,
    },
    alternates: {
      canonical: `https://chiangway-travel.com/blog/category/${slug}`,
    },
  }
}

// Get posts by category
async function getPostsByCategory(category: string): Promise<Post[]> {
  if (!VALID_CATEGORIES.includes(category)) {
    return []
  }

  const query = `*[_type == "post" && category == $category] | order(featured desc, publishedAt desc) {
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
    return await client.fetch<Post[]>(query, { category })
  } catch {
    return []
  }
}

interface CategoryPageProps {
  params: Promise<{ slug: string }>
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params

  // Validate category
  if (!VALID_CATEGORIES.includes(slug)) {
    notFound()
  }

  const posts = await getPostsByCategory(slug)
  const categoryName = getCategoryName(slug)

  return (
    <>
      <CollectionPageSchema
        categoryName={categoryName}
        categorySlug={slug}
        postCount={posts.length}
      />
      <div className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <ol className="flex items-center gap-2 text-gray-500">
            <li>
              <Link href="/" className="hover:text-primary">
                首頁
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/blog" className="hover:text-primary">
                部落格
              </Link>
            </li>
            <li>/</li>
            <li className="text-gray-900 font-medium">{categoryName}</li>
          </ol>
        </nav>

        <SectionTitle
          title={categoryName}
          subtitle={`清邁${categoryName}相關文章`}
        />

        {/* Category navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <Link
            href="/blog"
            className="px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            全部
          </Link>
          {VALID_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/blog/category/${cat}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                cat === slug
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {getCategoryName(cat)}
            </Link>
          ))}
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">
              「{categoryName}」分類暫無文章
            </p>
            <Link href="/blog" className="text-primary hover:underline">
              ← 查看所有文章
            </Link>
          </div>
        ) : (
          <>
            <p className="text-center text-gray-500 mb-8">
              共 {posts.length} 篇文章
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link key={post._id} href={`/blog/${post.slug.current}`} className="group">
                  <article className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow h-full flex flex-col">
                    <div className="relative aspect-[4/3]">
                      {post.mainImage ? (
                        <Image
                          src={urlFor(post.mainImage).width(600).height(450).url()}
                          alt={post.mainImage.alt || post.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                          <span className="text-4xl">📝</span>
                        </div>
                      )}
                      {post.featured && (
                        <div className="absolute top-3 left-3">
                          <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">
                            精選
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs bg-primary/20 text-primary-dark px-2 py-1 rounded-full font-medium">
                          {categoryName}
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
          </>
        )}

          {/* SEO text */}
          <div className="mt-16 text-center">
            <p className="text-gray-500 mb-4">更多清邁{categoryName}資訊持續更新中...</p>
            <Link href="/blog" className="text-primary hover:underline">
              ← 返回部落格首頁
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
