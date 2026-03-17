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

// Real customer reviews from Facebook and Google (一字不漏)
const defaultTestimonials: Testimonial[] = [
  // Google Reviews
  {
    name: '魏文陽',
    location: '台灣',
    content: '第一次安排清邁自由行～行程排好後發現有幾天行程較遠需要包車上網找到微清旅行～包車含油12小時價格算偏高一點點，但有問題詢問老闆阿裕都能即時回覆親切，很快就敲定時間預約，安排去清萊的導遊郭姐也很熱情介紹當地文化景點，想要朝聖的餐廳訂位也可幫忙預訂，因為是自己安排的行程第一次造訪有些景點時間沒抓好較可惜停留時間不夠，基本上都蠻彈性的可以討論，老闆也會有建議的方向想法，有機會再次深度造訪清邁！！',
    highlight: '即時回覆，彈性討論',
    source: 'google',
  },
  {
    name: 'Lu Lu',
    location: '台灣',
    content: '可以提供中文溝通、服務貼心，更棒的是有提供汽車座椅，這個服務在清邁少有。',
    highlight: '有提供汽車座椅',
    source: 'google',
  },
  {
    name: 'Tsai Wei Wei',
    location: '台灣',
    content: '這次清邁郊區有包車三天，都開車大概一小時可到，第一天司機大哥人很好，雖然語言不通但很努力用翻譯跟我們溝通，開車也很小心謹慎。二、三天是開朗活潑會講中文的J導遊小姐帶我們遊玩，除了事前規劃的行程，中間有想去哪，J導遊都會給我們建議和安排，也很自由的帶我們去。這趟清邁旅遊真的是很美好😊',
    highlight: '導遊開朗活潑，行程自由',
    source: 'google',
  },
  // Facebook Reviews (最新 3 則，一字不漏)
  {
    name: '王薪驊',
    location: '台灣',
    content: '地陪跟司機人都超好的，親力親為，也超有耐心，真心推薦！',
    highlight: '親力親為，超有耐心',
    source: 'facebook',
  },
  {
    name: 'Feather Chin',
    location: '台灣',
    content: '值得推薦的包車旅遊～地陪親力親為～很貼心和很棒～如果下次朋友要來玩一定會推薦你們家的包車行程。',
    highlight: '值得推薦，很貼心',
    source: 'facebook',
  },
  {
    name: 'Vicky Lin',
    location: '台灣',
    content: '從行前的討論安排，都很細心，都能中文溝通完全不用擔心，還有中文解說的導遊，很盡責喔！全程陪伴走完解說不會到點了就把大家放生，超nice，推推～',
    highlight: '中文溝通完全不用擔心',
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
          {testimonial.source === 'google' && (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
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

        {/* Desktop: Grid view - 3 columns, 2 rows */}
        <div className="hidden md:grid md:grid-cols-3 gap-6">
          {testimonials.slice(0, 6).map((testimonial, index) => (
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

        {/* Links to more reviews */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
          <a
            href="https://maps.app.goo.gl/8MbRV4PPBggwj2pF6"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Google 評價</span>
          </a>
          <span className="hidden sm:block text-gray-300">|</span>
          <a
            href="https://www.facebook.com/profile.php?id=61569067776768&sk=reviews"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span>Facebook 評價</span>
          </a>
        </div>
      </div>
    </section>
  )
}
