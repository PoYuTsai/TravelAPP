'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Google Ads Conversion ID
const AW_CONVERSION_ID = 'AW-17124009918'

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

// LINE 點擊轉換 ID
const LINE_CLICK_CONVERSION = '0CrLCKj1l-obEL7PruU_'

// 表單提交轉換 ID (contact form)
const FORM_SUBMIT_CONVERSION = 'form_submit_conversion'

// 導出追蹤函數供其他組件使用
export function trackGoogleAdsFormSubmit() {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', 'conversion', {
    'send_to': `${AW_CONVERSION_ID}/${LINE_CLICK_CONVERSION}`,
    'event_category': 'form',
    'event_label': 'contact_form_submit'
  })
}

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

  // LINE 連結點擊追蹤
  useEffect(() => {
    if (typeof window === 'undefined' || !window.gtag) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a[href*="line.me"]')
      if (link) {
        window.gtag('event', 'conversion', {
          'send_to': `${AW_CONVERSION_ID}/${LINE_CLICK_CONVERSION}`
        })
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return null
}
