'use client'

import { useState, useRef } from 'react'
import { urlFor } from '@/sanity/client'

interface VideoPlayerProps {
  videoUrl: string
  poster?: any
  title?: string
  aspect?: 'landscape' | 'portrait' | 'square'
}

export default function VideoPlayer({
  videoUrl,
  poster,
  title,
  aspect = 'landscape',
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handlePlayClick = () => {
    if (videoRef.current) {
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  // Aspect ratio classes
  const aspectClasses = {
    portrait: 'aspect-[9/16]',
    landscape: 'aspect-video',
    square: 'aspect-square',
  }

  // Poster dimensions based on aspect
  const posterDimensions = {
    portrait: { width: 640, height: 1136 },
    landscape: { width: 1280, height: 720 },
    square: { width: 800, height: 800 },
  }

  const { width, height } = posterDimensions[aspect]

  return (
    <div className={`relative ${aspectClasses[aspect]} w-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-lg bg-gray-900`}>
      <video
        ref={videoRef}
        src={videoUrl}
        poster={poster ? urlFor(poster).width(width).height(height).url() : undefined}
        className="w-full h-full object-cover"
        playsInline
        controls={isPlaying}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        title={title}
      />

      {/* Play Button Overlay */}
      {!isPlaying && (
        <button
          onClick={handlePlayClick}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group cursor-pointer"
          aria-label={title ? `播放 ${title}` : '播放影片'}
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
  )
}
