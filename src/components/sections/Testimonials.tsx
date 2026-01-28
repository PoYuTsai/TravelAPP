'use client'

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import SectionTitle from '@/components/ui/SectionTitle'

// Star icon
function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}

// Quote icon
function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
    </svg>
  )
}

interface Testimonial {
  name: string
  location?: string
  kids?: string
  content: string
  highlight: string
  source?: 'facebook' | 'google'
}

// Real Facebook reviews - actual customer feedback from FB page
const defaultTestimonials: Testimonial[] = [
  {
    name: '王薪驊',
    location: '台灣',
    content: '地陪跟司機人都超好的，親力親為，也超有耐心，真心推薦！',
    highlight: '親力親為，超有耐心',
    source: 'facebook',
  },
  {
    name: 'Vicky Lin',
    location: '台灣',
    content: '從行前的討論安排，都很細心，都能中文溝通完全不用擔心，還有中文解說的導遊，很盡責喔！全程陪伴走完解說不會到點了就把大家放生，超 nice，推推～',
    highlight: '中文溝通完全不用擔心',
    source: 'facebook',
  },
  {
    name: 'Lily Chen',
    location: '台灣',
    content: '行前很有耐心的討論行程，老闆和老闆娘還邀約我們吃飯，很貼心的服務，值得推薦哦！',
    highlight: '貼心服務，值得推薦',
    source: 'facebook',
  },
]

interface TestimonialsProps {
  testimonials?: Testimonial[]
}

export default function Testimonials({ testimonials = defaultTestimonials }: TestimonialsProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'center',
  })
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

  // Testimonial card component
  const TestimonialCard = ({ testimonial }: { testimonial: Testimonial }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative h-full">
      <QuoteIcon className="absolute top-4 right-4 w-8 h-8 text-primary/20" />

      {/* Stars */}
      <div className="flex gap-0.5 mb-4">
        {[...Array(5)].map((_, i) => (
          <StarIcon key={i} className="w-4 h-4 text-yellow-400" />
        ))}
      </div>

      {/* Highlight */}
      <p className="font-medium text-gray-900 mb-3">
        「{testimonial.highlight}」
      </p>

      {/* Content */}
      <p className="text-gray-600 text-sm leading-relaxed mb-4">
        {testimonial.content}
      </p>

      {/* Author */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">{testimonial.name}</p>
            <p className="text-sm text-gray-500">
              {testimonial.location}
              {testimonial.kids && ` · ${testimonial.kids}`}
            </p>
          </div>
          {testimonial.source === 'facebook' && (
            <svg className="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="家庭真實回饋"
          subtitle="聽聽其他爸媽怎麼說"
        />

        {/* Desktop: Grid view */}
        <div className="hidden md:grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={index} testimonial={testimonial} />
          ))}
        </div>

        {/* Mobile: Embla Carousel with swipe */}
        <div className="md:hidden" role="region" aria-label="客戶評價輪播">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="flex-[0_0_100%] min-w-0 px-2">
                  <TestimonialCard testimonial={testimonial} />
                </div>
              ))}
            </div>
          </div>

          {/* Navigation arrows (mobile) */}
          <div className="flex justify-center gap-4 mt-4">
            <button
              onClick={scrollPrev}
              className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
              aria-label="上一則"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={scrollNext}
              className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
              aria-label="下一則"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Dots navigation with swipe hint - 44px touch target per WCAG */}
          <div className="flex justify-center items-center gap-0 mt-3">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollTo(index)}
                className="w-11 h-11 flex items-center justify-center"
                aria-label={`查看第 ${index + 1} 則評價`}
              >
                <span
                  className={`rounded-full transition-all ${
                    index === selectedIndex
                      ? 'bg-primary w-6 h-2.5'
                      : 'bg-gray-300 hover:bg-gray-400 w-2.5 h-2.5'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">← 左右滑動查看更多 →</p>
        </div>

        {/* Link to more reviews */}
        <div className="text-center mt-8">
          <a
            href="https://www.facebook.com/profile.php?id=61569067776768&sk=reviews"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium text-sm transition-colors"
          >
            <span>查看更多 Facebook 評價</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}
