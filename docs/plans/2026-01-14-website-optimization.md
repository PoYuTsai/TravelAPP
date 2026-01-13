# 網站優化實施計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 優化清微旅行網站的效能、SEO 和程式碼品質

**Architecture:** 分階段優化 - 先處理緊急問題（打包大小、Schema 錯誤），再處理中優先級項目（錯誤處理、SEO 元資料、無障礙功能）

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Sanity CMS

---

## Task 1: 移除未使用的 styled-components 依賴

**Files:**
- Modify: `package.json:35`

**Step 1: 移除依賴**

```bash
npm uninstall styled-components
```

**Step 2: 驗證移除成功**

Run: `npm ls styled-components`
Expected: 應該顯示 "empty" 或找不到該套件

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused styled-components dependency"
```

---

## Task 2: 修正 Schema 網域錯誤

**Files:**
- Modify: `src/components/blog/ArticleSchema.tsx`
- Modify: `src/components/blog/Breadcrumb.tsx`

**Step 1: 修正 ArticleSchema.tsx**

將 `chiangwaytravel.com` 改為 `chiangway.com`：

```tsx
// ArticleSchema.tsx - 修改第 23, 29, 36, 41 行
const SITE_URL = 'https://chiangway.com'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: title,
  description: description,
  image: `${SITE_URL}${image}`,
  datePublished: datePublished,
  dateModified: dateModified || datePublished,
  author: {
    '@type': 'Organization',
    name: '清微旅行 Chiangway Travel',
    url: SITE_URL,
  },
  publisher: {
    '@type': 'Organization',
    name: '清微旅行 Chiangway Travel',
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/images/logo.png`,
    },
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': `${SITE_URL}/blog/${slug}`,
  },
}
```

**Step 2: 修正 Breadcrumb.tsx**

將第 20 行的 `chiangwaytravel.com` 改為 `chiangway.com`：

```tsx
// Breadcrumb.tsx - 修改第 20 行
item: item.href ? `https://chiangway.com${item.href}` : undefined,
```

**Step 3: 驗證修改**

Run: `npm run build`
Expected: Build 成功，無錯誤

**Step 4: Commit**

```bash
git add src/components/blog/ArticleSchema.tsx src/components/blog/Breadcrumb.tsx
git commit -m "fix: correct schema URLs from chiangwaytravel.com to chiangway.com"
```

---

## Task 3: 新增 Error Boundary

**Files:**
- Create: `src/app/error.tsx`
- Create: `src/app/global-error.tsx`

**Step 1: 建立 error.tsx**

```tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">發生錯誤</h1>
        <p className="text-gray-600 mb-8">
          抱歉，頁面載入時發生問題。請重新整理或返回首頁。
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-primary hover:bg-primary-dark text-black px-6 py-3 rounded-full font-medium transition-colors"
          >
            重新整理
          </button>
          <a
            href="/"
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-full font-medium transition-colors"
          >
            返回首頁
          </a>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: 建立 global-error.tsx**

```tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-TW">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>發生嚴重錯誤</h1>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              抱歉，網站發生問題。請稍後再試。
            </p>
            <button
              onClick={reset}
              style={{
                backgroundColor: '#F7C009',
                color: 'black',
                padding: '0.75rem 1.5rem',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              重新整理
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
```

**Step 3: 驗證**

Run: `npm run build`
Expected: Build 成功

**Step 4: Commit**

```bash
git add src/app/error.tsx src/app/global-error.tsx
git commit -m "feat: add error boundaries for better error handling"
```

---

## Task 4: 完善 OpenGraph 元資料

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: 加入 OG 圖片設定**

在 metadata 中加入 openGraph.images：

```tsx
export const metadata: Metadata = {
  title: {
    default: '清微旅行 Chiangway Travel | 清邁親子包車自由行',
    template: '%s | 清微旅行',
  },
  description: '清邁親子自由行首選！專業中文導遊、安全舒適包車服務，為您的家庭打造難忘的清邁之旅。',
  keywords: ['清邁親子自由行', '清邁包車', '清邁中文導遊', '清邁家庭旅遊', '清邁親子景點', '清邁自由行', '泰國親子旅遊'],
  authors: [{ name: '清微旅行' }],
  metadataBase: new URL('https://chiangway.com'),
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    siteName: '清微旅行 Chiangway Travel',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: '清微旅行 - 清邁親子包車自由行',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '清微旅行 Chiangway Travel | 清邁親子包車自由行',
    description: '清邁親子自由行首選！專業中文導遊、安全舒適包車服務。',
    images: ['/images/og-image.jpg'],
  },
}
```

**Step 2: 驗證**

Run: `npm run build`
Expected: Build 成功

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add complete OpenGraph and Twitter card metadata"
```

---

## Task 5: 動態 Sitemap 加入部落格文章

**Files:**
- Modify: `src/app/sitemap.ts`

**Step 1: 修改 sitemap.ts 加入動態部落格**

```ts
import { MetadataRoute } from 'next'
import { client } from '@/sanity/client'

async function getBlogSlugs() {
  const query = `*[_type == "post" && defined(slug.current)]{
    "slug": slug.current,
    _updatedAt
  }`
  try {
    return await client.fetch(query)
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://chiangway.com'

  // 靜態頁面
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/tours`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/services/car-charter`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/homestay`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]

  // 動態部落格文章
  const posts = await getBlogSlugs()
  const blogPages: MetadataRoute.Sitemap = posts.map((post: { slug: string; _updatedAt: string }) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post._updatedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...blogPages]
}
```

**Step 2: 驗證**

Run: `npm run build`
Expected: Build 成功

**Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat: add dynamic blog posts to sitemap"
```

---

## Task 6: 改善手機選單無障礙功能

**Files:**
- Modify: `src/components/Header.tsx`

**Step 1: 加入 ARIA 屬性和 Escape 鍵處理**

修改 Header.tsx：

```tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

// ... navLinks 保持不變 ...

export default function Header() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  const closeMenu = useCallback(() => setIsMenuOpen(false), [])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 處理 Escape 鍵關閉選單
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        closeMenu()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isMenuOpen, closeMenu])

  return (
    <header ...>
      {/* ... 其他內容保持不變 ... */}

      {/* Mobile Menu Button - 加入 aria 屬性 */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="md:hidden p-2 text-gray-600"
        aria-label={isMenuOpen ? '關閉選單' : '開啟選單'}
        aria-expanded={isMenuOpen}
        aria-controls="mobile-menu"
      >
        {/* SVG 保持不變 */}
      </button>

      {/* Mobile Menu - 加入 id */}
      {isMenuOpen && (
        <div id="mobile-menu" className="md:hidden py-4 border-t">
          {/* 內容保持不變 */}
        </div>
      )}
    </header>
  )
}
```

**Step 2: 驗證**

Run: `npm run build`
Expected: Build 成功

**Step 3: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: improve mobile menu accessibility with ARIA attributes"
```

---

## Task 7: 處理 Git 變更（LineFloatButton 移除）

**Files:**
- Modified: `src/app/layout.tsx`
- Deleted: `src/components/LineFloatButton.tsx`

**Step 1: 確認變更是否要保留**

目前 layout.tsx 已移除 LineFloatButton 引用，LineFloatButton.tsx 也被刪除。
如果確定要移除浮動按鈕，執行以下步驟。

**Step 2: Commit 變更**

```bash
git add src/app/layout.tsx
git rm src/components/LineFloatButton.tsx
git commit -m "refactor: remove LineFloatButton component"
```

---

## 執行順序摘要

1. Task 1: 移除 styled-components（2 分鐘）
2. Task 7: 處理 Git 變更（1 分鐘）
3. Task 2: 修正 Schema 網域（5 分鐘）
4. Task 3: 新增 Error Boundary（5 分鐘）
5. Task 4: 完善 OG 元資料（3 分鐘）
6. Task 5: 動態 Sitemap（5 分鐘）
7. Task 6: 手機選單無障礙（5 分鐘）

總計約 30 分鐘可完成所有優化。
