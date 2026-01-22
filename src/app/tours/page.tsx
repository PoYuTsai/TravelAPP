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
