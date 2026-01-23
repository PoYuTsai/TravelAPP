'use client'

import { useState } from 'react'
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
  location: string
  kids?: string
  content: string
  highlight: string
}

// Default testimonials - real-feeling reviews
const defaultTestimonials: Testimonial[] = [
  {
    name: '張媽媽',
    location: '台北',
    kids: '7歲 + 4歲',
    content: '原本很擔心帶兩個小孩出國會很累，結果完全不會！導遊姐姐超會照顧小孩，司機大哥開車也很穩。小孩吵著要上廁所或想休息，馬上就能調整行程，這是跟團完全做不到的。',
    highlight: '司機導遊分開服務真的差很多',
  },
  {
    name: 'Kevin 爸',
    location: '新竹',
    kids: '5歲',
    content: 'Eric 幫我們規劃的行程很適合小孩，不會一直拉車。大象營、叢林飛索都有安排，兒子玩到不想回家。重點是有中文導遊，溝通完全沒問題。',
    highlight: '行程客製化，小孩體力為主',
  },
  {
    name: '林小姐',
    location: '高雄',
    kids: '3歲 + 1歲',
    content: '帶一歲多的寶寶出國本來很猶豫，但 Min 說他們自己也有小孩，會準備安全座椅。實際體驗下來，車子很乾淨、冷氣舒服，寶寶在車上睡得很好。',
    highlight: '準備安全座椅，車子乾淨舒適',
  },
]

interface TestimonialsProps {
  testimonials?: Testimonial[]
}

export default function Testimonials({ testimonials = defaultTestimonials }: TestimonialsProps) {
  const [activeIndex, setActiveIndex] = useState(0)

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
            <div
              key={index}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative"
            >
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
                <p className="font-medium text-gray-900">{testimonial.name}</p>
                <p className="text-sm text-gray-500">
                  {testimonial.location}
                  {testimonial.kids && ` · 孩子 ${testimonial.kids}`}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: Carousel */}
        <div className="md:hidden">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 relative">
            <QuoteIcon className="absolute top-4 right-4 w-8 h-8 text-primary/20" />

            {/* Stars */}
            <div className="flex gap-0.5 mb-4">
              {[...Array(5)].map((_, i) => (
                <StarIcon key={i} className="w-4 h-4 text-yellow-400" />
              ))}
            </div>

            {/* Highlight */}
            <p className="font-medium text-gray-900 mb-3">
              「{testimonials[activeIndex].highlight}」
            </p>

            {/* Content */}
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              {testimonials[activeIndex].content}
            </p>

            {/* Author */}
            <div className="border-t border-gray-100 pt-4">
              <p className="font-medium text-gray-900">{testimonials[activeIndex].name}</p>
              <p className="text-sm text-gray-500">
                {testimonials[activeIndex].location}
                {testimonials[activeIndex].kids && ` · 孩子 ${testimonials[activeIndex].kids}`}
              </p>
            </div>
          </div>

          {/* Dots navigation */}
          <div className="flex justify-center gap-2 mt-4">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === activeIndex ? 'bg-primary' : 'bg-gray-300'
                }`}
                aria-label={`查看第 ${index + 1} 則評價`}
              />
            ))}
          </div>
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
