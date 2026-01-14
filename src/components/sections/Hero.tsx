import Image from 'next/image'
import Button from '@/components/ui/Button'
import { urlFor } from '@/sanity/client'
import type { SanityImageSource } from '@sanity/image-url'

// Simple blur placeholder (light golden gradient matching brand)
const blurDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQRBQYSIRMxQWH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABYRAQEBAAAAAAAAAAAAAAAAAAABEf/aAAwDAQACEQMRAD8AotuXM19qN5cXEhmWOdkjQnpFXrgA/PtZpSlIr//Z'

// Default values
const defaults = {
  title: '清邁親子自由行',
  subtitle: '在地家庭經營，專為爸媽設計的旅程',
  description: 'Eric & Min，住在清邁的台泰夫妻，我們也有女兒，懂爸媽帶小孩出遊的需求',
  primaryCta: { text: 'LINE 免費諮詢', link: 'https://line.me/R/ti/p/@037nyuwk' },
  secondaryCta: { text: '瀏覽服務', link: '/services/car-charter' },
}

interface HeroProps {
  backgroundImage?: { asset: SanityImageSource; alt?: string }
  title?: string
  subtitle?: string
  description?: string
  primaryCta?: { text?: string; link?: string }
  secondaryCta?: { text?: string; link?: string }
}

export default function Hero({
  backgroundImage,
  title = defaults.title,
  subtitle = defaults.subtitle,
  description = defaults.description,
  primaryCta,
  secondaryCta,
}: HeroProps) {
  const heroImageSrc = backgroundImage?.asset
    ? urlFor(backgroundImage.asset).width(1920).height(823).url()
    : '/images/hero-bg.webp'

  return (
    <section className="relative">
      {/* Hero Image */}
      <div className="relative w-full aspect-[21/9] bg-primary-light">
        <Image
          src={heroImageSrc}
          alt={backgroundImage?.alt || '清微旅行 - 清邁親子包車自由行'}
          fill
          className="object-cover object-top"
          priority
          placeholder="blur"
          blurDataURL={blurDataURL}
        />
      </div>

      {/* CTA Section */}
      <div className="bg-white py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
            {title}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-2">
            {subtitle}
          </p>
          <p className="text-base text-gray-500 mb-6">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              href={primaryCta?.link || defaults.primaryCta.link}
              external={primaryCta?.link?.startsWith('http')}
              size="lg"
            >
              {primaryCta?.text || defaults.primaryCta.text}
            </Button>
            <Button
              href={secondaryCta?.link || defaults.secondaryCta.link}
              variant="outline"
              size="lg"
            >
              {secondaryCta?.text || defaults.secondaryCta.text}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
