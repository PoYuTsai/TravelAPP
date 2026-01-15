'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const categories = [
  { key: 'all', label: '全部' },
  { key: 'guide', label: '攻略' },
  { key: 'attraction', label: '景點' },
  { key: 'food', label: '美食' },
  { key: 'accommodation', label: '住宿' },
  { key: 'transportation', label: '交通' },
  { key: 'itinerary', label: '行程' },
  { key: 'story', label: '故事' },
]

export default function CategoryFilter() {
  const searchParams = useSearchParams()
  const currentCategory = searchParams.get('category') || 'all'

  return (
    <div className="flex flex-wrap justify-center gap-2 mb-8">
      {categories.map((cat) => {
        const isActive = currentCategory === cat.key
        const href = cat.key === 'all' ? '/blog' : `/blog?category=${cat.key}`

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
