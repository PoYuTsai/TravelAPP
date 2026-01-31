import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import GoogleAdsConversion from '@/components/GoogleAdsConversion'
import FloatingLineButton from '@/components/ui/FloatingLineButton'
import { GA_MEASUREMENT_ID } from '@/lib/constants'

// Viewport 設定（Next.js 14 推薦方式）
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#FFD700',
}

export const metadata: Metadata = {
  title: {
    default: '清微旅行 Chiangway Travel | 清邁親子包車',
    template: '%s | 清微旅行',
  },
  description: '清邁親子包車首選！台灣爸爸 Eric ＋ 泰國媽媽 Min 在地經營，專業中文導遊＋安全舒適包車，客製化親子行程規劃。老虎王國、大象互動、夜間動物園⋯帶孩子玩遍清邁！超過 100 組家庭好評推薦，LINE 免費諮詢。',
  keywords: ['清邁親子自由行', '清邁包車', '清邁中文導遊', '清邁家庭旅遊', '清邁親子景點', '清邁自由行', '泰國親子旅遊'],
  authors: [{ name: '清微旅行' }],
  metadataBase: new URL('https://chiangway-travel.com'),
  // Google Search Console 驗證
  verification: {
    google: 't6ojmkzAh42vwoUXXbPtayrjeZ_ZVNTetV9RvBL9ToI',
  },
  // PWA 設定
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '清微旅行',
  },
  formatDetection: {
    telephone: true,
    email: true,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    siteName: '清微旅行 Chiangway Travel',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: '清微旅行 - 清邁親子包車',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '清微旅行 Chiangway Travel | 清邁親子包車',
    description: '台灣爸爸＋泰國媽媽在地經營，專業中文導遊＋安全舒適包車，客製化親子行程。超過 100 組家庭好評推薦！',
    images: ['/images/og-image.png'],
  },
}

// LocalBusiness Schema for Google rich results
const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': 'https://chiangway-travel.com/#business',
  name: '清微旅行 Chiangway Travel',
  description: '清邁親子包車首選！台灣爸爸 Eric ＋ 泰國媽媽 Min 在地經營，專業中文導遊、安全舒適包車服務，為您的家庭打造難忘的清邁之旅。',
  url: 'https://chiangway-travel.com',
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

// Organization Schema for Google Knowledge Panel
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://chiangway-travel.com/#organization',
  name: '清微旅行 Chiangway Travel',
  url: 'https://chiangway-travel.com',
  logo: 'https://chiangway-travel.com/icons/apple-touch-icon.png',
  description: '清邁親子包車首選，台灣爸爸＋泰國媽媽在地經營',
  sameAs: [
    'https://line.me/R/ti/p/@037nyuwk',
    'https://www.facebook.com/profile.php?id=61569067776768',
    'https://www.instagram.com/chiangway_travel',
    'https://www.tiktok.com/@chiangway_travel',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+66-63-790-0666',
    contactType: 'customer service',
    availableLanguage: ['Chinese', 'Thai', 'English'],
  },
}

// WebSite Schema for site search optimization
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://chiangway-travel.com/#website',
  name: '清微旅行 Chiangway Travel',
  url: 'https://chiangway-travel.com',
  publisher: {
    '@id': 'https://chiangway-travel.com/#organization',
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
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([localBusinessSchema, organizationSchema, websiteSchema]) }}
        />
      </head>
      <body className="flex flex-col min-h-screen">
        {/* Skip Link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:outline-none"
        >
          跳到主要內容
        </a>
        {/* Google Analytics + Google Ads */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        {/* Google Ads Conversion Tracking */}
        <GoogleAdsConversion />
        <Header />
        <main id="main-content" className="flex-grow pt-20">
          {children}
        </main>
        <Footer />
        <FloatingLineButton />
      </body>
    </html>
  )
}
