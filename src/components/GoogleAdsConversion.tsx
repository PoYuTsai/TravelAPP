'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AW_CONVERSION_ID } from '@/lib/constants'

// 頁面轉換事件設定
const PAGE_CONVERSIONS: Record<string, string> = {
  'blog': 'dL2cCIjCo-obEL7PruU_',           // 部落格
  'car-charter': 'tvPkCOGEmOobEL7PruU_',    // 包車服務
  'homestay': 'TpB2CLeso-obEL7PruU_',       // 芳縣民宿
  'about': 'c3BnCKexo-obEL7PruU_',          // 關於我們
  'transportation': '82nyCMqzo-obEL7PruU_', // 交通文章
  'eric-story-taiwan-to-chiang-mai': 'YS5PCLuBluobEL7PruU_', // 移居故事
  'illegal-work': 'SYcECMG5o-obEL7PruU_',   // 非法打工文章
}

// LINE 點擊追蹤已移至 analytics.ts 統一處理
// 避免重複追蹤（Button 組件 + 全局監聽會造成雙重計算）

export default function GoogleAdsConversion() {
  const pathname = usePathname()

  // 頁面瀏覽轉換追蹤
  useEffect(() => {
    if (typeof window === 'undefined' || !window.gtag) return

    // 使用更精確的匹配：檢查路徑段落
    const pathSegments = pathname.split('/').filter(Boolean)

    for (const [keyword, conversionId] of Object.entries(PAGE_CONVERSIONS)) {
      // 完整路徑比對（如 'eric-story-taiwan-to-chiang-mai'）
      // 或首段路徑比對（如 'blog', 'car-charter'）
      const isExactMatch = pathSegments.includes(keyword) ||
        pathname === `/${keyword}` ||
        pathname.startsWith(`/${keyword}/`)

      if (isExactMatch) {
        window.gtag('event', 'conversion', {
          'send_to': `${AW_CONVERSION_ID}/${conversionId}`
        })
        break // 只觸發第一個匹配的轉換
      }
    }
  }, [pathname])

  return null
}
