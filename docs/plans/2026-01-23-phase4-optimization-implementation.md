# Phase 4 Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize landing page to 5 sections, add clickable TrustNumbers, fix tour case dates, add sticky mobile CTA, and restructure /tours page with day tours.

**Architecture:**
- Landing page simplified to Hero → TrustNumbers → WhoWeAre → ToursPreview → CTA
- TrustNumbers links to /tours, Google Maps, /homestay with hover animations
- /tours page shows packages + day tours + cases with load more
- Sticky mobile LINE button on all pages

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, Sanity CMS, Notion API

---

## Task 1: Fix Tour Cases Date Format and Ordering

**Files:**
- Modify: `src/lib/notion/tours.ts:6-54`
- Modify: `src/components/tours/CaseCard.tsx:1-43`

**Step 1: Update TourCase interface**

Modify `src/lib/notion/tours.ts`:

```typescript
export interface TourCase {
  id: string
  name: string
  days: number
  startDate: string  // ISO format: 2026-02-20
  endDate: string | null  // ISO format or null for single day
  status: 'completed' | 'upcoming'
}
```

**Step 2: Update orderToCase function**

Replace the `orderToCase` function in `src/lib/notion/tours.ts`:

```typescript
function orderToCase(order: NotionOrder): TourCase | null {
  if (!order.customerName || !order.travelDate?.start) {
    return null
  }

  const startDate = order.travelDate.start
  const endDate = order.travelDate.end || null
  const now = new Date()
  const start = new Date(startDate)

  // Calculate days
  let days = 1
  if (endDate) {
    const end = new Date(endDate)
    days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  // Determine status
  const status: 'completed' | 'upcoming' = start < now ? 'completed' : 'upcoming'

  return {
    id: order.id,
    name: order.customerName,
    days,
    startDate,
    endDate,
    status,
  }
}
```

**Step 3: Remove sorting in fetchTourCases**

Modify `src/lib/notion/tours.ts` - remove the `.sort()` call:

```typescript
export async function fetchTourCases(
  year: number,
  limit: number = 20,
  offset: number = 0
): Promise<TourCasesResponse> {
  const orders = await fetchNotionOrdersByYear(year)

  // Convert and filter valid cases - NO SORTING, keep Notion order
  const allCases = orders
    .map(orderToCase)
    .filter((c): c is TourCase => c !== null)

  const total = allCases.length
  const cases = allCases.slice(offset, offset + limit)

  const currentYear = new Date().getFullYear()
  const availableYears = [currentYear, currentYear - 1]

  return {
    cases,
    total,
    year,
    availableYears,
  }
}
```

**Step 4: Update CaseCard component**

Replace `src/components/tours/CaseCard.tsx`:

```tsx
// src/components/tours/CaseCard.tsx

interface CaseCardProps {
  name: string
  days: number
  startDate: string
  endDate: string | null
  status: 'completed' | 'upcoming'
}

function formatDate(startDate: string, endDate: string | null): string {
  const start = new Date(startDate)
  const startStr = `${start.getFullYear()}/${start.getMonth() + 1}/${start.getDate()}`

  if (!endDate || startDate === endDate) {
    return startStr
  }

  const end = new Date(endDate)
  // Same year, just show month/day for end
  if (start.getFullYear() === end.getFullYear()) {
    return `${startStr}~${end.getMonth() + 1}/${end.getDate()}`
  }

  return `${startStr}~${end.getFullYear()}/${end.getMonth() + 1}/${end.getDate()}`
}

export default function CaseCard({ name, days, startDate, endDate, status }: CaseCardProps) {
  const isCompleted = status === 'completed'
  const dateDisplay = formatDate(startDate, endDate)

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="text-lg font-semibold text-gray-900">
        {name}
      </div>
      <div className="text-sm text-gray-500 mt-1">
        {days} 天
      </div>
      <div className="text-sm text-gray-400 mt-1">
        {dateDisplay}
      </div>
      <div className={`text-xs mt-2 inline-flex items-center gap-1 ${
        isCompleted ? 'text-gray-400' : 'text-primary'
      }`}>
        {isCompleted ? (
          <>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            已完成
          </>
        ) : (
          <>
            <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            即將出發
          </>
        )}
      </div>
    </div>
  )
}
```

**Step 5: Update ToursPageClient to pass new props**

Modify `src/app/tours/ToursPageClient.tsx` - update the Case interface and CaseCard usage:

```tsx
// Update the Case interface
interface Case {
  id: string
  name: string
  days: number
  startDate: string
  endDate: string | null
  status: 'completed' | 'upcoming'
}

// Update CaseCard usage in the render
<CaseCard
  key={c.id}
  name={c.name}
  days={c.days}
  startDate={c.startDate}
  endDate={c.endDate}
  status={c.status}
/>
```

**Step 6: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add src/lib/notion/tours.ts src/components/tours/CaseCard.tsx src/app/tours/ToursPageClient.tsx
git commit -m "feat: improve case cards with full date format and Notion ordering

- Show full date range (2026/2/20~2/26)
- Remove forced sorting, preserve Notion order
- Update CaseCard props and display

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Sticky Mobile CTA

**Files:**
- Create: `src/components/StickyMobileCTA.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create StickyMobileCTA component**

Create `src/components/StickyMobileCTA.tsx`:

```tsx
// src/components/StickyMobileCTA.tsx
'use client'

export default function StickyMobileCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
      <div className="px-4 py-3 pb-safe">
        <a
          href="https://line.me/R/ti/p/@037nyuwk"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-[#06C755] hover:bg-[#05b34c] text-white font-medium py-3 rounded-full transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          LINE 聊聊
        </a>
      </div>
    </div>
  )
}
```

**Step 2: Add safe-area padding to Tailwind config**

Check if `pb-safe` utility exists. If not, we'll use a fallback. The component uses `pb-safe` which requires adding to globals.css:

Add to `src/app/globals.css` (if not exists):

```css
/* Safe area for mobile devices with notch/home indicator */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

**Step 3: Update layout.tsx**

Modify `src/app/layout.tsx` to include the sticky CTA and add bottom padding:

```tsx
// Add import at top
import StickyMobileCTA from '@/components/StickyMobileCTA'

// In the return, add StickyMobileCTA and padding to main
<body>
  <Header />
  <main className="pb-20 md:pb-0">
    {children}
  </main>
  <Footer />
  <StickyMobileCTA />
</body>
```

**Step 4: Verify on mobile viewport**

Run: `npm run dev`
Test: Open browser devtools, switch to mobile viewport
Expected: Green LINE button fixed at bottom

**Step 5: Commit**

```bash
git add src/components/StickyMobileCTA.tsx src/app/layout.tsx src/app/globals.css
git commit -m "feat: add sticky mobile LINE CTA button

- Fixed bottom position on mobile only
- Green LINE branding
- Safe area padding for notched devices

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Update TrustNumbers with Clickable Items

**Files:**
- Modify: `src/components/sections/TrustNumbers.tsx`

**Step 1: Read current TrustNumbers implementation**

First read the current file to understand the structure.

**Step 2: Rewrite TrustNumbers with clickable items**

Replace `src/components/sections/TrustNumbers.tsx`:

```tsx
// src/components/sections/TrustNumbers.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'

interface TrustItem {
  value: string
  label: string
  href?: string
  external?: boolean
  hoverColor?: string
}

const trustItems: TrustItem[] = [
  {
    value: '114+',
    label: '家庭',
    href: '/tours',
    hoverColor: 'hover:border-primary hover:bg-primary/5',
  },
  {
    value: '5.0',
    label: '',
    href: 'https://g.page/r/CQExample', // Replace with actual Google review link
    external: true,
    hoverColor: 'hover:border-yellow-400 hover:bg-yellow-50',
  },
  {
    value: '在地',
    label: '家庭',
    href: '/homestay',
    hoverColor: 'hover:border-primary hover:bg-primary/5',
  },
]

function AnimatedNumber({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          const step = target / (duration / 16)
          let current = 0
          const timer = setInterval(() => {
            current += step
            if (current >= target) {
              setCount(target)
              clearInterval(timer)
            } else {
              setCount(Math.floor(current))
            }
          }, 16)
        }
      },
      { threshold: 0.5 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [target, duration, hasAnimated])

  return <span ref={ref}>{count}</span>
}

function StarRating() {
  return (
    <span className="flex items-center gap-0.5 text-yellow-500">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  )
}

interface TrustNumbersProps {
  items?: any[]
}

export default function TrustNumbers({ items }: TrustNumbersProps) {
  return (
    <section className="py-8 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-wrap justify-center gap-3">
          {/* 114+ 家庭 */}
          <Link
            href="/tours"
            className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 hover:border-primary hover:bg-primary/5 hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <span className="font-bold text-gray-900">
              <AnimatedNumber target={114} />+
            </span>
            <span className="text-gray-600">家庭</span>
            <svg className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Google 5.0 評價 */}
          <a
            href="https://maps.app.goo.gl/YOUR_GOOGLE_LINK"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 hover:border-yellow-400 hover:bg-yellow-50 hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <StarRating />
            <span className="font-bold text-gray-900">5.0</span>
            <svg className="w-4 h-4 text-gray-400 group-hover:text-yellow-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          {/* 在地家庭 */}
          <Link
            href="/homestay"
            className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 hover:border-primary hover:bg-primary/5 hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <span className="font-bold text-gray-900">在地</span>
            <span className="text-gray-600">家庭</span>
            <svg className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
```

**Step 3: Verify interactions work**

Run: `npm run dev`
Test: Hover over each trust item
Expected: Border color change, shadow appears, arrow moves

**Step 4: Commit**

```bash
git add src/components/sections/TrustNumbers.tsx
git commit -m "feat: make TrustNumbers clickable with hover animations

- 114+ 家庭 → /tours
- 5.0 評價 → Google Maps (external)
- 在地家庭 → /homestay
- Animated number count on scroll
- Hover effects with color transitions

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create WhoWeAre Section

**Files:**
- Create: `src/components/sections/WhoWeAre.tsx`

**Step 1: Create WhoWeAre component**

Create `src/components/sections/WhoWeAre.tsx`:

```tsx
// src/components/sections/WhoWeAre.tsx
import Link from 'next/link'
import Image from 'next/image'

export default function WhoWeAre() {
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-3xl mx-auto px-4 text-center">
        {/* Family Photo Placeholder */}
        <div className="w-28 h-28 mx-auto mb-6 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-4 border-white shadow-lg">
          {/* Replace with actual family photo */}
          <span className="text-4xl">👨‍👩‍👧</span>
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          台灣爸爸 + 泰國媽媽
        </h2>

        {/* Description */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          我們是住在清邁的真實家庭，帶著自己的孩子探索這座城市。
          <br className="hidden md:block" />
          不是旅行社，是用「家人」的心情帶你們玩。
        </p>

        {/* Link to Story */}
        <Link
          href="/blog/eric-story-taiwan-to-chiang-mai"
          className="inline-flex items-center gap-1 text-primary hover:text-primary-dark font-medium transition-colors group"
        >
          閱讀我們的故事
          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </section>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/sections/WhoWeAre.tsx
git commit -m "feat: add WhoWeAre section component

- Family photo placeholder
- Taiwan dad + Thai mom positioning
- Link to migration story

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Simplify Landing Page to 5 Sections

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update page.tsx imports and structure**

Replace `src/app/page.tsx`:

```tsx
// src/app/page.tsx
import { client } from '@/sanity/client'

export const revalidate = 0

import Hero from '@/components/sections/Hero'
import TrustNumbers from '@/components/sections/TrustNumbers'
import WhoWeAre from '@/components/sections/WhoWeAre'
import ToursPreview from '@/components/sections/ToursPreview'
import CTA from '@/components/sections/CTA'

const landingPageQuery = `*[_type == "landingPage"][0]{
  heroBackgroundImage,
  heroTitle,
  heroSubtitle,
  heroDescription,
  heroPrimaryCta,
  heroSecondaryCta,
  ctaTitle,
  ctaDescription,
  ctaPrimaryCta,
  ctaSecondaryCta
}`

async function getLandingPageData() {
  try {
    return await client.fetch(landingPageQuery)
  } catch {
    return null
  }
}

export default async function Home() {
  const data = await getLandingPageData()

  return (
    <>
      <Hero
        backgroundImage={data?.heroBackgroundImage}
        title={data?.heroTitle || '清邁親子自由行，交給在地家庭'}
        subtitle={data?.heroSubtitle || '專為爸媽設計的包車旅程'}
        description={data?.heroDescription}
        primaryCta={data?.heroPrimaryCta || { text: 'LINE 聊聊', url: 'https://line.me/R/ti/p/@037nyuwk' }}
        secondaryCta={data?.heroSecondaryCta}
      />
      <TrustNumbers />
      <WhoWeAre />
      <ToursPreview />
      <CTA
        title={data?.ctaTitle || '每個家庭都不一樣'}
        description={data?.ctaDescription || '聊聊你們的想法，我們幫你規劃'}
        primaryCta={data?.ctaPrimaryCta || { text: 'LINE 聊聊', url: 'https://line.me/R/ti/p/@037nyuwk' }}
        secondaryCta={data?.ctaSecondaryCta}
      />
    </>
  )
}
```

**Step 2: Update ToursPreview section titles**

Modify `src/components/sections/ToursPreview.tsx` to update copy:

```tsx
// Update the SectionTitle in ToursPreview.tsx
<SectionTitle
  title="行程案例"
  subtitle="每一組家庭的專屬清邁回憶"
/>
```

**Step 3: Verify landing page loads**

Run: `npm run dev`
Visit: `http://localhost:3000`
Expected: 5 sections display (Hero, TrustNumbers, WhoWeAre, ToursPreview, CTA)

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: simplify landing page to 5 sections

Removed: Services, HomestaySection, FeaturedArticles, WhyUs
Added: WhoWeAre section
Updated: Default copy for brand positioning

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create DayTourCard Component

**Files:**
- Create: `src/components/tours/DayTourCard.tsx`

**Step 1: Create DayTourCard component**

Create `src/components/tours/DayTourCard.tsx`:

```tsx
// src/components/tours/DayTourCard.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { urlFor } from '@/sanity/client'

interface DayTourCardProps {
  title: string
  slug: string
  location?: string
  coverImage?: any
  highlights?: string[]
  priceRange?: string
}

export default function DayTourCard({
  title,
  slug,
  location = '清邁',
  coverImage,
  highlights,
  priceRange,
}: DayTourCardProps) {
  return (
    <Link
      href={`/tours/${slug}`}
      className="group block bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow border border-gray-100"
    >
      {/* Cover Image */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/10 to-primary/5">
        {coverImage ? (
          <Image
            src={urlFor(coverImage).width(400).height(300).url()}
            alt={coverImage.alt || title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl">🌴</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Location */}
        <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          {location}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-2">
          {title}
        </h3>

        {/* Highlights */}
        {highlights && highlights.length > 0 && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-1">
            {highlights.slice(0, 3).join(' ')}
          </p>
        )}

        {/* Price */}
        {priceRange && (
          <div className="mt-3 text-right">
            <span className="text-primary font-bold">{priceRange}</span>
            <span className="text-gray-400 text-sm"> 起</span>
          </div>
        )}
      </div>
    </Link>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/tours/DayTourCard.tsx
git commit -m "feat: add DayTourCard component for one-day tours

- Compact card design for 2-column grid
- Location tag, highlights, price display
- Hover effects

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Update /tours Page Structure

**Files:**
- Modify: `src/app/tours/page.tsx`
- Modify: `src/app/tours/ToursPageClient.tsx`

**Step 1: Update tours page.tsx**

Modify `src/app/tours/page.tsx`:

```tsx
// src/app/tours/page.tsx
import type { Metadata } from 'next'
import { client } from '@/sanity/client'
import ToursPageClient from './ToursPageClient'

export const metadata: Metadata = {
  title: '行程案例 | 清微旅行',
  description: '清邁親子自由行，交給在地家庭。專為爸媽設計的包車旅程，招牌套餐與一日遊精選。',
}

// Query for signature packages (multi-day)
const packagesQuery = `*[_type == "tourPackage" && duration match "*天*夜*"] | order(order asc) {
  title,
  "slug": slug.current,
  subtitle,
  coverImage,
  duration,
  highlights,
  priceRange
}`

// Query for day tours
const dayToursQuery = `*[_type == "tourPackage" && duration match "*日遊*"] | order(order asc) {
  title,
  "slug": slug.current,
  subtitle,
  coverImage,
  duration,
  highlights,
  priceRange
}`

async function getPackages() {
  try {
    return await client.fetch(packagesQuery)
  } catch {
    return []
  }
}

async function getDayTours() {
  try {
    return await client.fetch(dayToursQuery)
  } catch {
    return []
  }
}

export default async function ToursPage() {
  const [packages, dayTours] = await Promise.all([
    getPackages(),
    getDayTours(),
  ])

  return <ToursPageClient packages={packages} dayTours={dayTours} />
}
```

**Step 2: Rewrite ToursPageClient**

Replace `src/app/tours/ToursPageClient.tsx`:

```tsx
// src/app/tours/ToursPageClient.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TrustNumbers from '@/components/sections/TrustNumbers'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'
import PackageCard from '@/components/tours/PackageCard'
import DayTourCard from '@/components/tours/DayTourCard'
import CaseCard from '@/components/tours/CaseCard'
import YearFilter from '@/components/tours/YearFilter'

interface Package {
  title: string
  slug: string
  subtitle?: string
  coverImage?: any
  duration?: string
  highlights?: string[]
  priceRange?: string
}

interface Case {
  id: string
  name: string
  days: number
  startDate: string
  endDate: string | null
  status: 'completed' | 'upcoming'
}

interface ToursPageClientProps {
  packages: Package[]
  dayTours: Package[]
}

const CASES_PER_PAGE = 10

export default function ToursPageClient({ packages, dayTours }: ToursPageClientProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear, currentYear - 1])
  const [cases, setCases] = useState<Case[]>([])
  const [totalCases, setTotalCases] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Fetch cases when year changes
  useEffect(() => {
    setLoading(true)
    setCases([])

    fetch(`/api/tours/cases?year=${selectedYear}&limit=${CASES_PER_PAGE}`)
      .then((res) => res.json())
      .then((data) => {
        setCases(data.cases || [])
        setTotalCases(data.total || 0)
        if (data.availableYears) {
          setAvailableYears(data.availableYears)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedYear])

  // Load more cases
  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/tours/cases?year=${selectedYear}&limit=${CASES_PER_PAGE}&offset=${cases.length}`
      )
      const data = await res.json()
      setCases((prev) => [...prev, ...(data.cases || [])])
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingMore(false)
    }
  }

  const hasMore = cases.length < totalCases

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/5 to-white py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            清邁親子自由行，交給在地家庭
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            專為爸媽設計的包車旅程
          </p>

          {/* Inline TrustNumbers */}
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/tours#cases"
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 hover:border-primary hover:bg-primary/5 hover:shadow-md transition-all duration-200"
            >
              <span className="font-bold text-gray-900">114+</span>
              <span className="text-gray-600">家庭</span>
              <svg className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Link>

            <a
              href="https://maps.app.goo.gl/YOUR_GOOGLE_LINK"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 hover:border-yellow-400 hover:bg-yellow-50 hover:shadow-md transition-all duration-200"
            >
              <span className="flex text-yellow-500">{'★'.repeat(5)}</span>
              <span className="font-bold text-gray-900">5.0</span>
              <svg className="w-4 h-4 text-gray-400 group-hover:text-yellow-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            <Link
              href="/homestay"
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-gray-200 hover:border-primary hover:bg-primary/5 hover:shadow-md transition-all duration-200"
            >
              <span className="font-bold text-gray-900">在地</span>
              <span className="text-gray-600">家庭</span>
              <svg className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Signature Packages Section */}
        {packages.length > 0 && (
          <section className="mb-16">
            <SectionTitle
              title="給第一次來清邁的你"
              subtitle="我們設計好了，你只要帶孩子來"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.slug}
                  title={pkg.title}
                  slug={pkg.slug}
                  subtitle={pkg.subtitle}
                  coverImage={pkg.coverImage}
                  duration={pkg.duration}
                  highlights={pkg.highlights}
                  priceRange={pkg.priceRange}
                />
              ))}
            </div>
          </section>
        )}

        {/* Day Tours Section */}
        {dayTours.length > 0 && (
          <section className="mb-16">
            <SectionTitle
              title="想自己排行程？"
              subtitle="這些一日遊隨你搭"
            />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {dayTours.map((tour) => (
                <DayTourCard
                  key={tour.slug}
                  title={tour.title}
                  slug={tour.slug}
                  coverImage={tour.coverImage}
                  highlights={tour.highlights}
                  priceRange={tour.priceRange}
                />
              ))}
            </div>
          </section>
        )}

        {/* Past Cases Section */}
        <section className="mb-16" id="cases">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <SectionTitle
              title="最近出發的家庭"
              subtitle="每趟旅程都是獨一無二的故事"
            />
            <YearFilter
              years={availableYears}
              selectedYear={selectedYear}
              onChange={setSelectedYear}
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">載入中...</div>
          ) : cases.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {selectedYear} 年尚無案例
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {cases.map((c) => (
                  <CaseCard
                    key={c.id}
                    name={c.name}
                    days={c.days}
                    startDate={c.startDate}
                    endDate={c.endDate}
                    status={c.status}
                  />
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="text-center mt-8">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 font-medium transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? '載入中...' : '載入更多'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* CTA Section */}
        <section className="text-center bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            每個家庭都不一樣
          </h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            聊聊你們的想法，我們幫你規劃
          </p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external>
            LINE 聊聊
          </Button>
        </section>
      </div>
    </div>
  )
}
```

**Step 3: Update PackageCard to show price**

Modify `src/components/tours/PackageCard.tsx` to add priceRange prop:

```tsx
// Add priceRange to interface
interface PackageCardProps {
  title: string
  slug: string
  subtitle?: string
  coverImage?: any
  duration?: string
  highlights?: string[]
  priceRange?: string  // Add this
}

// Add priceRange to component
export default function PackageCard({
  title,
  slug,
  subtitle,
  coverImage,
  duration,
  highlights,
  priceRange,  // Add this
}: PackageCardProps) {

// Add price display before CTA
{priceRange && (
  <div className="mt-4 text-right">
    <span className="text-primary font-bold text-lg">{priceRange}</span>
    <span className="text-gray-400 text-sm"> 起</span>
  </div>
)}
```

**Step 4: Verify build and page**

Run: `npm run build`
Expected: Build succeeds

Run: `npm run dev`
Visit: `http://localhost:3000/tours`
Expected: New page structure with hero, packages, day tours, cases

**Step 5: Commit**

```bash
git add src/app/tours/page.tsx src/app/tours/ToursPageClient.tsx src/components/tours/PackageCard.tsx
git commit -m "feat: restructure /tours page with new sections

- Hero with inline TrustNumbers
- Signature packages section
- Day tours section (2-column grid)
- Past cases with load more
- Updated copy for brand positioning

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Final Verification

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Test all pages**

Run: `npm run dev`

Test checklist:
- [ ] Landing page: 5 sections load correctly
- [ ] TrustNumbers: All 3 items clickable, hover effects work
- [ ] WhoWeAre: Link to blog story works
- [ ] ToursPreview: Shows packages (if any in Sanity)
- [ ] /tours page: Hero, packages, day tours, cases sections
- [ ] /tours cases: Date format shows `2026/2/20~2/26`
- [ ] /tours cases: Load more works
- [ ] Mobile: Sticky LINE button visible at bottom
- [ ] Mobile: Button doesn't overlap content

**Step 3: Test mobile viewport**

Open devtools → Toggle device toolbar → iPhone 12 Pro

Check:
- [ ] Sticky CTA visible and clickable
- [ ] Content not hidden behind sticky CTA
- [ ] TrustNumbers wrap properly
- [ ] Cards display correctly in grid

**Step 4: Commit any fixes**

If any issues found, fix and commit.

**Step 5: Final commit**

```bash
git add .
git commit -m "chore: Phase 4 optimization complete

- Landing page simplified to 5 sections
- TrustNumbers clickable with animations
- WhoWeAre section added
- /tours page restructured
- Case cards show full dates
- Sticky mobile LINE CTA added

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Fix case dates and ordering | tours.ts, CaseCard.tsx |
| 2 | Sticky mobile CTA | StickyMobileCTA.tsx, layout.tsx |
| 3 | Clickable TrustNumbers | TrustNumbers.tsx |
| 4 | WhoWeAre section | WhoWeAre.tsx |
| 5 | Simplify landing page | page.tsx |
| 6 | DayTourCard component | DayTourCard.tsx |
| 7 | Restructure /tours | tours/page.tsx, ToursPageClient.tsx |
| 8 | Final verification | - |

---

*Plan created: 2026-01-23*
