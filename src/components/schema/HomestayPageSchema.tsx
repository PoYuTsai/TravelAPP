const SITE_URL = 'https://chiangway-travel.com'

interface FAQItem {
  question: string
  answer: string
}

interface HomestayPageSchemaProps {
  name: string
  description: string
  faqItems?: FAQItem[]
}

export default function HomestayPageSchema({ name, description, faqItems }: HomestayPageSchemaProps) {
  // LodgingBusiness schema
  const lodgingSchema = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: name,
    description: description,
    url: `${SITE_URL}/homestay`,
    image: `${SITE_URL}/images/og-image.png`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Fang',
      addressRegion: 'Chiang Mai',
      addressCountry: 'TH',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 19.9167,
      longitude: 99.2167,
    },
    priceRange: '$$',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5',
      reviewCount: '134',
    },
    amenityFeature: [
      { '@type': 'LocationFeatureSpecification', name: '免費 WiFi', value: true },
      { '@type': 'LocationFeatureSpecification', name: '免費停車', value: true },
      { '@type': 'LocationFeatureSpecification', name: '接送服務', value: true },
    ],
    containedInPlace: {
      '@type': 'City',
      name: 'Fang District, Chiang Mai',
    },
  }

  // FAQPage schema (if FAQ items provided)
  const faqSchema = faqItems && faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  } : null

  // Note: dangerouslySetInnerHTML is safe here - content is JSON.stringify of our own objects
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(lodgingSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
    </>
  )
}
