const SITE_URL = 'https://chiangway-travel.com'

interface BlogPost {
  title: string
  slug: { current: string }
  excerpt?: string
  publishedAt?: string
}

interface BlogPageSchemaProps {
  postCount: number
  posts?: BlogPost[]
}

export default function BlogPageSchema({ postCount, posts = [] }: BlogPageSchemaProps) {
  // Blog schema with dynamic blogPost list
  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: '清微旅行部落格',
    description: '清邁親子旅遊攻略、景點推薦、美食分享，由住在清邁的台灣人親自撰寫的第一手資訊。',
    url: `${SITE_URL}/blog`,
    blogPost: posts.slice(0, 10).map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: `${SITE_URL}/blog/${post.slug.current}`,
      ...(post.excerpt && { description: post.excerpt }),
      ...(post.publishedAt && { datePublished: post.publishedAt }),
      author: {
        '@type': 'Person',
        name: 'Eric',
      },
    })),
    publisher: {
      '@type': 'Organization',
      name: '清微旅行 Chiangway Travel',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/logo.png`,
      },
    },
    author: {
      '@type': 'Person',
      name: 'Eric',
      url: SITE_URL,
    },
  }

  // CollectionPage schema
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '部落格 | 清邁旅遊攻略',
    description: '清邁親子旅遊攻略、景點推薦、美食分享，由住在清邁的台灣人親自撰寫的第一手資訊。',
    url: `${SITE_URL}/blog`,
    numberOfItems: postCount,
    isPartOf: {
      '@type': 'WebSite',
      name: '清微旅行 Chiangway Travel',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: '清微旅行 Chiangway Travel',
      url: SITE_URL,
    },
  }

  // Note: dangerouslySetInnerHTML is safe here - content is JSON.stringify of our own objects
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
    </>
  )
}
