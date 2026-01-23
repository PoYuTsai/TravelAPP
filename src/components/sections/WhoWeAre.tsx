'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { urlFor } from '@/sanity/client'

interface TrustPoint {
  text: string
}

interface WhoWeAreProps {
  videoUrl?: string
  videoPoster?: any
  videoAspect?: 'portrait' | 'landscape' | 'square' | 'responsive'
  title?: string
  subtitle?: string
  description?: string
  trustPoints?: TrustPoint[]
  storyLink?: string
  storyLinkText?: string
}

const defaultTrustPoints: TrustPoint[] = [
  { text: '媽媽在地 30 年，路線私房不踩雷' },
  { text: '爸爸懂台灣家庭，溝通零距離' },
  { text: '司機專心開車，導遊專心服務' },
]

export default function WhoWeAre({
  videoUrl,
  videoPoster,
  videoAspect = 'responsive',
  title = '嗨，我們是 Eric & Min',
  subtitle = '台灣爸爸 × 在地 30 年泰國媽媽',
  description = '帶著女兒 Miya，為親子家庭設計清邁旅程。',
  trustPoints = defaultTrustPoints,
  storyLink = '/blog/eric-story-taiwan-to-chiang-mai',
  storyLinkText = '閱讀我們的故事',
}: WhoWeAreProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handlePlayClick = () => {
    if (videoRef.current) {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  // Aspect ratio classes based on video type
  const aspectClasses = {
    portrait: 'aspect-[9/16] max-w-[260px] sm:max-w-[280px] md:max-w-[300px]',
    landscape: 'aspect-[16/9] max-w-[500px]',
    square: 'aspect-square max-w-[350px]',
    // Responsive: portrait on mobile, landscape on desktop
    responsive: 'aspect-[9/16] md:aspect-video max-w-[280px] md:max-w-[500px]',
  }

  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-white to-primary-light/20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
          {title}
        </h2>

        {/* Video Container */}
        {videoUrl && (
          <div className={`relative ${aspectClasses[videoAspect]} w-full mx-auto rounded-2xl overflow-hidden shadow-xl mb-8`}>
            <video
              ref={videoRef}
              src={videoUrl}
              poster={videoPoster ? urlFor(videoPoster).width(640).height(1136).url() : undefined}
              className="w-full h-full object-cover"
              playsInline
              controls={isPlaying}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Play Button Overlay */}
            {!isPlaying && (
              <button
                onClick={handlePlayClick}
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group cursor-pointer"
                aria-label="播放影片"
              >
                <div className="w-16 h-16 md:w-20 md:h-20 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <svg
                    className="w-8 h-8 md:w-10 md:h-10 text-primary ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Subtitle & Description */}
        <p className="text-lg md:text-xl font-medium text-gray-800 mb-2">
          {subtitle}
        </p>
        <p className="text-base md:text-lg text-gray-600 mb-8">
          {description}
        </p>

        {/* Trust Points */}
        {trustPoints && trustPoints.length > 0 && (
          <div className="space-y-3 mb-8">
            {trustPoints.map((point, i) => (
              <div key={i} className="flex items-center justify-center gap-2 text-gray-700">
                <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{point.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Story Link */}
        {storyLink && (
          <Link
            href={storyLink}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium px-6 py-3 rounded-full transition-colors group"
          >
            {storyLinkText}
            <svg
              className="w-5 h-5 transform transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        )}
      </div>
    </section>
  )
}
