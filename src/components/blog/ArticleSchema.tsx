interface ArticleSchemaProps {
  title: string
  description: string
  slug: string
  datePublished: string
  dateModified?: string
  image?: string
}

const SITE_URL = 'https://chiangway.com'

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
    image: `${SITE_URL}${image}`,
    datePublished: datePublished,
    dateModified: dateModified || datePublished,
    author: {
      '@type': 'Organization',
      name: '清微旅行 Chiangway Travel',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: '清微旅行 Chiangway Travel',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/blog/${slug}`,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
