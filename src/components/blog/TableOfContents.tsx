'use client'

import { useState, useEffect } from 'react'

interface TOCItem {
  id: string
  text: string
  level: number
}

export default function TableOfContents() {
  const [headings, setHeadings] = useState<TOCItem[]>([])
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    const article = document.getElementById('article-content') || document.querySelector('article')
    if (!article) return

    const elements = article.querySelectorAll('h2, h3')
    const items: TOCItem[] = Array.from(elements).map((el, index) => {
      const id = el.id || `heading-${index}`
      if (!el.id) el.id = id
      return {
        id,
        text: el.textContent || '',
        level: el.tagName === 'H2' ? 2 : 3,
      }
    })

    setHeadings(items)

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: '-80px 0px -75% 0px' }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  if (headings.length === 0) return null

  return (
    <nav className="rounded-[28px] border border-stone-200 bg-white px-5 py-6 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.2)]">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
        On This Page
      </p>
      <h2 className="mt-2 text-lg font-bold text-stone-900">文章目錄</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        需要快速跳到重點時，可以直接從這裡切換。
      </p>

      <ul className="mt-5 space-y-2">
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level === 3 ? 'ml-4' : ''}>
            <a
              href={`#${heading.id}`}
              className={`block rounded-2xl border px-3 py-2.5 text-sm transition-colors ${
                activeId === heading.id
                  ? 'border-primary/30 bg-primary/10 font-medium text-primary-dark'
                  : 'border-transparent text-stone-600 hover:border-stone-200 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
