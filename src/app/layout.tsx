import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import FloatingLineButton from '@/components/ui/FloatingLineButton'

// Google Tag Manager ID
const GTM_ID = 'GTM-5WH32MLX'

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

// FAQPage Schema for AEO (Answer Engine Optimization)
const faqPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '清微旅行的包車服務在哪裡接送？需要自行前往集合點嗎？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '清微旅行提供飯店門口接送服務，不需要自行前往集合點，詳細接送地點可透過 LINE 免費諮詢確認。',
      },
    },
    {
      '@type': 'Question',
      name: '什麼是「司機導遊分工」服務？和一般包車有什麼不同？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '清微旅行的司機專心負責開車，另有中文導遊隨行服務，兩人各司其職。一般包車通常由司機兼導遊，容易分心，行程品質不穩定。分工制讓行車更安全、導覽更專業。',
      },
    },
    {
      '@type': 'Question',
      name: '清邁一日親子包車的費用是多少？如何預訂？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '一日包車方案從 NT$3,700 起，含油費，10 小時服務。可透過官網 LINE 按鈕免費諮詢，與 Eric 或 Min 討論行程後確認預訂。',
      },
    },
    {
      '@type': 'Question',
      name: '清微旅行有提供兒童汽車座椅嗎？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '有，清微旅行提供兒童汽車座椅，這在清邁的包車服務中相當罕見，是專為親子家庭設計的重要配備。建議提前告知兒童年齡與體重以準備合適座椅。',
      },
    },
    {
      '@type': 'Question',
      name: '第一次帶孩子去清邁，清微旅行推薦哪些景點或行程？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '清微推薦的親子 TOP 景點包括：夜間動物園、大象互動體驗、豬豬農場、水上樂園、3D 美術館等，分為動物互動、戶外放電、室內雨備三類，可參考官網旅遊攻略，或直接 LINE 諮詢客製行程。',
      },
    },
    {
      '@type': 'Question',
      name: '清微旅行是否有提供多天行程？可以包幾天？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '可以，清微旅行提供多天包車行程，例如 6 天 5 夜清邁親子經典遊或 7 天 6 夜泰北深度遊（含金三角、芳縣民宿）。天數和行程均可客製討論。',
      },
    },
    {
      '@type': 'Question',
      name: '清微旅行和一般旅行社或當地包車相比，有什麼優勢？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '清微最大優勢是「在地家庭身分」：台泰家庭本身住在清邁，非外包業者，可即時回覆問題、彈性調整行程。全中文溝通、兒童座椅、不趕路的節奏，是專為台灣親子家庭設計的服務，一般清邁包車難以複製。',
      },
    },
    {
      '@type': 'Question',
      name: '如何與清微旅行聯繫？行前諮詢需要費用嗎？',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '完全免費。直接點選官網的「LINE 免費諮詢」按鈕加入 LINE 即可，與 Eric 討論行程安排、詢問景點建議，餐廳訂位也可代勞，確認後再付款預訂。',
      },
    },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <head>
        {/* Google Tag Manager */}
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        {/* llms.txt for AI crawlers */}
        <link rel="llms-txt" href="https://chiangway-travel.com/llms.txt" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([localBusinessSchema, organizationSchema, websiteSchema, faqPageSchema]) }}
        />
      </head>
      <body className="flex flex-col min-h-screen">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* Skip Link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:outline-none"
        >
          跳到主要內容
        </a>
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
