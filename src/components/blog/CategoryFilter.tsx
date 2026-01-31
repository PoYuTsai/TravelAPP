'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

const categories = [
  { key: 'all', label: '全部' },
  { key: 'guide', label: '攻略' },
  { key: 'attraction', label: '景點' },
  { key: 'food', label: '美食' },
  { key: 'transportation', label: '交通' },
  { key: 'practical', label: '實用' },
  { key: 'story', label: '故事' },
]

export default function CategoryFilter() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Determine current category from URL
  // Support both /blog?category=xxx and /blog/category/xxx
  const pathCategory = pathname.startsWith('/blog/category/')
    ? pathname.split('/').pop()
    : null
  const queryCategory = searchParams.get('category')
  const currentCategory = pathCategory || queryCategory || 'all'

  return (
    <div className="flex flex-wrap justify-center gap-2 mb-8">
      {categories.map((cat) => {
        const isActive = currentCategory === cat.key
        // Use SEO-friendly URLs for categories
        const href = cat.key === 'all' ? '/blog' : `/blog/category/${cat.key}`

        return (
          <Link
            key={cat.key}
            href={href}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </Link>
        )
      })}
    </div>
  )
}
