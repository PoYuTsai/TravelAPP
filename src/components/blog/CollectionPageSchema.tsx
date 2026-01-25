interface CollectionPageSchemaProps {
  categoryName: string
  categorySlug: string
  postCount: number
}

const SITE_URL = 'https://chiangway-travel.com'

export default function CollectionPageSchema({
  categoryName,
  categorySlug,
  postCount,
}: CollectionPageSchemaProps) {
  // CollectionPage schema
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${categoryName} | 清邁旅遊部落格`,
    description: `清邁${categoryName}相關文章，由住在清邁的台灣人親自撰寫的第一手資訊。`,
    url: `${SITE_URL}/blog/category/${categorySlug}`,
    isPartOf: {
      '@type': 'Blog',
      name: '清微旅行部落格',
      url: `${SITE_URL}/blog`,
    },
    numberOfItems: postCount,
    publisher: {
      '@type': 'Organization',
      name: '清微旅行 Chiangway Travel',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/logo.png`,
      },
    },
  }

  // BreadcrumbList schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '首頁',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '部落格',
        item: `${SITE_URL}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: categoryName,
        item: `${SITE_URL}/blog/category/${categorySlug}`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  )
}
