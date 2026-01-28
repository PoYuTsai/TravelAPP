const SITE_URL = 'https://chiangway-travel.com'

interface FAQItem {
  question: string
  answer: string
}

interface ContactPageSchemaProps {
  faqItems: FAQItem[]
}

export default function ContactPageSchema({ faqItems }: ContactPageSchemaProps) {
  // ContactPage schema
  const contactSchema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: '聯繫我們 | 清微旅行',
    description: '透過 LINE 或社群媒體聯繫清微旅行，免費諮詢清邁親子旅遊行程。',
    url: `${SITE_URL}/contact`,
    mainEntity: {
      '@type': 'LocalBusiness',
      name: '清微旅行 Chiangway Travel',
      url: SITE_URL,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Chiang Mai',
        addressCountry: 'TH',
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        availableLanguage: ['Chinese', 'Thai', 'English'],
      },
    },
  }

  // FAQPage schema
  const faqSchema = {
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
  }

  // Note: dangerouslySetInnerHTML is safe here - content is JSON.stringify of our own objects
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  )
}
