'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SearchBox() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const [query, setQuery] = useState(initialQuery)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (query.trim()) {
        router.push(`/blog?q=${encodeURIComponent(query.trim())}`)
      } else {
        router.push('/blog')
      }
    },
    [query, router]
  )

  const handleClear = useCallback(() => {
    setQuery('')
    router.push('/blog')
  }, [router])

  return (
    <form onSubmit={handleSubmit} className="relative max-w-md mx-auto mb-6">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋文章..."
          className="w-full px-4 py-3 pl-12 pr-20 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
        />
        {/* Search icon */}
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {/* Clear button (when there's text) */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-16 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {/* Search button */}
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          搜尋
        </button>
      </div>
    </form>
  )
}
