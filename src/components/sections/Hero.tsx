import Image from 'next/image'
import Button from '@/components/ui/Button'
import { urlFor } from '@/sanity/client'
import type { SanityImageSource } from '@sanity/image-url'

// Simple blur placeholder (light golden gradient matching brand)
const blurDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQRBQYSIRMxQWH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABYRAQEBAAAAAAAAAAAAAAAAAAABEf/aAAwDAQACEQMRAD8AotuXM19qN5cXEhmWOdkjQnpFXrgA/PtZpSlIr//Z'

// Default values - Brand: Eric & Min 強調家庭定位
const defaults = {
  title: '清邁親子包車，交給 Eric & Min',
  subtitle: '台灣爸爸 × 在地 30 年泰國媽媽，住在清邁的真實家庭',
  description: '司機導遊分開服務，不趕路、不跟團，專為爸媽設計的包車旅程',
  primaryCta: { text: 'LINE 聊聊你的清邁計畫', link: 'https://line.me/R/ti/p/@037nyuwk' },
  secondaryCta: { text: '看行程案例', link: '/tours' },
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
    ? urlFor(backgroundImage.asset).width(1920).height(960).url()
    : '/images/hero-bg.webp'

  return (
    <section className="relative">
      {/* Hero Image */}
      <div className="relative w-full aspect-[2/1] bg-primary-light">
        <Image
          src={heroImageSrc}
          alt={backgroundImage?.alt || '清微旅行 - 清邁親子包車'}
          fill
          className="object-cover object-center"
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
