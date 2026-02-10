// Google Analytics 追蹤工具
// 注意：GA4 和 Google Ads 轉換現在由 GTM 統一管理

declare global {
  interface Window {
    gtag: (
      command: 'event' | 'config' | 'js',
      targetId: string | Date,
      params?: Record<string, unknown>
    ) => void
    dataLayer: unknown[]
  }
}

// 追蹤自訂事件（透過 dataLayer 傳送給 GTM）
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>
) {
  if (typeof window !== 'undefined') {
    // 優先使用 dataLayer（GTM 標準方式）
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: eventName,
      ...params,
    })
  }
}

// 追蹤 LINE 點擊
// Google Ads 轉換由 GTM 觸發器處理（監聽 line.me 連結點擊）
export function trackLineClick(location: string) {
  trackEvent('line_click', {
    event_category: 'engagement',
    event_label: location,
    link_url: 'https://line.me/R/ti/p/@037nyuwk',
  })
}

// 追蹤文章閱讀
export function trackArticleView(articleTitle: string, articleSlug: string) {
  trackEvent('article_view', {
    event_category: 'content',
    article_title: articleTitle,
    article_slug: articleSlug,
  })
}

// 追蹤表單提交
export function trackFormSubmit(formName: string) {
  trackEvent('form_submit', {
    event_category: 'engagement',
    form_name: formName,
  })
}

// 追蹤行程查看
export function trackTourView(tourTitle: string, tourSlug: string, tourType: 'package' | 'dayTour') {
  trackEvent('tour_view', {
    event_category: 'content',
    tour_title: tourTitle,
    tour_slug: tourSlug,
    tour_type: tourType,
  })
}

// 追蹤影片播放
export function trackVideoPlay(videoTitle: string, videoUrl: string) {
  trackEvent('video_start', {
    event_category: 'video',
    video_title: videoTitle,
    video_url: videoUrl,
  })
}

// 追蹤影片進度 (25%, 50%, 75%)
export function trackVideoProgress(videoTitle: string, milestone: 25 | 50 | 75) {
  trackEvent('video_progress', {
    event_category: 'video',
    video_title: videoTitle,
    video_percent: milestone,
  })
}

// 追蹤影片完成
export function trackVideoComplete(videoTitle: string) {
  trackEvent('video_complete', {
    event_category: 'video',
    video_title: videoTitle,
  })
}

// 追蹤頁面捲動深度
export function trackScrollDepth(milestone: 25 | 50 | 75 | 90, pageTitle: string) {
  trackEvent('scroll_depth', {
    event_category: 'engagement',
    scroll_percent: milestone,
    page_title: pageTitle,
  })
}
