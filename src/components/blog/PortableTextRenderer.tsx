'use client'

import { PortableText, type PortableTextComponents } from '@portabletext/react'
import type { PortableTextBlock } from '@portabletext/types'
import type { SanityImageSource } from '@sanity/image-url'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'
import LineCTAButton from '@/components/ui/LineCTAButton'

const ImageLightbox = ({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        closeButtonRef.current?.focus()
      }
    },
    [onClose]
  )

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
      previousActiveElement.current?.focus()
    }
  }, [handleKeyDown])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`檢視圖片：${alt}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        ref={closeButtonRef}
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
        aria-label="關閉圖片"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="relative max-h-full max-w-full">
        <Image
          src={src}
          alt={alt}
          width={1920}
          height={1920}
          className="h-auto max-h-[90vh] w-auto max-w-full object-contain"
          quality={90}
        />
      </div>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
        按下 `Esc` 可關閉
      </p>
    </div>
  )
}

const CTABlock = ({ value }: { value: { title?: string; description?: string } }) => (
  <div className="my-10 rounded-[28px] border border-amber-100 bg-amber-50 px-6 py-6 not-prose shadow-[0_24px_70px_-50px_rgba(0,0,0,0.25)]">
    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">Need Help</p>
    <h3 className="mt-2 text-2xl font-bold text-stone-900">
      {value.title || '如果你想把文章內容變成實際行程，現在就可以開始'}
    </h3>
    <p className="mt-3 text-sm leading-7 text-stone-600">
      {value.description || '把日期、人數或想去的地方傳來，我們會先幫你看怎麼排比較順。'}
    </p>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
      <LineCTAButton location="PortableText CTA Block" size="sm">
        LINE 直接聊清邁行程
      </LineCTAButton>
      <Button href="/tours" variant="outline" size="sm">
        先看行程案例
      </Button>
    </div>
  </div>
)

const ToursBlock = ({
  value,
}: {
  value: {
    title?: string
    tours?: Array<{ title: string; slug: { current: string }; excerpt?: string }>
  }
}) => (
  <div className="my-12 rounded-[28px] bg-gradient-to-br from-primary-light to-primary/10 p-6 not-prose shadow-[0_24px_70px_-50px_rgba(0,0,0,0.25)]">
    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">Suggested Tours</p>
    <h3 className="mt-2 text-2xl font-bold text-stone-900">{value.title || '可以一起參考的行程'}</h3>
    <p className="mt-3 text-sm leading-7 text-stone-600">
      如果你看完文章已經開始想像實際怎麼玩，下面這幾個行程會是很好銜接的下一步。
    </p>
    {value.tours && value.tours.length > 0 && (
      <div className="mb-6 mt-6 grid gap-4">
        {value.tours.map((tour) => (
          <Link
            key={tour.slug?.current}
            href={`/tours/${tour.slug?.current}`}
            className="block rounded-2xl bg-white p-4 transition-shadow hover:shadow-md"
          >
            <h4 className="font-medium text-gray-900">{tour.title}</h4>
            {tour.excerpt && <p className="mt-1 text-sm leading-6 text-gray-600">{tour.excerpt}</p>}
          </Link>
        ))}
      </div>
    )}
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
      <Button href="/tours" size="lg">
        看更多行程案例
      </Button>
      <LineCTAButton location="PortableText Tours Block" variant="outline" size="lg">
        LINE 問適合怎麼排
      </LineCTAButton>
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
    <div className={`my-6 rounded-r-lg border-l-4 p-4 not-prose ${styles[type]}`}>
      <p className="flex items-start gap-2">
        <span>{icons[type]}</span>
        <span>{value.content}</span>
      </p>
    </div>
  )
}

const TableBlock = ({
  value,
}: {
  value: { caption?: string; rows?: Array<{ cells?: string[]; isHeader?: boolean }> }
}) => (
  <div className="my-8 overflow-x-auto not-prose -mx-4 px-4 md:mx-0 md:px-0">
    {value.caption && <p className="mb-2 text-sm text-gray-600">{value.caption}</p>}
    <table className="min-w-[400px] w-full border-collapse text-sm md:text-base">
      <tbody>
        {value.rows?.map((row, rowIndex) => (
          <tr key={rowIndex} className={row.isHeader ? 'bg-gray-100' : ''}>
            {row.cells?.map((cell, cellIndex) => {
              const Tag = row.isHeader ? 'th' : 'td'
              return (
                <Tag
                  key={cellIndex}
                  className={`border border-gray-200 px-3 py-2 text-left md:px-4 ${
                    row.isHeader ? 'whitespace-nowrap font-semibold' : ''
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

const ImageBlock = ({
  value,
}: {
  value: { asset: SanityImageSource & { _ref?: string }; alt?: string; caption?: string }
}) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)

  if (!value?.asset) return null

  const thumbnailUrl = urlFor(value).width(800).fit('max').auto('format').url()
  const fullSizeUrl = urlFor(value).width(1920).fit('max').auto('format').quality(90).url()
  const altText = value.alt || '文章圖片'

  const assetRef = (value.asset as { _ref?: string })?._ref || ''
  const dimensionMatch = assetRef.match(/-(\d+)x(\d+)-/)
  const detectedPortrait = dimensionMatch
    ? parseInt(dimensionMatch[2], 10) > parseInt(dimensionMatch[1], 10)
    : false

  return (
    <>
      <figure className="my-10 not-prose">
        <div className={detectedPortrait ? 'flex justify-center' : ''}>
          <div
            className={`cursor-zoom-in overflow-hidden rounded-xl shadow-md transition-shadow hover:shadow-lg ${
              detectedPortrait ? 'w-full max-w-[50%] md:max-w-[40%]' : 'w-full'
            }`}
            onClick={() => setIsLightboxOpen(true)}
          >
            <Image
              src={thumbnailUrl}
              alt={altText}
              width={800}
              height={1200}
              className="h-auto w-full"
              sizes={detectedPortrait ? '(max-width: 768px) 50vw, 320px' : '(max-width: 768px) 100vw, 800px'}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement
                if (img.naturalHeight > img.naturalWidth) {
                  setIsPortrait(true)
                }
              }}
            />
          </div>
        </div>
        {value.caption && (
          <figcaption className="mt-3 rounded-lg bg-gray-50 px-4 py-2 text-center text-sm text-gray-600">
            📷 {value.caption}
          </figcaption>
        )}
        <p className="mt-1 text-center text-xs text-gray-400">
          {detectedPortrait || isPortrait ? '點擊查看完整直式圖片' : '點擊查看完整圖片'}
        </p>
      </figure>

      {isLightboxOpen && (
        <ImageLightbox src={fullSizeUrl} alt={altText} onClose={() => setIsLightboxOpen(false)} />
      )}
    </>
  )
}

const VideoBlock = ({
  value,
}: {
  value: { url?: string; caption?: string; provider?: string; posterTime?: number }
}) => {
  if (!value?.url) return null

  const isCloudflare =
    value.url.includes('cloudflarestream.com') || value.url.includes('videodelivery.net')
  const isDirectVideo =
    value.url.includes('.mp4') ||
    value.url.includes('.webm') ||
    value.url.includes('.mov') ||
    value.url.includes('cloudinary.com')

  if (isCloudflare) {
    const videoId = value.url.split('/').pop()?.replace('.m3u8', '') || ''
    return (
      <figure className="my-10 not-prose">
        <div className="aspect-video overflow-hidden rounded-xl shadow-md">
          <iframe
            src={`https://iframe.videodelivery.net/${videoId}`}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
        {value.caption && (
          <figcaption className="mt-3 rounded-b-lg bg-gray-50 px-4 py-2 text-center text-sm text-gray-600">
            🎬 {value.caption}
          </figcaption>
        )}
      </figure>
    )
  }

  if (isDirectVideo) {
    const isCloudinary = value.url.includes('cloudinary.com')
    const timeParam = value.posterTime !== undefined ? `so_${value.posterTime}` : 'so_auto'
    const posterUrl = isCloudinary
      ? value.url.replace('/upload/', `/upload/${timeParam}/`).replace(/\.(mp4|webm|mov)$/i, '.jpg')
      : undefined

    return (
      <figure className="my-10 not-prose">
        <div className="overflow-hidden rounded-xl bg-gray-900 shadow-md">
          <video
            src={value.url}
            poster={posterUrl}
            controls
            playsInline
            preload="metadata"
            className="h-auto max-h-[70vh] w-full"
          >
            <source src={value.url} type="video/mp4" />
            你的瀏覽器不支援影片播放。
          </video>
        </div>
        {value.caption && (
          <figcaption className="mt-3 rounded-lg bg-gray-50 px-4 py-2 text-center text-sm text-gray-600">
            🎬 {value.caption}
          </figcaption>
        )}
      </figure>
    )
  }

  return (
    <figure className="my-10 not-prose">
      <div className="aspect-video overflow-hidden rounded-xl shadow-md">
        <iframe
          src={value.url}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
      {value.caption && (
        <figcaption className="mt-3 rounded-b-lg bg-gray-50 px-4 py-2 text-center text-sm text-gray-600">
          🎬 {value.caption}
        </figcaption>
      )}
    </figure>
  )
}

function getPlainText(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(getPlainText).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    const child = children as { props?: { children?: ReactNode } }
    return getPlainText(child.props?.children)
  }
  return ''
}

function createHeadingId(children: ReactNode) {
  const text = getPlainText(children).trim()
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/gi, '')
    .replace(/\s+/g, '-')

  return normalized || 'section-heading'
}

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
        id={createHeadingId(children)}
        className="scroll-mt-20 !mb-6 !mt-12 border-b-2 border-primary/30 pb-2"
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        id={createHeadingId(children)}
        className="scroll-mt-20 !mb-4 !mt-8 border-l-4 border-primary pl-3"
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => <h4 className="scroll-mt-20 !mb-3 !mt-6">{children}</h4>,
    normal: ({ children }) => <p className="!mb-6 !leading-relaxed">{children}</p>,
    blockquote: ({ children }) => (
      <blockquote className="!my-8 rounded-r-lg border-l-4 border-primary bg-primary-light/50 py-4 pl-6 pr-4 italic text-gray-700">
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
      <mark className="rounded bg-yellow-200 px-1.5 py-0.5 text-lg font-semibold">{children}</mark>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="list-disc space-y-2 pl-6">{children}</ul>,
    number: ({ children }) => <ol className="list-decimal space-y-2 pl-6">{children}</ol>,
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
