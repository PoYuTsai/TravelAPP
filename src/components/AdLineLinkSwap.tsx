'use client'

import { useEffect } from 'react'

// 廣告專屬 LINE 加好友連結（LINE OA 加入好友管道：官網 / google-ads / 2026-07儲值）
// 帶 gclid 或 utm_source=google* 進站的訪客，7 天內點任何加 LINE 連結都改走這條，
// 讓 LINE 後台「加入管道」報表能分出廣告帶來的好友；自然流量不受影響。
const AD_LINE_URL = 'https://lin.ee/nVohR4S'
const DEFAULT_LINE_PATH = 'line.me/R/ti/p/@037nyuwk'
const STORAGE_KEY = 'cw_ad_visit_at'
const ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function isAdVisitor(): boolean {
  try {
    const visitedAt = Number(localStorage.getItem(STORAGE_KEY))
    return visitedAt > 0 && Date.now() - visitedAt < ATTRIBUTION_WINDOW_MS
  } catch {
    return false
  }
}

export default function AdLineLinkSwap() {
  useEffect(() => {
    // 進站時偵測廣告參數（Google Ads 自動標記 gclid、或手動 utm_source=google*）
    try {
      const params = new URLSearchParams(window.location.search)
      const utmSource = (params.get('utm_source') || '').toLowerCase()
      if (params.has('gclid') || utmSource.startsWith('google')) {
        localStorage.setItem(STORAGE_KEY, String(Date.now()))
      }
    } catch {
      // localStorage 不可用（無痕模式等）時放棄追蹤，不影響頁面
    }

    // 點擊瞬間把預設加好友連結換成廣告追蹤連結（capture 階段，先於導頁）
    const swapOnClick = (event: MouseEvent) => {
      if (!isAdVisitor()) return
      const target = event.target as Element | null
      const anchor = target?.closest?.('a[href]')
      if (anchor instanceof HTMLAnchorElement && anchor.href.includes(DEFAULT_LINE_PATH)) {
        anchor.href = AD_LINE_URL
      }
    }
    document.addEventListener('click', swapOnClick, true)
    document.addEventListener('auxclick', swapOnClick, true)
    return () => {
      document.removeEventListener('click', swapOnClick, true)
      document.removeEventListener('auxclick', swapOnClick, true)
    }
  }, [])

  return null
}
