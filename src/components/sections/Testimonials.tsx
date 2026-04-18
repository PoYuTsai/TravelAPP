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

// Real customer reviews from Google (一字不漏，優先挑選親子相關評價)
const defaultTestimonials: Testimonial[] = [
  {
    name: '王婉蓉',
    location: '台灣',
    content: '整個服務非常的好…在詢問的時候就非常的細心而且很耐心的回覆，當天服務也非常到位，司機兼導遊中文非常好…會介紹清邁歷史和沿途風光，嬰兒座椅非常舒服安全讓小朋友坐上去…還能睡著多次😀😀尤其是車子很乾淨也有冷氣，真的非常好的體驗👍👍👍推薦大家來清邁可以找他們包車，價格含油錢我覺得非常合理😊…能按照你的需要調整行程，下次去清邁包車還會再光顧！！',
    highlight: '嬰兒座椅安全舒服，小朋友還能睡著',
    source: 'google',
  },
  {
    name: 'Sky',
    location: '台灣',
    kids: '2大2小',
    content: '我們1家4口，2+2第一次來清邁，選擇了包車+導遊服務，行程可以自由變動，很彈性且方便，導遊和司機都很親切～重點是小朋友都很開心！！大推👍👍',
    highlight: '重點是小朋友都很開心',
    source: 'google',
  },
  {
    name: 'Milu Jen',
    location: '台灣',
    kids: '6大2小',
    content: '6大2小清邁包車+導遊旅行，找清微省了很多時間與煩惱，有任何問題只要詢問，老闆阿裕都會認真解答～行程與用餐也會依據我們的需求給出建議，也能代訂位與訂票，我們的隨車導遊是小胖，很健談對各景點介紹詳細，對小朋友也很有耐心，當大人在化妝或拍照、按摩時，也願意陪伴他們真的很感謝！另外小胖也會依據我們的時間與景點狀況給出建議讓我們參考是否要調整，很感謝這趟旅行能有清微與小胖，讓大家渡過一個輕鬆快樂的年假！',
    highlight: '對小朋友很有耐心，大人放鬆時會陪伴孩子',
    source: 'google',
  },
  {
    name: 'Esun Chuang',
    location: '台灣',
    content: '第一次規劃清邁家族旅遊，很幸運的遇到了清微旅行，官方賴全程有中文客服即時回覆，行程上的安排非常流暢，導遊專業有耐心、司機和善親切，五天的家族旅遊十分順利、非常愉快…',
    highlight: '家族旅遊十分順利，導遊專業有耐心',
    source: 'google',
  },
  {
    name: '勞美美',
    location: '台灣',
    content: '這趟旅行真的要大力感謝郭姐和包車司機❤️一路上不只行程安排得很順，對孩子更是貼心到不行。我們大人和大哥哥姐姐出去玩時，會主動幫忙照顧最小的兩歲孩子，讓我們可以放心玩；孩子太累在車上睡著，也會陪著照顧，醒了再帶來找正在逛街的我們，真的超貼心！不論是帶小孩或長輩的家庭，都非常適合！郭姐和司機讓人超安心，推薦的景點、餐廳也都很棒，不論多晚在哪兒都能找到好吃又適合全家的地方，還幫忙預訂餐廳，預約任何行程！厲害的是導遊郭姐還會幫忙側拍好多照片影片，都好好看！這是一趟讓人留下滿滿美好回憶的旅程，真心大推✨',
    highlight: '主動照顧兩歲孩子，讓爸媽放心玩',
    source: 'google',
  },
  {
    name: '洪偉傑',
    location: '台灣',
    kids: '2大2小',
    content: '我們包車清萊一日遊，客製化的行程，雖然只有2大2小，仍然給我們一台11人座的麵包車，位置非常寬敞，價格公道，司機從頭到尾都非常親切有禮貌，給了我們一個很美好的包車體驗與旅程👍👍👍',
    highlight: '2大2小也給寬敞車型，價格公道',
    source: 'google',
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
          title="Google 五星真實評價"
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

        {/* Link to more reviews */}
        <div className="flex justify-center mt-8">
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
            <span>查看更多 Google 評價</span>
          </a>
        </div>
      </div>
    </section>
  )
}
