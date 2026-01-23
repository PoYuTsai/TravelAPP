// src/app/tours/page.tsx
import type { Metadata } from 'next'
import { client } from '@/sanity/client'
import { fetchTotalFamilyCount } from '@/lib/notion'
import ToursPageClient from './ToursPageClient'

export const metadata: Metadata = {
  title: '行程案例 | 清微旅行',
  description: '超過百組家庭的清邁回憶，每趟旅程都是獨一無二的故事。查看我們的招牌套餐和過去服務案例。',
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

  return <ToursPageClient packages={packages} dayTours={dayTours} familyCount={familyCount} />
}
