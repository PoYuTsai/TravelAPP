'use client'

import { useState } from 'react'
import Image from 'next/image'

interface YouTubeEmbedProps {
  videoId: string
  title?: string
}

export default function YouTubeEmbed({ videoId, title = '影片' }: YouTubeEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  if (!videoId) return null

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

  if (!isLoaded) {
    return (
      <div className="relative aspect-video w-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-lg">
        <button
          onClick={() => setIsLoaded(true)}
          className="absolute inset-0 w-full h-full group cursor-pointer"
          aria-label={`播放 ${title}`}
        >
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 md:w-10 md:h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="relative aspect-video w-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-lg">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}
