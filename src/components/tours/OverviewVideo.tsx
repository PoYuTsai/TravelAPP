// src/components/tours/OverviewVideo.tsx
'use client'

import { useState } from 'react'

interface OverviewVideoProps {
  src: string
  title?: string
}

export default function OverviewVideo({ src, title = '行程總覽' }: OverviewVideoProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <>
      {/* Video Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
        <p className="text-gray-600 mb-4 text-sm">點擊影片可全螢幕觀看</p>
        <div
          className="relative rounded-2xl overflow-hidden bg-gray-100 cursor-pointer group"
          onClick={() => setIsFullscreen(true)}
        >
          <video
            src={src}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-auto max-h-[70vh] object-contain mx-auto"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
              <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
            onClick={() => setIsFullscreen(false)}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Fullscreen video */}
          <video
            src={src}
            autoPlay
            loop
            muted
            playsInline
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Hint text */}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            點擊任意處關閉
          </p>
        </div>
      )}
    </>
  )
}
