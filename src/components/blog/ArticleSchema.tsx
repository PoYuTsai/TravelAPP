interface ArticleSchemaProps {
  title: string
  description: string
  slug: string
  datePublished: string
  dateModified?: string
  image?: string
}

export default function ArticleSchema({
  title,
  description,
  slug,
  datePublished,
  dateModified,
  image = '/images/hero-bg.jpg',
}: ArticleSchemaProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    image: `https://chiangwaytravel.com${image}`,
    datePublished: datePublished,
    dateModified: dateModified || datePublished,
    author: {
      '@type': 'Organization',
      name: '清微旅行 Chiangway Travel',
      url: 'https://chiangwaytravel.com',
    },
    publisher: {
      '@type': 'Organization',
      name: '清微旅行 Chiangway Travel',
      logo: {
        '@type': 'ImageObject',
        url: 'https://chiangwaytravel.com/images/logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://chiangwaytravel.com/blog/${slug}`,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
