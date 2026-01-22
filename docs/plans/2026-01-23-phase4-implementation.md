# Phase 4: Tours Showcase Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a tours showcase system to replace Rezio, displaying signature packages (Sanity) + past cases (Notion API), all driving to LINE consultation.

**Architecture:**
- Signature packages stored in Sanity CMS with rich content (2-3 packages, manually curated)
- Past cases fetched from existing Notion database via API (114+ cases, auto-synced)
- Year filter for past cases, pagination support
- New `/tours` list page and `/tours/[slug]` detail page

**Tech Stack:** Next.js 14 App Router, Sanity CMS, Notion REST API, Tailwind CSS, TypeScript

---

## Task 1: Create tourPackage Sanity Schema

**Files:**
- Create: `src/sanity/schemas/tourPackage.ts`
- Modify: `src/sanity/schemas/index.ts:1-8`

**Step 1: Create the tourPackage schema file**

```typescript
// src/sanity/schemas/tourPackage.ts
import { defineType, defineField, defineArrayMember } from 'sanity'

export default defineType({
  name: 'tourPackage',
  title: '招牌套餐',
  type: 'document',
  groups: [
    { name: 'basic', title: '基本資訊', default: true },
    { name: 'content', title: '行程內容' },
    { name: 'pricing', title: '價格資訊' },
  ],
  fields: [
    // === 基本資訊 ===
    defineField({
      name: 'title',
      title: '套餐名稱',
      type: 'string',
      group: 'basic',
      description: '例：親子經典清邁 5 天 4 夜',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: '網址代碼',
      type: 'slug',
      group: 'basic',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'subtitle',
      title: '副標題',
      type: 'string',
      group: 'basic',
      description: '例：適合第一次來清邁的親子家庭',
    }),
    defineField({
      name: 'coverImage',
      title: '封面圖',
      type: 'image',
      group: 'basic',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: '圖片描述',
          type: 'string',
        }),
      ],
    }),
    defineField({
      name: 'duration',
      title: '天數',
      type: 'string',
      group: 'basic',
      description: '例：5天4夜',
    }),
    defineField({
      name: 'highlights',
      title: '亮點標籤',
      type: 'array',
      group: 'basic',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: '例：大象保護營、夜間動物園',
    }),
    defineField({
      name: 'order',
      title: '排序',
      type: 'number',
      group: 'basic',
      initialValue: 0,
    }),

    // === 行程內容 ===
    defineField({
      name: 'suitableFor',
      title: '這趟旅程適合你，如果...',
      type: 'array',
      group: 'content',
      of: [{ type: 'string' }],
      description: '列出適合的客群特點',
    }),
    defineField({
      name: 'dailySchedule',
      title: '每日行程',
      type: 'array',
      group: 'content',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'day',
              title: '第幾天',
              type: 'number',
            }),
            defineField({
              name: 'emoji',
              title: 'Emoji',
              type: 'string',
              description: '例：✈️ 🐘 🏛️',
            }),
            defineField({
              name: 'title',
              title: '標題',
              type: 'string',
              description: '例：抵達清邁・輕鬆適應',
            }),
            defineField({
              name: 'activities',
              title: '活動內容',
              type: 'text',
              rows: 2,
              description: '例：接機 → 飯店 Check-in → 尼曼區晚餐',
            }),
          ],
          preview: {
            select: { day: 'day', title: 'title', emoji: 'emoji' },
            prepare: ({ day, title, emoji }) => ({
              title: `Day ${day}: ${title}`,
              subtitle: emoji,
            }),
          },
        }),
      ],
    }),
    defineField({
      name: 'includes',
      title: '費用包含',
      type: 'array',
      group: 'content',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'excludes',
      title: '費用不含',
      type: 'array',
      group: 'content',
      of: [{ type: 'string' }],
    }),

    // === 價格資訊 ===
    defineField({
      name: 'priceRange',
      title: '價格範圍',
      type: 'string',
      group: 'pricing',
      description: '例：NT$ 16,000 - 20,000 起',
    }),
    defineField({
      name: 'priceNote',
      title: '價格說明',
      type: 'string',
      group: 'pricing',
      description: '例：依人數、車型、導遊天數調整',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'duration',
      media: 'coverImage',
    },
  },
  orderings: [
    {
      title: '排序',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
  ],
})
```

**Step 2: Register the schema in index.ts**

Modify `src/sanity/schemas/index.ts`:

```typescript
import post from './post'
import tour from './tour'
import landingPage from './landingPage'
import carCharter from './carCharter'
import homestay from './homestay'
import itinerary from './itinerary'
import tourPackage from './tourPackage'

export const schemaTypes = [post, tour, landingPage, carCharter, homestay, itinerary, tourPackage]
```

**Step 3: Verify schema loads**

Run: `npm run dev`
Expected: Sanity Studio loads without errors, "招牌套餐" appears in content types

**Step 4: Commit**

```bash
git add src/sanity/schemas/tourPackage.ts src/sanity/schemas/index.ts
git commit -m "$(cat <<'EOF'
feat: add tourPackage schema for signature tour packages

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create Tours Cases API (Notion Integration)

**Files:**
- Create: `src/app/api/tours/cases/route.ts`
- Create: `src/lib/notion/tours.ts`

**Step 1: Create the tours helper in notion lib**

```typescript
// src/lib/notion/tours.ts

import type { NotionOrder } from './types'
import { fetchNotionOrdersByYear } from './client'

export interface TourCase {
  id: string
  name: string
  month: string
  days: number
  status: 'completed' | 'upcoming'
}

export interface TourCasesResponse {
  cases: TourCase[]
  total: number
  year: number
  availableYears: number[]
}

/**
 * 從 Notion 訂單轉換為行程案例（公開顯示用）
 */
function orderToCase(order: NotionOrder): TourCase | null {
  if (!order.customerName || !order.travelDate?.start) {
    return null
  }

  const startDate = new Date(order.travelDate.start)
  const now = new Date()

  // 計算天數
  let days = 1
  if (order.travelDate.end) {
    const endDate = new Date(order.travelDate.end)
    days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  // 判斷狀態
  const status: 'completed' | 'upcoming' = startDate < now ? 'completed' : 'upcoming'

  // 格式化月份
  const year = startDate.getFullYear()
  const month = startDate.getMonth() + 1
  const monthStr = `${year}/${month}`

  return {
    id: order.id,
    name: order.customerName,
    month: monthStr,
    days,
    status,
  }
}

/**
 * 取得指定年份的行程案例（公開 API 用）
 */
export async function fetchTourCases(
  year: number,
  limit: number = 20,
  offset: number = 0
): Promise<TourCasesResponse> {
  const orders = await fetchNotionOrdersByYear(year)

  // 轉換並過濾有效案例
  const allCases = orders
    .map(orderToCase)
    .filter((c): c is TourCase => c !== null)
    // 按日期排序（新的在前）
    .sort((a, b) => {
      const dateA = new Date(a.month.replace('/', '-') + '-01')
      const dateB = new Date(b.month.replace('/', '-') + '-01')
      return dateB.getTime() - dateA.getTime()
    })

  const total = allCases.length
  const cases = allCases.slice(offset, offset + limit)

  // 動態計算可用年份（當前年 + 前一年）
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

**Step 2: Update notion index to export tours**

Modify `src/lib/notion/index.ts`:

```typescript
// src/lib/notion/index.ts

export * from './types'
export * from './profit-parser'
export * from './client'
export * from './tours'
```

**Step 3: Create the API route**

```typescript
// src/app/api/tours/cases/route.ts

import { NextResponse } from 'next/server'
import { fetchTourCases } from '@/lib/notion'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')

    const currentYear = new Date().getFullYear()
    const year = yearParam ? parseInt(yearParam, 10) : currentYear
    const limit = limitParam ? parseInt(limitParam, 10) : 20
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0

    // 驗證年份範圍
    if (year < 2025 || year > currentYear + 1) {
      return NextResponse.json(
        { error: '無效的年份' },
        { status: 400 }
      )
    }

    const data = await fetchTourCases(year, limit, offset)

    return NextResponse.json(data)
  } catch (error) {
    console.error('Tours Cases API Error:', error)
    return NextResponse.json(
      { error: '無法取得資料' },
      { status: 500 }
    )
  }
}
```

**Step 4: Test the API**

Run: `curl "http://localhost:3000/api/tours/cases?year=2026&limit=5"`
Expected: JSON response with cases array, total count, and year

**Step 5: Commit**

```bash
git add src/lib/notion/tours.ts src/lib/notion/index.ts src/app/api/tours/cases/route.ts
git commit -m "$(cat <<'EOF'
feat: add tours cases API for public display

Fetches customer cases from Notion without sensitive data.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create Tours Components

**Files:**
- Create: `src/components/tours/PackageCard.tsx`
- Create: `src/components/tours/CaseCard.tsx`
- Create: `src/components/tours/YearFilter.tsx`

**Step 1: Create PackageCard component**

```tsx
// src/components/tours/PackageCard.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { urlFor } from '@/sanity/client'

interface PackageCardProps {
  title: string
  slug: string
  subtitle?: string
  coverImage?: any
  duration?: string
  highlights?: string[]
}

export default function PackageCard({
  title,
  slug,
  subtitle,
  coverImage,
  duration,
  highlights,
}: PackageCardProps) {
  return (
    <Link
      href={`/tours/${slug}`}
      className="group block bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
    >
      {/* Cover Image */}
      <div className="relative h-48 sm:h-56 bg-gradient-to-br from-primary-light to-primary/20">
        {coverImage ? (
          <Image
            src={urlFor(coverImage).width(600).height(400).url()}
            alt={coverImage.alt || title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">🌴</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {duration && (
          <span className="text-sm text-primary font-medium">{duration}</span>
        )}
        <h3 className="text-xl font-bold text-gray-900 mt-1 group-hover:text-primary transition-colors">
          {title}
        </h3>
        {subtitle && (
          <p className="text-gray-600 mt-2">{subtitle}</p>
        )}

        {/* Highlights */}
        {highlights && highlights.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {highlights.slice(0, 4).map((h) => (
              <span
                key={h}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
              >
                {h}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-4 text-primary font-medium flex items-center gap-1">
          了解更多
          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  )
}
```

**Step 2: Create CaseCard component**

```tsx
// src/components/tours/CaseCard.tsx

interface CaseCardProps {
  name: string
  days: number
  month: string
  status: 'completed' | 'upcoming'
}

export default function CaseCard({ name, days, month, status }: CaseCardProps) {
  const isCompleted = status === 'completed'

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="text-lg font-semibold text-gray-900">
        {name}
      </div>
      <div className="text-sm text-gray-500 mt-1">
        {days} 天
      </div>
      <div className="text-sm text-gray-400 mt-1">
        {month}
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
            <span>🔜</span>
            即將出發
          </>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Create YearFilter component**

```tsx
// src/components/tours/YearFilter.tsx
'use client'

interface YearFilterProps {
  years: number[]
  selectedYear: number
  onChange: (year: number) => void
}

export default function YearFilter({ years, selectedYear, onChange }: YearFilterProps) {
  return (
    <div className="flex gap-2">
      {years.map((year) => (
        <button
          key={year}
          onClick={() => onChange(year)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedYear === year
              ? 'bg-primary text-black'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {year}
        </button>
      ))}
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/components/tours/
git commit -m "$(cat <<'EOF'
feat: add tours components (PackageCard, CaseCard, YearFilter)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Build /tours Page

**Files:**
- Modify: `src/app/tours/page.tsx`

**Step 1: Replace the existing tours page**

```tsx
// src/app/tours/page.tsx
import type { Metadata } from 'next'
import { client } from '@/sanity/client'
import ToursPageClient from './ToursPageClient'

export const metadata: Metadata = {
  title: '行程案例 | 清微旅行',
  description: '114 組家庭的清邁回憶，每趟旅程都是獨一無二的故事。查看我們的招牌套餐和過去服務案例。',
}

// Sanity query for tour packages
const packagesQuery = `*[_type == "tourPackage"] | order(order asc) {
  title,
  "slug": slug.current,
  subtitle,
  coverImage,
  duration,
  highlights
}`

async function getPackages() {
  try {
    return await client.fetch(packagesQuery)
  } catch {
    return []
  }
}

export default async function ToursPage() {
  const packages = await getPackages()

  return <ToursPageClient packages={packages} />
}
```

**Step 2: Create the client component**

Create `src/app/tours/ToursPageClient.tsx`:

```tsx
// src/app/tours/ToursPageClient.tsx
'use client'

import { useState, useEffect } from 'react'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'
import PackageCard from '@/components/tours/PackageCard'
import CaseCard from '@/components/tours/CaseCard'
import YearFilter from '@/components/tours/YearFilter'

interface Package {
  title: string
  slug: string
  subtitle?: string
  coverImage?: any
  duration?: string
  highlights?: string[]
}

interface Case {
  id: string
  name: string
  month: string
  days: number
  status: 'completed' | 'upcoming'
}

interface ToursPageClientProps {
  packages: Package[]
}

const CASES_PER_PAGE = 20

export default function ToursPageClient({ packages }: ToursPageClientProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear, currentYear - 1])
  const [cases, setCases] = useState<Case[]>([])
  const [totalCases, setTotalCases] = useState(0)
  const [allTimeTotalCases, setAllTimeTotalCases] = useState(0)
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

  // Fetch all-time total on mount
  useEffect(() => {
    Promise.all([
      fetch(`/api/tours/cases?year=${currentYear}&limit=1`).then(r => r.json()),
      fetch(`/api/tours/cases?year=${currentYear - 1}&limit=1`).then(r => r.json()),
    ]).then(([current, last]) => {
      setAllTimeTotalCases((current.total || 0) + (last.total || 0))
    }).catch(console.error)
  }, [currentYear])

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
    <div className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {allTimeTotalCases > 0 ? `${allTimeTotalCases} 組家庭的清邁回憶` : '每一組家庭的清邁回憶'}
          </h1>
          <p className="text-xl text-gray-600">
            每趟旅程都是獨一無二的故事
          </p>
        </div>

        {/* Signature Packages Section */}
        {packages.length > 0 && (
          <section className="mb-20">
            <SectionTitle
              title="招牌推薦"
              subtitle="精選套餐，為你的清邁之旅開啟最棒的開始"
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
                />
              ))}
            </div>
          </section>
        )}

        {/* Past Cases Section */}
        <section className="mb-16">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <SectionTitle
              title="過去案例"
              subtitle="真實服務紀錄，見證每一趟精彩旅程"
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
                    month={c.month}
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
        <section className="text-center bg-gradient-to-r from-primary-light to-primary/20 rounded-2xl p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            想打造專屬於你們家的行程嗎？
          </h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            每個家庭的需求都不同，告訴我們你的想法，我們幫你量身打造
          </p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external>
            LINE 免費諮詢
          </Button>
        </section>
      </div>
    </div>
  )
}
```

**Step 3: Verify page renders**

Run: `npm run dev`
Visit: `http://localhost:3000/tours`
Expected: Page shows with hero, packages section (empty if none in Sanity), cases loading from Notion, and CTA

**Step 4: Commit**

```bash
git add src/app/tours/
git commit -m "$(cat <<'EOF'
feat: rebuild /tours page with packages and Notion cases

- Signature packages from Sanity CMS
- Past cases from Notion API with year filter
- Load more pagination
- LINE CTA section

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create Tour Package Detail Page

**Files:**
- Create: `src/app/tours/[slug]/page.tsx`

**Step 1: Create the detail page**

```tsx
// src/app/tours/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'

interface DailySchedule {
  day: number
  emoji?: string
  title: string
  activities: string
}

interface TourPackage {
  title: string
  slug: string
  subtitle?: string
  coverImage?: any
  duration?: string
  highlights?: string[]
  suitableFor?: string[]
  dailySchedule?: DailySchedule[]
  includes?: string[]
  excludes?: string[]
  priceRange?: string
  priceNote?: string
}

const packageQuery = `*[_type == "tourPackage" && slug.current == $slug][0]{
  title,
  "slug": slug.current,
  subtitle,
  coverImage,
  duration,
  highlights,
  suitableFor,
  dailySchedule,
  includes,
  excludes,
  priceRange,
  priceNote
}`

async function getPackage(slug: string): Promise<TourPackage | null> {
  try {
    return await client.fetch(packageQuery, { slug })
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const pkg = await getPackage(slug)

  if (!pkg) {
    return { title: '找不到頁面' }
  }

  return {
    title: `${pkg.title} | 清微旅行`,
    description: pkg.subtitle || `${pkg.title} - 清微旅行精選套餐`,
  }
}

export default async function TourPackagePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const pkg = await getPackage(slug)

  if (!pkg) {
    notFound()
  }

  return (
    <div className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="relative rounded-2xl overflow-hidden mb-12">
          {pkg.coverImage ? (
            <Image
              src={urlFor(pkg.coverImage).width(1200).height(600).url()}
              alt={pkg.coverImage.alt || pkg.title}
              width={1200}
              height={600}
              className="w-full h-64 md:h-96 object-cover"
            />
          ) : (
            <div className="w-full h-64 md:h-96 bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
              <span className="text-8xl">🌴</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{pkg.title}</h1>
            {pkg.subtitle && (
              <p className="text-lg md:text-xl opacity-90">{pkg.subtitle}</p>
            )}
            {pkg.highlights && pkg.highlights.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {pkg.highlights.map((h) => (
                  <span
                    key={h}
                    className="text-sm bg-white/20 backdrop-blur px-3 py-1 rounded-full"
                  >
                    #{h}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Suitable For Section */}
        {pkg.suitableFor && pkg.suitableFor.length > 0 && (
          <section className="mb-12 bg-primary-light/30 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              這趟旅程適合你，如果...
            </h2>
            <ul className="space-y-3">
              {pkg.suitableFor.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-700">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Daily Schedule Section */}
        {pkg.dailySchedule && pkg.dailySchedule.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">行程概覽</h2>
            <div className="space-y-4">
              {pkg.dailySchedule.map((day) => (
                <div
                  key={day.day}
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
                >
                  <div className="flex items-center gap-3 mb-2">
                    {day.emoji && <span className="text-2xl">{day.emoji}</span>}
                    <div>
                      <span className="text-sm text-primary font-medium">
                        Day {day.day}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {day.title}
                      </h3>
                    </div>
                  </div>
                  <p className="text-gray-600 ml-10">{day.activities}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Includes/Excludes Section */}
        <section className="mb-12 grid md:grid-cols-2 gap-6">
          {pkg.includes && pkg.includes.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">費用包含</h3>
              <ul className="space-y-2">
                {pkg.includes.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700">
                    <span className="text-green-500">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pkg.excludes && pkg.excludes.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">費用不含</h3>
              <ul className="space-y-2">
                {pkg.excludes.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-500">
                    <span className="text-gray-400">✗</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Pricing Section */}
        {pkg.priceRange && (
          <section className="mb-12 bg-gray-50 rounded-2xl p-6 md:p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">參考價格</h2>
            <div className="text-3xl font-bold text-primary mb-2">
              {pkg.priceRange}
            </div>
            {pkg.priceNote && (
              <p className="text-gray-500 text-sm">（{pkg.priceNote}）</p>
            )}
            <p className="text-gray-600 mt-4 text-sm">
              💬 實際費用依您的需求客製報價
            </p>
          </section>
        )}

        {/* CTA Section */}
        <section className="text-center bg-gradient-to-r from-primary-light to-primary/20 rounded-2xl p-8 md:p-12">
          <p className="text-gray-700 mb-2">
            這是範例行程，每個家庭的需求都不同
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-6">
            告訴我們你的想法，我們幫你量身打造 ✨
          </p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
            LINE 免費諮詢
          </Button>
        </section>
      </div>
    </div>
  )
}
```

**Step 2: Verify page renders**

Visit: `http://localhost:3000/tours/any-slug`
Expected: 404 page (no packages yet), or detail page if package exists in Sanity

**Step 3: Commit**

```bash
git add src/app/tours/\[slug\]/
git commit -m "$(cat <<'EOF'
feat: add tour package detail page /tours/[slug]

- Hero with cover image and highlights
- Suitable for section
- Daily schedule breakdown
- Includes/excludes
- Pricing with LINE CTA

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update Navigation to 5 Items

**Files:**
- Modify: `src/components/Header.tsx:9-15`
- Modify: `src/components/Footer.tsx:7-13`

**Step 1: Update navLinks array in Header.tsx**

Change the navLinks in `src/components/Header.tsx`:

```typescript
const navLinks = [
  { href: '/', label: '首頁' },
  { href: '/services/car-charter', label: '包車服務' },
  { href: '/tours', label: '行程案例' },
  { href: '/blog', label: '部落格' },
]
```

**Step 2: Update navLinks array in Footer.tsx**

Change the navLinks in `src/components/Footer.tsx` to match:

```typescript
const navLinks = [
  { href: '/', label: '首頁' },
  { href: '/services/car-charter', label: '包車服務' },
  { href: '/tours', label: '行程案例' },
  { href: '/homestay', label: '芳縣民宿' },
  { href: '/blog', label: '部落格' },
]
```

Note: Footer keeps 芳縣民宿 link since it's still a valid page, just removed from main nav.

**Step 3: Verify navigation**

Visit: `http://localhost:3000`
Expected: Header shows 5 items (首頁, 包車服務, 行程案例, 部落格, LINE諮詢)
Expected: Footer shows relevant links including 芳縣民宿

**Step 4: Commit**

```bash
git add src/components/Header.tsx src/components/Footer.tsx
git commit -m "$(cat <<'EOF'
feat: update navigation to 5 items

Header: Removed 芳縣民宿 and 關於我們, added 行程案例.
Footer: Updated links, kept 芳縣民宿.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add Tours Preview Section to Homepage

**Files:**
- Create: `src/components/sections/ToursPreview.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/sanity/schemas/landingPage.ts` (add new fields)

**Step 1: Create ToursPreview component**

```tsx
// src/components/sections/ToursPreview.tsx
import Link from 'next/link'
import { client } from '@/sanity/client'
import PackageCard from '@/components/tours/PackageCard'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'

const packagesQuery = `*[_type == "tourPackage"] | order(order asc) [0...3] {
  title,
  "slug": slug.current,
  subtitle,
  coverImage,
  duration,
  highlights
}`

export default async function ToursPreview() {
  const packages = await client.fetch(packagesQuery).catch(() => [])

  if (packages.length === 0) {
    return null
  }

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="行程案例"
          subtitle="每一組家庭的專屬清邁回憶"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {packages.slice(0, 2).map((pkg: any) => (
            <PackageCard
              key={pkg.slug}
              title={pkg.title}
              slug={pkg.slug}
              subtitle={pkg.subtitle}
              coverImage={pkg.coverImage}
              duration={pkg.duration}
              highlights={pkg.highlights}
            />
          ))}
        </div>

        <div className="text-center">
          <Button href="/tours" variant="outline">
            查看更多行程案例
          </Button>
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Add ToursPreview to homepage**

Modify `src/app/page.tsx` to add the import and component:

Add import at top:
```typescript
import ToursPreview from '@/components/sections/ToursPreview'
```

Add after WhyUs component in the return:
```tsx
<ToursPreview />
```

**Step 3: Verify homepage**

Visit: `http://localhost:3000`
Expected: Tours preview section appears (or nothing if no packages in Sanity yet)

**Step 4: Commit**

```bash
git add src/components/sections/ToursPreview.tsx src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat: add tours preview section to homepage

Shows up to 2 signature packages with link to /tours.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add Homestay Section to Homepage

**Files:**
- Create: `src/components/sections/HomestaySection.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create HomestaySection component**

```tsx
// src/components/sections/HomestaySection.tsx
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'

// 使用正確的 schema 欄位名稱
const homestayQuery = `*[_type == "homestay"][0]{
  heroTitle,
  heroSubtitle,
  heroMainImage,
  features
}`

interface Feature {
  icon?: string
  title?: string
  description?: string
}

export default async function HomestaySection() {
  const homestay = await client.fetch(homestayQuery).catch(() => null)

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Image */}
          <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden">
            {homestay?.heroMainImage ? (
              <Image
                src={urlFor(homestay.heroMainImage).width(800).height(600).url()}
                alt={homestay.heroMainImage.alt || '芳縣民宿'}
                fill
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                <span className="text-6xl">🏡</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div>
            <SectionTitle
              title={homestay?.heroTitle || '芳縣特色民宿'}
              subtitle="住進我們的家，體驗最道地的泰北生活"
              align="left"
            />
            <p className="text-gray-600 mb-6">
              {homestay?.heroSubtitle || '遠離觀光區的寧靜，體驗真正的泰北在地生活'}
            </p>

            {homestay?.features && homestay.features.length > 0 && (
              <ul className="space-y-2 mb-6">
                {homestay.features.slice(0, 4).map((f: Feature, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-gray-700">
                    <span className="text-primary">{f.icon || '✓'}</span>
                    {f.title}
                  </li>
                ))}
              </ul>
            )}

            <Button href="/homestay" variant="outline">
              了解更多
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Add HomestaySection to homepage**

Modify `src/app/page.tsx`:

Add import:
```typescript
import HomestaySection from '@/components/sections/HomestaySection'
```

Add after Services or WhyUs:
```tsx
<HomestaySection />
```

**Step 3: Verify homepage**

Visit: `http://localhost:3000`
Expected: Homestay section appears on homepage

**Step 4: Commit**

```bash
git add src/components/sections/HomestaySection.tsx src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat: add homestay section to homepage

Replaces dedicated nav item with homepage section.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Update About Us to Link to Migration Story

**Files:**
- Modify: `src/components/Footer.tsx`
- Note: Header 已在 Task 6 移除「關於我們」連結

**Step 1: Update Footer navLinks**

文章已存在：`/blog/eric-story-taiwan-to-chiang-mai`

在 Footer navLinks 加入「我們的故事」連結：

```typescript
const navLinks = [
  { href: '/', label: '首頁' },
  { href: '/services/car-charter', label: '包車服務' },
  { href: '/tours', label: '行程案例' },
  { href: '/homestay', label: '芳縣民宿' },
  { href: '/blog', label: '部落格' },
  { href: '/blog/eric-story-taiwan-to-chiang-mai', label: '我們的故事' },
]
```

**Step 2: Verify link works**

Visit: `http://localhost:3000/blog/eric-story-taiwan-to-chiang-mai`
Expected: Shows migration story article

**Step 4: Commit**

```bash
git add src/components/Footer.tsx
git commit -m "$(cat <<'EOF'
feat: update About Us link to migration story

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Final Verification and Cleanup

**Step 1: Run build to check for errors**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Test all pages**

- Visit `/tours` - shows packages and cases
- Visit `/tours/[slug]` - shows package detail (when package exists)
- Visit `/` - shows new sections
- Check navigation - shows 5 items
- Test mobile navigation
- Test year filter on /tours
- Test load more on /tours

**Step 3: Remove Rezio references**

Search for any remaining Rezio links and remove them:
```bash
grep -r "rezio" src/
```

**Step 4: Final commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
chore: Phase 4 cleanup - remove Rezio references

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Sanity tourPackage schema | schemas/tourPackage.ts, schemas/index.ts |
| 2 | Tours cases API (含動態年份) | lib/notion/tours.ts, api/tours/cases/route.ts |
| 3 | Tours components | components/tours/*.tsx |
| 4 | /tours page (動態案例數) | app/tours/page.tsx, ToursPageClient.tsx |
| 5 | /tours/[slug] page | app/tours/[slug]/page.tsx |
| 6 | Navigation update | Header.tsx, **Footer.tsx** |
| 7 | Homepage tours preview | sections/ToursPreview.tsx |
| 8 | Homepage homestay section (正確欄位) | sections/HomestaySection.tsx |
| 9 | About Us link update | Footer.tsx (文章已存在) |
| 10 | Final verification | - |

## 修正紀錄

- **Task 2 & 4**: 新增 `availableYears` 動態返回，「114 組家庭」改為動態取得
- **Task 6**: 新增 Footer.tsx 更新
- **Task 8**: 修正欄位名稱 `heroMainImage`, `heroTitle`, `features`
- **Task 9**: 文章已存在，直接使用 `/blog/eric-story-taiwan-to-chiang-mai`

---

*Plan created: 2026-01-23*
*Plan updated: 2026-01-23 (修正 6 個問題)*
