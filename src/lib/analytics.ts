// Google Analytics 追蹤工具

declare global {
  interface Window {
    gtag: (
      command: 'event' | 'config' | 'js',
      targetId: string | Date,
      params?: Record<string, unknown>
    ) => void
  }
}

// 追蹤自訂事件
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>
) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params)
  }
}

// 追蹤 LINE 點擊
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
