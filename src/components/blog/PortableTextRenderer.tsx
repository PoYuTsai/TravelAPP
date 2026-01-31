'use client'

import { PortableText, PortableTextComponents } from '@portabletext/react'
import type { PortableTextBlock } from '@portabletext/types'
import type { SanityImageSource } from '@sanity/image-url'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'

// 圖片燈箱元件（完整無障礙支援）
const ImageLightbox = ({
  src,
  alt,
  onClose
}: {
  src: string
  alt: string
  onClose: () => void
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Handle keyboard events (Esc to close)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
    // Focus trap - keep focus on close button
    if (e.key === 'Tab') {
      e.preventDefault()
      closeButtonRef.current?.focus()
    }
  }, [onClose])

  useEffect(() => {
    // Store previous active element for focus restoration
    previousActiveElement.current = document.activeElement as HTMLElement

    // Prevent background scrolling
    document.body.style.overflow = 'hidden'

    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown)

    // Focus the close button on mount
    closeButtonRef.current?.focus()

    return () => {
      // Restore scrolling
      document.body.style.overflow = ''
      // Remove keyboard listener
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus
      previousActiveElement.current?.focus()
    }
  }, [handleKeyDown])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`圖片放大檢視：${alt}`}
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* 關閉按鈕 - 48px 觸控目標 (WCAG) */}
      <button
        ref={closeButtonRef}
        onClick={onClose}
        className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full w-12 h-12 flex items-center justify-center transition-colors z-10"
        aria-label="關閉圖片"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 圖片 */}
      <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        <Image
          src={src}
          alt={alt}
          width={1920}
          height={1920}
          className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
          quality={90}
        />
      </div>

      {/* 提示文字 */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
        點擊任意處或按 Esc 關閉
      </p>
    </div>
  )
}

// 自訂區塊元件
const CTABlock = ({ value }: { value: { title?: string; description?: string } }) => (
  <div className="my-8 p-6 bg-primary-light border-l-4 border-primary rounded-r-lg not-prose">
    <p className="font-medium text-gray-900 mb-1">{value.title || '需要行程規劃協助嗎？'}</p>
    <p className="text-gray-600 text-sm mb-3">{value.description || '免費諮詢，讓在地人幫你規劃最適合的行程'}</p>
    <Button href="https://line.me/R/ti/p/@037nyuwk" external size="sm">
      LINE 諮詢
    </Button>
  </div>
)

const ToursBlock = ({ value }: { value: { title?: string; tours?: Array<{ title: string; slug: { current: string }; excerpt?: string }> } }) => (
  <div className="my-12 p-6 bg-gradient-to-br from-primary-light to-primary/10 rounded-2xl not-prose">
    <h3 className="text-xl font-bold text-gray-900 mb-2">{value.title || '推薦行程'}</h3>
    <p className="text-gray-600 mb-6">精選適合親子的清邁行程，專車接送、中文溝通</p>
    {value.tours && value.tours.length > 0 && (
      <div className="grid gap-4 mb-6">
        {value.tours.map((tour) => (
          <Link
            key={tour.slug?.current}
            href={`/tours#${tour.slug?.current}`}
            className="block p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
          >
            <h4 className="font-medium text-gray-900">{tour.title}</h4>
            {tour.excerpt && <p className="text-sm text-gray-600">{tour.excerpt}</p>}
          </Link>
        ))}
      </div>
    )}
    <div className="text-center">
      <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
        LINE 免費諮詢
      </Button>
    </div>
  </div>
)

const TipBox = ({ value }: { value: { type?: string; content?: string } }) => {
  const styles = {
    tip: 'bg-blue-50 border-blue-400 text-blue-800',
    warning: 'bg-amber-50 border-amber-400 text-amber-800',
    success: 'bg-green-50 border-green-400 text-green-800',
    location: 'bg-purple-50 border-purple-400 text-purple-800',
  }
  const icons = {
    tip: '💡',
    warning: '⚠️',
    success: '✅',
    location: '📍',
  }
  const type = (value.type || 'tip') as keyof typeof styles

  return (
    <div className={`my-6 p-4 border-l-4 rounded-r-lg not-prose ${styles[type]}`}>
      <p className="flex items-start gap-2">
        <span>{icons[type]}</span>
        <span>{value.content}</span>
      </p>
    </div>
  )
}

const TableBlock = ({ value }: { value: { caption?: string; rows?: Array<{ cells?: string[]; isHeader?: boolean }> } }) => (
  <div className="my-8 overflow-x-auto not-prose">
    {value.caption && <p className="text-sm text-gray-600 mb-2">{value.caption}</p>}
    <table className="w-full border-collapse">
      <tbody>
        {value.rows?.map((row, rowIndex) => (
          <tr key={rowIndex} className={row.isHeader ? 'bg-gray-100' : ''}>
            {row.cells?.map((cell, cellIndex) => {
              const Tag = row.isHeader ? 'th' : 'td'
              return (
                <Tag
                  key={cellIndex}
                  className={`border border-gray-200 px-4 py-2 text-left ${
                    row.isHeader ? 'font-semibold' : ''
                  }`}
                >
                  {cell}
                </Tag>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

// 圖片區塊（直式圖限制寬度，支援點擊放大）
const ImageBlock = ({ value }: { value: { asset: SanityImageSource & { _ref?: string }; alt?: string; caption?: string } }) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)

  if (!value?.asset) return null

  const thumbnailUrl = urlFor(value)
    .width(800)
    .fit('max')
    .auto('format')
    .url()

  const fullSizeUrl = urlFor(value)
    .width(1920)
    .fit('max')
    .auto('format')
    .quality(90)
    .url()

  const altText = value.alt || '文章圖片'

  // 從 Sanity asset ref 判斷圖片比例（格式：image-{id}-{width}x{height}-{format}）
  const assetRef = (value.asset as { _ref?: string })?._ref || ''
  const dimensionMatch = assetRef.match(/-(\d+)x(\d+)-/)
  const detectedPortrait = dimensionMatch
    ? parseInt(dimensionMatch[2]) > parseInt(dimensionMatch[1])
    : false

  return (
    <>
      <figure className="my-10 not-prose">
        {/* 直式圖片限制寬度 50%，置中顯示 */}
        <div className={detectedPortrait ? 'flex justify-center' : ''}>
          <div
            className={`
              rounded-xl overflow-hidden shadow-md cursor-zoom-in hover:shadow-lg transition-shadow
              ${detectedPortrait ? 'w-full max-w-[50%] md:max-w-[40%]' : 'w-full'}
            `}
            onClick={() => setIsLightboxOpen(true)}
          >
            <Image
              src={thumbnailUrl}
              alt={altText}
              width={800}
              height={1200}
              className="w-full h-auto"
              sizes={detectedPortrait ? '(max-width: 768px) 50vw, 320px' : '(max-width: 768px) 100vw, 800px'}
              onLoad={(e) => {
                // 備用：圖片載入後檢測比例
                const img = e.target as HTMLImageElement
                if (img.naturalHeight > img.naturalWidth) {
                  setIsPortrait(true)
                }
              }}
            />
          </div>
        </div>
        {value.caption && (
          <figcaption className="text-center text-sm text-gray-600 mt-3 px-4 py-2 bg-gray-50 rounded-lg">
            📷 {value.caption}
          </figcaption>
        )}
        <p className="text-center text-xs text-gray-400 mt-1">
          {detectedPortrait || isPortrait ? '點擊查看完整圖片' : '點擊圖片放大'}
        </p>
      </figure>

      {/* 燈箱 */}
      {isLightboxOpen && (
        <ImageLightbox
          src={fullSizeUrl}
          alt={altText}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </>
  )
}

// 影片/GIF 區塊
const VideoBlock = ({ value }: { value: { url?: string; caption?: string; provider?: string } }) => {
  if (!value?.url) return null

  // 判斷是 Cloudflare Stream 還是一般影片連結
  const isCloudflare = value.url.includes('cloudflarestream.com') || value.url.includes('videodelivery.net')

  if (isCloudflare) {
    // Cloudflare Stream iframe
    const videoId = value.url.split('/').pop()?.replace('.m3u8', '') || ''
    return (
      <figure className="my-10 not-prose">
        <div className="rounded-xl overflow-hidden shadow-md aspect-video">
          <iframe
            src={`https://iframe.videodelivery.net/${videoId}`}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
        {value.caption && (
          <figcaption className="text-center text-sm text-gray-600 mt-3 px-4 py-2 bg-gray-50 rounded-b-lg">
            🎬 {value.caption}
          </figcaption>
        )}
      </figure>
    )
  }

  // 一般影片連結（YouTube 等）
  return (
    <figure className="my-10 not-prose">
      <div className="rounded-xl overflow-hidden shadow-md aspect-video">
        <iframe
          src={value.url}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
      {value.caption && (
        <figcaption className="text-center text-sm text-gray-600 mt-3 px-4 py-2 bg-gray-50 rounded-b-lg">
          🎬 {value.caption}
        </figcaption>
      )}
    </figure>
  )
}

// PortableText 元件設定
const components: PortableTextComponents = {
  types: {
    image: ImageBlock,
    videoBlock: VideoBlock,
    ctaBlock: CTABlock,
    toursBlock: ToursBlock,
    tipBox: TipBox,
    tableBlock: TableBlock,
  },
  block: {
    h2: ({ children }) => (
      <h2
        id={children?.toString().toLowerCase().replace(/\s+/g, '-')}
        className="scroll-mt-20 !mt-12 !mb-6 pb-2 border-b-2 border-primary/30"
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        id={children?.toString().toLowerCase().replace(/\s+/g, '-')}
        className="scroll-mt-20 !mt-8 !mb-4 pl-3 border-l-4 border-primary"
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => <h4 className="scroll-mt-20 !mt-6 !mb-3">{children}</h4>,
    normal: ({ children }) => (
      <p className="!mb-6 !leading-relaxed">{children}</p>
    ),
    blockquote: ({ children }) => (
      <blockquote className="!my-8 border-l-4 border-primary bg-primary-light/50 pl-6 pr-4 py-4 italic text-gray-700 rounded-r-lg">
        {children}
      </blockquote>
    ),
  },
  marks: {
    link: ({ children, value }) => {
      const href = value?.href || ''
      const isExternal = href.startsWith('http')

      if (isExternal) {
        return (
          <a
            href={href}
            target={value?.blank ? '_blank' : undefined}
            rel={value?.blank ? 'noopener noreferrer' : undefined}
            className="text-primary hover:underline"
          >
            {children}
          </a>
        )
      }

      return (
        <Link href={href} className="text-primary hover:underline">
          {children}
        </Link>
      )
    },
    highlight: ({ children }) => (
      <mark className="bg-yellow-200 px-1.5 py-0.5 rounded text-lg font-semibold">{children}</mark>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="list-disc pl-6 space-y-2">{children}</ul>,
    number: ({ children }) => <ol className="list-decimal pl-6 space-y-2">{children}</ol>,
  },
}

interface PortableTextRendererProps {
  content: PortableTextBlock[]
}

export default function PortableTextRenderer({ content }: PortableTextRendererProps) {
  if (!content) return null

  return (
    <div className="prose prose-lg max-w-none prose-headings:scroll-mt-20 prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-p:text-gray-700 prose-p:leading-8 prose-li:text-gray-700 prose-li:leading-7 prose-strong:text-gray-900">
      <PortableText value={content} components={components} />
    </div>
  )
}
