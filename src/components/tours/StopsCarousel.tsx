// src/components/tours/StopsCarousel.tsx
'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import useEmblaCarousel from 'embla-carousel-react'
import { urlFor } from '@/sanity/client'

interface Stop {
  emoji?: string
  name: string
  description?: string
  image?: any
}

interface StopsCarouselProps {
  stops: Stop[]
}

export default function StopsCarousel({ stops }: StopsCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true })
  const [selectedIndex, setSelectedIndex] = useState(0)

  const scrollTo = useCallback(
    (index: number) => emblaApi && emblaApi.scrollTo(index),
    [emblaApi]
  )

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext()
  }, [emblaApi])

  // Filter stops with images for the carousel
  const stopsWithImages = stops.filter((stop) => stop.image)
  const currentStop = stops[selectedIndex] || stops[0]

  if (stopsWithImages.length === 0) {
    // Fallback to simple list if no images
    return (
      <div className="space-y-4">
        {stops.map((stop, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center gap-3 mb-2">
              {stop.emoji && <span className="text-2xl">{stop.emoji}</span>}
              <h3 className="text-lg font-semibold text-gray-900">{stop.name}</h3>
            </div>
            {stop.description && (
              <p className="text-gray-600">{stop.description}</p>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Carousel */}
      <div className="relative">
        {/* Main Carousel */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {stops.map((stop, i) => (
              <div key={i} className="flex-[0_0_100%] min-w-0">
                {/* Image only - no overlay */}
                <div className="relative aspect-[16/10] bg-gray-100 rounded-t-2xl overflow-hidden">
                  {stop.image ? (
                    <Image
                      src={urlFor(stop.image).width(1200).height(750).url()}
                      alt={stop.image.alt || stop.name}
                      fill
                      className="object-cover"
                      priority={i === 0}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-light to-primary/20">
                      <span className="text-6xl">{stop.emoji || '🌿'}</span>
                    </div>
                  )}
                </div>
                {/* Text below image */}
                <div className="bg-white border border-t-0 border-gray-100 rounded-b-2xl p-4 md:p-5">
                  <div className="flex items-center gap-2 mb-2">
                    {stop.emoji && <span className="text-2xl">{stop.emoji}</span>}
                    <h3 className="text-lg md:text-xl font-bold text-gray-900">{stop.name}</h3>
                  </div>
                  {stop.description && (
                    <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                      {stop.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Arrows - 44px touch target for WCAG */}
        <button
          onClick={scrollPrev}
          className="absolute left-3 top-[28%] -translate-y-1/2 w-11 h-11 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors z-10"
          aria-label="上一張"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={scrollNext}
          className="absolute right-3 top-[28%] -translate-y-1/2 w-11 h-11 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors z-10"
          aria-label="下一張"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Thumbnail Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {stops.map((stop, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            className={`flex-shrink-0 relative rounded-lg overflow-hidden transition-all ${
              selectedIndex === i
                ? 'ring-2 ring-primary ring-offset-2'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            <div className="w-20 h-14 md:w-24 md:h-16 relative">
              {stop.image ? (
                <Image
                  src={urlFor(stop.image).width(200).height(140).url()}
                  alt={stop.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                  <span className="text-lg">{stop.emoji || '🌿'}</span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Dots Indicator (mobile) - 44px touch target for WCAG */}
      <div className="flex justify-center gap-1 md:hidden">
        {stops.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            className="w-11 h-11 flex items-center justify-center"
            aria-label={`前往第 ${i + 1} 張`}
          >
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                selectedIndex === i ? 'bg-primary' : 'bg-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
