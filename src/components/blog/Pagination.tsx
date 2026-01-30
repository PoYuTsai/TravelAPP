// src/components/blog/Pagination.tsx
'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface PaginationProps {
  currentPage: number
  totalPages: number
  basePath?: string
}

export default function Pagination({ currentPage, totalPages, basePath = '/blog' }: PaginationProps) {
  const searchParams = useSearchParams()

  // 不顯示分頁如果只有一頁
  if (totalPages <= 1) return null

  // 建立帶有現有參數的 URL
  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page === 1) {
      params.delete('page')
    } else {
      params.set('page', page.toString())
    }
    const queryString = params.toString()
    return queryString ? `${basePath}?${queryString}` : basePath
  }

  // 計算顯示的頁碼範圍
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const showEllipsisThreshold = 7

    if (totalPages <= showEllipsisThreshold) {
      // 顯示所有頁碼
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // 顯示縮略版本
      pages.push(1)

      if (currentPage > 3) {
        pages.push('ellipsis')
      }

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }

      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <nav
      className="flex justify-center items-center gap-2 mt-12"
      aria-label="部落格分頁"
    >
      {/* 上一頁 */}
      {currentPage > 1 ? (
        <Link
          href={createPageUrl(currentPage - 1)}
          className="px-4 py-2 text-gray-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="上一頁"
        >
          ←
        </Link>
      ) : (
        <span className="px-4 py-2 text-gray-300 cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center">
          ←
        </span>
      )}

      {/* 頁碼 */}
      {pageNumbers.map((page, index) => {
        if (page === 'ellipsis') {
          return (
            <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
              ...
            </span>
          )
        }

        const isCurrentPage = page === currentPage
        return (
          <Link
            key={page}
            href={createPageUrl(page)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${
              isCurrentPage
                ? 'bg-primary text-white font-medium'
                : 'text-gray-600 hover:text-primary hover:bg-primary/10'
            }`}
            aria-label={`第 ${page} 頁`}
            aria-current={isCurrentPage ? 'page' : undefined}
          >
            {page}
          </Link>
        )
      })}

      {/* 下一頁 */}
      {currentPage < totalPages ? (
        <Link
          href={createPageUrl(currentPage + 1)}
          className="px-4 py-2 text-gray-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="下一頁"
        >
          →
        </Link>
      ) : (
        <span className="px-4 py-2 text-gray-300 cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center">
          →
        </span>
      )}
    </nav>
  )
}
