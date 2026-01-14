import Image from 'next/image'
import Link from 'next/link'
import { urlFor } from '@/sanity/client'
import type { SanityImageSource } from '@sanity/image-url'

interface ServiceCardProps {
  image?: {
    asset: SanityImageSource
    alt?: string
  }
  title: string
  subtitle?: string
  features: string[]
  price?: string
  ctaText: string
  ctaLink: string
}

export default function ServiceCard({
  image,
  title,
  subtitle,
  features,
  price,
  ctaText,
  ctaLink,
}: ServiceCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      {/* Image */}
      <div className="relative h-48 md:h-56 bg-gradient-to-br from-primary-light to-primary/30">
        {image?.asset ? (
          <Image
            src={urlFor(image.asset).width(600).height(400).url()}
            alt={image.alt || title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-6xl">
              {title.includes('包車') ? '🚐' : '🏠'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-1">{title}</h3>
        {subtitle && (
          <p className="text-sm text-gray-500 mb-4">{subtitle}</p>
        )}

        <ul className="space-y-2 mb-4">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-gray-600">
              <span className="text-primary mt-0.5">✓</span>
              {feature}
            </li>
          ))}
        </ul>

        {price && (
          <p className="text-lg font-bold text-primary mb-4">{price}</p>
        )}

        <Link
          href={ctaLink}
          className="block w-full text-center border-2 border-primary text-primary hover:bg-primary hover:text-black px-6 py-2 rounded-full font-medium transition-colors"
        >
          {ctaText}
        </Link>
      </div>
    </div>
  )
}
