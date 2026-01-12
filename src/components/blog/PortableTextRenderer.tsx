'use client'

import { PortableText, PortableTextComponents } from '@portabletext/react'
import Image from 'next/image'
import Link from 'next/link'
import { urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'

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

// 圖片區塊
const ImageBlock = ({ value }: { value: { asset: any; alt?: string; caption?: string } }) => {
  if (!value?.asset) return null

  return (
    <figure className="my-8">
      <div className="rounded-lg overflow-hidden">
        <Image
          src={urlFor(value).width(1200).url()}
          alt={value.alt || '文章圖片'}
          width={1200}
          height={800}
          className="w-full h-auto"
        />
      </div>
      {value.caption && (
        <figcaption className="text-center text-sm text-gray-500 mt-2">
          {value.caption}
        </figcaption>
      )}
    </figure>
  )
}

// PortableText 元件設定
const components: PortableTextComponents = {
  types: {
    image: ImageBlock,
    ctaBlock: CTABlock,
    toursBlock: ToursBlock,
    tipBox: TipBox,
    tableBlock: TableBlock,
  },
  block: {
    h2: ({ children }) => (
      <h2 id={children?.toString().toLowerCase().replace(/\s+/g, '-')} className="scroll-mt-20">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 id={children?.toString().toLowerCase().replace(/\s+/g, '-')} className="scroll-mt-20">
        {children}
      </h3>
    ),
    h4: ({ children }) => <h4 className="scroll-mt-20">{children}</h4>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary pl-4 italic text-gray-700">
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
      <mark className="bg-yellow-200 px-1">{children}</mark>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="list-disc pl-6 space-y-2">{children}</ul>,
    number: ({ children }) => <ol className="list-decimal pl-6 space-y-2">{children}</ol>,
  },
}

interface PortableTextRendererProps {
  content: any[]
}

export default function PortableTextRenderer({ content }: PortableTextRendererProps) {
  if (!content) return null

  return (
    <div className="prose prose-lg max-w-none prose-headings:scroll-mt-20 prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg">
      <PortableText value={content} components={components} />
    </div>
  )
}
