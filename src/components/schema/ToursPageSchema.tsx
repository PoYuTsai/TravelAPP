const SITE_URL = 'https://chiangway-travel.com'

interface Tour {
  title: string
  slug: string
  subtitle?: string
}

interface ToursPageSchemaProps {
  packages: Tour[]
  dayTours: Tour[]
}

export default function ToursPageSchema({ packages, dayTours }: ToursPageSchemaProps) {
  const allTours = [...packages, ...dayTours]

  // ItemList schema for tour listing
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '清微旅行行程案例',
    description: '清邁親子包車行程套餐與一日遊選項',
    url: `${SITE_URL}/tours`,
    numberOfItems: allTours.length,
    itemListElement: allTours.map((tour, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: tour.title,
      url: `${SITE_URL}/tours/${tour.slug}`,
    })),
  }

  // CollectionPage schema
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '行程案例 | 清微旅行',
    description: '超過百組家庭的清邁回憶，每趟旅程都是獨一無二的故事。',
    url: `${SITE_URL}/tours`,
    isPartOf: {
      '@type': 'WebSite',
      name: '清微旅行 Chiangway Travel',
      url: SITE_URL,
    },
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

  // Note: dangerouslySetInnerHTML is safe here - content is JSON.stringify of our own objects
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
    </>
  )
}
