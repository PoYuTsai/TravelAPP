# Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Phase 1 website redesign based on the v3.0 spec, focusing on landing page conversion optimization and content foundation.

**Architecture:** Server-side rendered Next.js 14 pages with Sanity CMS for content management. Static sections initially, then migrate to CMS-driven content.

**Tech Stack:** Next.js 14, Sanity CMS, Tailwind CSS 4, TypeScript

---

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| Landing Page | ✅ Exists | Needs redesign per spec |
| Header | ✅ Exists | Needs active state |
| Footer | ✅ Exists | OK |
| LINE Float Button | ✅ Exists | OK |
| Blog System | ✅ Exists | OK |
| Services Page | ❌ Missing | New |
| Homestay Page | ❌ Missing | New |
| siteSettings CMS | ❌ Missing | New |
| 404 Page | ❌ Missing | New |

---

## Phase 1A: Core Conversion Pages

### Task 1: Update Hero Section

**Files:**
- Modify: `src/components/sections/Hero.tsx`

**Step 1: Update Hero copy and structure**

```tsx
// src/components/sections/Hero.tsx
import Image from 'next/image'
import Button from '@/components/ui/Button'

export default function Hero() {
  return (
    <section className="relative">
      {/* Hero Image */}
      <div className="relative w-full aspect-[21/9]">
        <Image
          src="/images/hero-bg.png"
          alt="清微旅行 - 清邁親子包車自由行"
          fill
          className="object-cover object-top"
          priority
        />
      </div>

      {/* CTA Section */}
      <div className="bg-white py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
            清邁親子自由行
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-2">
            在地家庭經營，專為爸媽設計的旅程
          </p>
          <p className="text-base text-gray-500 mb-6">
            Eric & Min，住在清邁的台泰夫妻，我們也有女兒，懂爸媽帶小孩出遊的需求
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
              LINE 免費諮詢
            </Button>
            <Button href="/services/car-charter" variant="outline" size="lg">
              瀏覽服務
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Verify**

Run: `npm run dev`
Check: http://localhost:3000 shows updated Hero

**Step 3: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "feat: update Hero section with new copy per spec"
```

---

### Task 2: Add Trust Numbers Section

**Files:**
- Create: `src/components/sections/TrustNumbers.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create TrustNumbers component**

```tsx
// src/components/sections/TrustNumbers.tsx
const stats = [
  { value: '110+', label: '服務家庭' },
  { value: '⭐⭐⭐⭐⭐', label: 'Google 五星好評' },
  { value: '2024', label: '創立年份' },
]

export default function TrustNumbers() {
  return (
    <section className="py-8 bg-gray-50 border-y border-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
          {stats.map((stat) => (
            <a
              key={stat.label}
              href={stat.label === 'Google 五星好評' ? 'https://g.co/kgs/1bUJyoG' : undefined}
              target={stat.label === 'Google 五星好評' ? '_blank' : undefined}
              rel={stat.label === 'Google 五星好評' ? 'noopener noreferrer' : undefined}
              className={`text-center ${stat.label === 'Google 五星好評' ? 'hover:opacity-80 cursor-pointer' : ''}`}
            >
              <div className="text-2xl md:text-3xl font-bold text-gray-900">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Add to page.tsx**

```tsx
// src/app/page.tsx
import Hero from '@/components/sections/Hero'
import TrustNumbers from '@/components/sections/TrustNumbers'
import Services from '@/components/sections/Services'
import WhyUs from '@/components/sections/WhyUs'
import CTA from '@/components/sections/CTA'

export default function Home() {
  return (
    <>
      <Hero />
      <TrustNumbers />
      <Services />
      <WhyUs />
      <CTA />
    </>
  )
}
```

**Step 3: Verify**

Run: `npm run dev`
Check: Trust numbers appear between Hero and Services

**Step 4: Commit**

```bash
git add src/components/sections/TrustNumbers.tsx src/app/page.tsx
git commit -m "feat: add TrustNumbers section with stats"
```

---

### Task 3: Update Services Section

**Files:**
- Modify: `src/components/sections/Services.tsx`

**Step 1: Update to 2 service cards with price**

```tsx
// src/components/sections/Services.tsx
import Image from 'next/image'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'

const services = [
  {
    image: '/images/service-car.jpg', // placeholder, will be replaced
    title: '親子包車服務',
    features: [
      '專屬司機 + 中文導遊',
      '兒童安全座椅',
      '行程彈性不趕路',
      '接機 / 送機服務',
    ],
    price: '每日 NT$ 3,500 起',
    cta: { text: '了解包車服務', href: '/services/car-charter' },
  },
  {
    image: '/images/service-homestay.jpg', // placeholder
    title: '芳縣特色民宿',
    subtitle: 'Huen San Fang Hotel',
    features: [
      '遠離觀光區的寧靜',
      '體驗泰北在地生活',
      '適合長住深度旅遊',
      '民宿主人親自接待',
    ],
    cta: { text: '了解民宿', href: '/homestay' },
  },
]

export default function Services() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="我們的服務"
          subtitle="包車 + 住宿，一站式親子旅遊體驗"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map((service) => (
            <div
              key={service.title}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              {/* Image placeholder */}
              <div className="relative h-48 md:h-56 bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center">
                <span className="text-6xl">
                  {service.title.includes('包車') ? '🚐' : '🏠'}
                </span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {service.title}
                </h3>
                {service.subtitle && (
                  <p className="text-sm text-gray-500 mb-4">{service.subtitle}</p>
                )}
                <ul className="space-y-2 mb-4">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-gray-600">
                      <span className="text-primary mt-0.5">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {service.price && (
                  <p className="text-lg font-bold text-primary mb-4">
                    {service.price}
                  </p>
                )}
                <Button href={service.cta.href} variant="outline" className="w-full">
                  {service.cta.text}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Verify**

Run: `npm run dev`
Check: Services section shows 2 cards with features and price

**Step 3: Commit**

```bash
git add src/components/sections/Services.tsx
git commit -m "feat: update Services section with 2 cards and pricing"
```

---

### Task 4: Update WhyUs Section

**Files:**
- Modify: `src/components/sections/WhyUs.tsx`

**Step 1: Update content per spec**

```tsx
// src/components/sections/WhyUs.tsx
import SectionTitle from '@/components/ui/SectionTitle'

const reasons = [
  {
    icon: '🏠',
    title: '在地家庭經營',
    description: '不是旅行社，是住在清邁的真實家庭。台灣爸爸 + 泰國媽媽，給您最真實的在地體驗。',
  },
  {
    icon: '👶',
    title: '自己也是爸媽',
    description: '我們有女兒，懂帶小孩出遊的眉角。行程節奏、休息時間、用餐地點，都從爸媽角度思考。',
  },
  {
    icon: '🚐',
    title: '司機導遊分工',
    description: '專業分工，司機專心開車，導遊專心服務。不是中文司機一人包辦，服務品質更好。',
  },
  {
    icon: '✨',
    title: '客製化行程',
    description: '根據孩子年齡、體力量身打造。不跑固定路線，不趕行程，玩得輕鬆才是真的玩。',
  },
]

export default function WhyUs() {
  return (
    <section className="py-16 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="為什麼選擇清微旅行"
          subtitle="不只是包車，更是您在清邁的家人"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="flex gap-4 p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="text-4xl flex-shrink-0">{reason.icon}</div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {reason.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {reason.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Verify**

Run: `npm run dev`
Check: WhyUs section shows updated content

**Step 3: Commit**

```bash
git add src/components/sections/WhyUs.tsx
git commit -m "feat: update WhyUs section with spec content"
```

---

### Task 5: Add Featured Articles Section

**Files:**
- Create: `src/components/sections/FeaturedArticles.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create FeaturedArticles component**

```tsx
// src/components/sections/FeaturedArticles.tsx
import Link from 'next/link'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'

const featuredQuery = `*[_type == "post" && featured == true] | order(publishedAt desc)[0...3] {
  _id,
  title,
  slug,
  excerpt,
  mainImage,
  category
}`

const categoryNames: Record<string, string> = {
  guide: '攻略',
  attraction: '景點',
  food: '美食',
  accommodation: '住宿',
  transportation: '交通',
  itinerary: '行程',
}

async function getFeaturedPosts() {
  try {
    return await client.fetch(featuredQuery)
  } catch {
    return []
  }
}

export default async function FeaturedArticles() {
  const posts = await getFeaturedPosts()

  if (posts.length === 0) {
    return null // Don't render section if no featured posts
  }

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="精選文章"
          subtitle="在地爸媽的清邁旅遊攻略"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {posts.map((post: any) => (
            <Link
              key={post._id}
              href={`/blog/${post.slug.current}`}
              className="group"
            >
              <article className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow h-full flex flex-col">
                <div className="relative h-48">
                  {post.mainImage ? (
                    <Image
                      src={urlFor(post.mainImage).width(600).height(400).url()}
                      alt={post.mainImage.alt || post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                      <span className="text-4xl">📝</span>
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <span className="text-xs bg-primary/20 text-primary-dark px-2 py-1 rounded-full font-medium w-fit mb-2">
                    {categoryNames[post.category] || post.category}
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-gray-600 text-sm flex-1 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <span className="text-primary text-sm font-medium mt-3 group-hover:underline">
                    閱讀更多 →
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
        <div className="text-center mt-8">
          <Button href="/blog" variant="outline">
            查看更多文章
          </Button>
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Update page.tsx**

```tsx
// src/app/page.tsx
import Hero from '@/components/sections/Hero'
import TrustNumbers from '@/components/sections/TrustNumbers'
import Services from '@/components/sections/Services'
import WhyUs from '@/components/sections/WhyUs'
import FeaturedArticles from '@/components/sections/FeaturedArticles'
import CTA from '@/components/sections/CTA'

export default function Home() {
  return (
    <>
      <Hero />
      <TrustNumbers />
      <Services />
      <WhyUs />
      <FeaturedArticles />
      <CTA />
    </>
  )
}
```

**Step 3: Verify**

Run: `npm run dev`
Check: Featured articles appear (or section hidden if no featured posts)

**Step 4: Commit**

```bash
git add src/components/sections/FeaturedArticles.tsx src/app/page.tsx
git commit -m "feat: add FeaturedArticles section to landing page"
```

---

### Task 6: Update Final CTA Section

**Files:**
- Modify: `src/components/sections/CTA.tsx`

**Step 1: Update CTA content**

```tsx
// src/components/sections/CTA.tsx
import Button from '@/components/ui/Button'

export default function CTA() {
  return (
    <section className="py-16 md:py-20 bg-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
          準備好帶孩子來清邁了嗎？
        </h2>
        <p className="text-lg md:text-xl text-gray-800 mb-8">
          免費諮詢，讓在地爸媽幫你規劃最適合的親子行程
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button href="https://line.me/R/ti/p/@037nyuwk" external variant="secondary" size="lg">
            LINE 免費諮詢
          </Button>
          <Button href="/services/car-charter" variant="outline" size="lg">
            瀏覽服務內容
          </Button>
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Verify & Commit**

```bash
git add src/components/sections/CTA.tsx
git commit -m "feat: update CTA section with spec copy"
```

---

### Task 7: Create Services Page (Car Charter)

**Files:**
- Create: `src/app/services/car-charter/page.tsx`

**Step 1: Create services directory and page**

```tsx
// src/app/services/car-charter/page.tsx
import type { Metadata } from 'next'
import Image from 'next/image'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'

export const metadata: Metadata = {
  title: '清邁親子包車服務 | 清微旅行',
  description: '專為親子家庭設計的清邁包車服務。司機導遊專業分工，兒童安全座椅，行程彈性不趕路。每日 NT$ 3,500 起。',
}

const features = [
  {
    icon: '🚐',
    title: '舒適車輛',
    description: '寬敞 SUV 或 Van，空間充足放行李和嬰兒車',
  },
  {
    icon: '👨‍✈️',
    title: '司機 + 導遊分工',
    description: '司機專心開車，導遊專心服務，不是一人包辦',
  },
  {
    icon: '🧒',
    title: '兒童安全座椅',
    description: '提供各年齡適用的安全座椅，事先告知即可準備',
  },
  {
    icon: '🗓️',
    title: '行程彈性',
    description: '不跑固定路線，依孩子狀況隨時調整，不趕路',
  },
  {
    icon: '✈️',
    title: '接送機服務',
    description: '機場接送，讓你一落地就開始輕鬆旅程',
  },
  {
    icon: '💬',
    title: '全程中文',
    description: '從諮詢到結束都用中文，溝通無障礙',
  },
]

const pricingTiers = [
  { duration: '半日（4小時）', price: 'NT$ 2,000 起' },
  { duration: '一日（8小時）', price: 'NT$ 3,500 起' },
  { duration: '機場接送（單程）', price: 'NT$ 800 起' },
]

const faqs = [
  {
    q: '價格包含什麼？',
    a: '包含車輛、司機、油資、過路費。導遊服務另計，依行程複雜度報價。',
  },
  {
    q: '可以帶嬰兒車嗎？',
    a: '可以，我們的車輛空間充足。請事先告知，我們會確保有足夠空間。',
  },
  {
    q: '安全座椅怎麼安排？',
    a: '請告知孩子年齡和體重，我們會準備適合的安全座椅，免費提供。',
  },
  {
    q: '可以客製行程嗎？',
    a: '當然可以，這是我們的特色。告訴我們想去的地方、孩子年齡，我們幫你規劃。',
  },
  {
    q: '怎麼預訂？',
    a: '透過 LINE 聯繫我們，討論需求後會提供報價，確認後付訂金即可。',
  },
]

export default function CarCharterPage() {
  return (
    <div className="py-12 md:py-20">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            清邁親子包車服務
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            司機導遊專業分工，兒童安全座椅準備好，行程彈性不趕路。
            <br />
            讓在地爸媽帶你玩清邁。
          </p>
        </div>
        <div className="flex justify-center gap-4">
          <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
            LINE 免費諮詢
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle title="服務特色" subtitle="專為親子家庭設計" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white p-6 rounded-xl shadow-sm"
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle title="參考價格" subtitle="實際報價依行程內容調整" />
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-gray-900 font-bold">
                    服務項目
                  </th>
                  <th className="px-6 py-4 text-right text-gray-900 font-bold">
                    參考價格
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pricingTiers.map((tier) => (
                  <tr key={tier.duration}>
                    <td className="px-6 py-4 text-gray-700">{tier.duration}</td>
                    <td className="px-6 py-4 text-right font-bold text-primary">
                      {tier.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-4 bg-primary-light text-sm text-gray-700">
              💡 以上為參考價格，實際報價會根據人數、車型、行程內容調整。歡迎 LINE 詢問！
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle title="常見問題" />
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="font-bold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            準備好預訂了嗎？
          </h2>
          <p className="text-gray-600 mb-6">
            告訴我們你的旅行日期和需求，我們會盡快回覆報價
          </p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
            LINE 免費諮詢
          </Button>
        </div>
      </section>
    </div>
  )
}
```

**Step 2: Verify**

Run: `npm run dev`
Visit: http://localhost:3000/services/car-charter

**Step 3: Commit**

```bash
git add src/app/services/car-charter/page.tsx
git commit -m "feat: add car charter services page with pricing and FAQ"
```

---

## Phase 1B: Content Foundation

### Task 8: Add Header Active State

**Files:**
- Modify: `src/components/Header.tsx`

**Step 1: Add usePathname and active state styling**

Add to Header.tsx imports:
```tsx
import { usePathname } from 'next/navigation'
```

Add inside component:
```tsx
const pathname = usePathname()
```

Update nav link className:
```tsx
className={`transition-colors font-medium ${
  pathname === link.href
    ? 'text-primary'
    : 'text-gray-600 hover:text-primary'
}`}
```

**Step 2: Verify**

Navigate between pages, active link should be highlighted

**Step 3: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: add active state to header navigation"
```

---

## Phase 1C: Enhancement

### Task 9: Create 404 Page

**Files:**
- Create: `src/app/not-found.tsx`

**Step 1: Create not-found page**

```tsx
// src/app/not-found.tsx
import Link from 'next/link'
import Button from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-20">
      <div className="text-center px-4">
        <div className="text-8xl mb-6">🗺️</div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          找不到這個頁面
        </h1>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          看起來你迷路了！沒關係，讓我們帶你回到正確的地方。
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button href="/">回首頁</Button>
          <Button href="/blog" variant="outline">
            看看部落格
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify**

Visit: http://localhost:3000/random-page-that-doesnt-exist

**Step 3: Commit**

```bash
git add src/app/not-found.tsx
git commit -m "feat: add branded 404 page"
```

---

### Task 10: Create Homestay Page

**Files:**
- Create: `src/app/homestay/page.tsx`

**Step 1: Create homestay page**

```tsx
// src/app/homestay/page.tsx
import type { Metadata } from 'next'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'

export const metadata: Metadata = {
  title: '芳縣特色民宿 | Huen San Fang Hotel | 清微旅行',
  description: '遠離觀光區的寧靜民宿，體驗泰北在地生活。適合長住深度旅遊，民宿主人親自接待。',
}

const features = [
  {
    icon: '🌿',
    title: '遠離觀光區',
    description: '位於芳縣，享受真正的泰北寧靜',
  },
  {
    icon: '🏡',
    title: '在地生活體驗',
    description: '不只是住宿，更是體驗當地人的日常',
  },
  {
    icon: '👨‍👩‍👧',
    title: '民宿主人接待',
    description: '我們親自接待，有問題隨時找得到人',
  },
  {
    icon: '🚐',
    title: '包車搭配',
    description: '搭配包車服務，交通接送都安排好',
  },
]

export default function HomestayPage() {
  return (
    <div className="py-12 md:py-20">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="text-center mb-8">
          <p className="text-primary font-medium mb-2">Huen San Fang Hotel</p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            芳縣特色民宿
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            遠離觀光客的喧囂，在清邁芳縣體驗真正的泰北生活。
            <br />
            我們自己住這裡，也邀請你來住。
          </p>
        </div>

        {/* Placeholder for images */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-square bg-gradient-to-br from-primary-light to-primary/20 rounded-xl flex items-center justify-center"
            >
              <span className="text-4xl">🏠</span>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
            LINE 詢問房況
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle title="民宿特色" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white p-6 rounded-xl shadow-sm text-center"
              >
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle title="位置" subtitle="芳縣 Fang District" />
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <p className="text-gray-600 mb-4">
              芳縣位於清邁北方約 150 公里，車程約 2.5 小時。這裡遠離觀光區，
              是真正的泰北農村生活。適合想要深度體驗、長住的旅客。
            </p>
            <p className="text-gray-600">
              我們可以安排從清邁市區的接送，搭配包車行程，交通完全不用擔心。
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            想來住住看嗎？
          </h2>
          <p className="text-gray-800 mb-6">
            告訴我們你的旅行日期，我們幫你安排
          </p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external variant="secondary" size="lg">
            LINE 詢問房況
          </Button>
        </div>
      </section>
    </div>
  )
}
```

**Step 2: Verify**

Visit: http://localhost:3000/homestay

**Step 3: Commit**

```bash
git add src/app/homestay/page.tsx
git commit -m "feat: add homestay page for Huen San Fang Hotel"
```

---

### Task 11: Add Focus Styles Globally

**Files:**
- Modify: `src/app/globals.css` (or create if not exists)

**Step 1: Add focus visible styles**

Add to globals.css:
```css
/* Focus styles for accessibility */
*:focus-visible {
  outline: 2px solid #F7C009;
  outline-offset: 2px;
}

button:focus-visible,
a:focus-visible {
  outline: 2px solid #F7C009;
  outline-offset: 2px;
  border-radius: 4px;
}
```

**Step 2: Verify**

Tab through the page, focus ring should be visible

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add focus-visible styles for accessibility"
```

---

## Summary

| Phase | Task | Description |
|-------|------|-------------|
| 1A | 1-7 | Landing page redesign + Services page |
| 1B | 8 | Header active state |
| 1C | 9-11 | 404 page, Homestay page, Focus styles |

**Total: 11 Tasks**

After completing all tasks:
1. Run `npm run build` to verify no build errors
2. Test all pages manually
3. Create PR or merge to main

---

## Next Steps (Not in this plan)

- Add siteSettings CMS schema (make landing page content editable)
- Update About page
- Add image blur placeholders
- Add LocalBusiness schema markup for SEO
