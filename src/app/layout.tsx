import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: {
    default: '清微旅行 Chiangway Travel | 清邁親子包車自由行',
    template: '%s | 清微旅行',
  },
  description: '清邁親子自由行首選！專業中文導遊、安全舒適包車服務，為您的家庭打造難忘的清邁之旅。',
  keywords: ['清邁親子自由行', '清邁包車', '清邁中文導遊', '清邁家庭旅遊', '清邁親子景點', '清邁自由行', '泰國親子旅遊'],
  authors: [{ name: '清微旅行' }],
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    siteName: '清微旅行 Chiangway Travel',
  },
}

// LocalBusiness Schema for Google rich results
const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': 'https://chiangway.com/#business',
  name: '清微旅行 Chiangway Travel',
  description: '清邁親子自由行首選！台泰夫妻在地經營，專業中文導遊、安全舒適包車服務，為您的家庭打造難忘的清邁之旅。',
  url: 'https://chiangway.com',
  telephone: '+66-63-790-0666',
  email: 'eric19921204@gmail.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Chiang Mai',
    addressCountry: 'TH',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 18.7883,
    longitude: 98.9853,
  },
  areaServed: {
    '@type': 'City',
    name: 'Chiang Mai',
  },
  priceRange: 'NT$ 3,000 - 10,000',
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    opens: '08:00',
    closes: '20:00',
  },
  sameAs: [
    'https://line.me/R/ti/p/@037nyuwk',
    'https://www.facebook.com/profile.php?id=61569067776768',
    'https://www.instagram.com/chiangway_travel',
    'https://www.tiktok.com/@chiangway_travel',
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '5',
    reviewCount: '110',
    bestRating: '5',
    worstRating: '1',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow pt-20">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
