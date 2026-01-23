'use client'

import { useEffect } from 'react'
import { trackArticleView } from '@/lib/analytics'

interface ArticleViewTrackerProps {
  title: string
  slug: string
}

export default function ArticleViewTracker({ title, slug }: ArticleViewTrackerProps) {
  useEffect(() => {
    // 追蹤文章閱讀（僅執行一次）
    trackArticleView(title, slug)
  }, [title, slug])

  return null
}
