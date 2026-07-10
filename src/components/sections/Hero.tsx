import Image from 'next/image'
import Button from '@/components/ui/Button'
import LineCTAButton from '@/components/ui/LineCTAButton'
import { urlFor } from '@/sanity/client'
import type { SanityImageSource } from '@sanity/image-url'
import { HOME_PUBLIC_COPY } from '@/lib/home-public-copy'

// Simple blur placeholder (light golden gradient matching brand)
const blurDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQRBQYSIRMxQWH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABYRAQEBAAAAAAAAAAAAAAAAAAABEf/aAAwDAQACEQMRAD8AotuXM19qN5cXEhmWOdkjQnpFXrgA/PtZpSlIr//Z'

interface HeroProps {
  backgroundImage?: { asset: SanityImageSource }
}

export default function Hero({
  backgroundImage,
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
          alt={HOME_PUBLIC_COPY.hero.imageAlt}
          fill
          sizes="100vw"
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
            {HOME_PUBLIC_COPY.hero.title}
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-2">
            {HOME_PUBLIC_COPY.hero.subtitle}
          </p>
          <p className="text-base text-gray-500 mb-6">
            {HOME_PUBLIC_COPY.hero.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <LineCTAButton location="Hero - Primary CTA">
              {HOME_PUBLIC_COPY.hero.primaryCta.text}
            </LineCTAButton>
            <Button
              href={HOME_PUBLIC_COPY.hero.secondaryCta.link}
              variant="outline"
              size="lg"
            >
              {HOME_PUBLIC_COPY.hero.secondaryCta.text}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
