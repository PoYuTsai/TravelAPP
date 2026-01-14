import Link from 'next/link'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'

interface Post {
  _id: string
  title: string
  slug: { current: string }
  excerpt: string
  mainImage?: {
    alt?: string
  }
  category: string
}

const categoryNames: Record<string, string> = {
  guide: '攻略',
  attraction: '景點',
  food: '美食',
  accommodation: '住宿',
  transportation: '交通',
  itinerary: '行程',
}

async function getFeaturedPosts(count: number = 3) {
  const query = `*[_type == "post" && featured == true] | order(publishedAt desc)[0...${count}] {
    _id,
    title,
    slug,
    excerpt,
    mainImage,
    category
  }`
  try {
    return await client.fetch(query)
  } catch {
    return []
  }
}

interface FeaturedArticlesProps {
  sectionTitle?: string
  sectionSubtitle?: string
  showCount?: number
  ctaText?: string
  ctaLink?: string
}

export default async function FeaturedArticles({
  sectionTitle = '精選文章',
  sectionSubtitle = '在地爸媽的清邁旅遊攻略',
  showCount = 3,
  ctaText = '查看更多文章',
  ctaLink = '/blog',
}: FeaturedArticlesProps) {
  const posts = await getFeaturedPosts(showCount)

  if (posts.length === 0) {
    return null // Don't render section if no featured posts
  }

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle title={sectionTitle} subtitle={sectionSubtitle} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {posts.map((post: Post) => (
            <Link
              key={post._id}
              href={`/blog/${post.slug.current}`}
              className="group"
            >
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
                <div className="p-5 flex-1 flex flex-col">
                  <span className="text-xs bg-primary/20 text-primary-dark px-2 py-1 rounded-full font-medium w-fit mb-2">
                    {categoryNames[post.category] || post.category}
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-gray-600 text-sm flex-1 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <span className="text-primary text-sm font-medium mt-3 group-hover:underline">
                    閱讀更多 →
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
        <div className="text-center mt-8">
          <Button href={ctaLink} variant="outline">
            {ctaText}
          </Button>
        </div>
      </div>
    </section>
  )
}
