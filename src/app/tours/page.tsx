// src/app/tours/page.tsx
import type { Metadata } from 'next'
import { client } from '@/sanity/client'
import { fetchTotalFamilyCount } from '@/lib/notion'
import ToursPageClient from './ToursPageClient'
import ToursPageSchema from '@/components/schema/ToursPageSchema'

export const metadata: Metadata = {
  title: '清邁親子行程案例｜100+ 組家庭的旅遊回憶｜清微旅行',
  description: '清邁親子旅遊行程案例，超過 100 組家庭的真實回憶。夜間動物園、大象互動、清萊一日遊⋯查看清微旅行的招牌套餐和客製化行程範例。',
  alternates: {
    canonical: 'https://chiangway-travel.com/tours',
  },
  openGraph: {
    title: '清邁親子行程案例｜100+ 組家庭的旅遊回憶｜清微旅行',
    description: '清邁親子旅遊行程案例，超過 100 組家庭的真實回憶。查看清微旅行的招牌套餐和客製化行程範例。',
    url: 'https://chiangway-travel.com/tours',
    images: [{ url: '/images/og-image.png', width: 1200, height: 630, alt: '清邁親子行程案例 - 清微旅行' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '清邁親子行程案例｜清微旅行',
    description: '清邁親子旅遊行程案例，超過 100 組家庭的真實回憶。',
    images: ['/images/og-image.png'],
  },
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60

// Sanity query for tour packages (multi-day)
const packagesQuery = `*[_type == "tourPackage"] | order(order asc) {
  title,
  "slug": slug.current,
  subtitle,
  coverImage,
  duration,
  highlights
}`

// Sanity query for day tours
const dayToursQuery = `*[_type == "dayTour"] | order(order asc) {
  title,
  "slug": slug.current,
  subtitle,
  location,
  coverImage,
  highlights,
  basePrice
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
  const [packages, dayTours, familyCount] = await Promise.all([
    getPackages(),
    getDayTours(),
    fetchTotalFamilyCount(),
  ])

  return (
    <>
      <ToursPageSchema packages={packages} dayTours={dayTours} />
      <ToursPageClient packages={packages} dayTours={dayTours} familyCount={familyCount} />
    </>
  )
}
