'use client'

import { urlFor } from '@/sanity/client'

interface VideoPlayerProps {
  videoUrl: string
  poster?: any
  title?: string
  aspect?: 'landscape' | 'portrait' | 'square' | 'responsive'
}

export default function VideoPlayer({
  videoUrl,
  poster,
  title,
  aspect = 'landscape',
}: VideoPlayerProps) {
  // Aspect ratio classes
  const aspectClasses = {
    portrait: 'aspect-[9/16]',
    landscape: 'aspect-video',
    square: 'aspect-square',
    // Responsive: portrait on mobile, landscape on desktop
    responsive: 'aspect-[9/16] md:aspect-video',
  }

  // Container max-width classes
  const containerClasses = {
    portrait: 'max-w-sm',
    landscape: 'max-w-4xl',
    square: 'max-w-2xl',
    // Responsive: smaller on mobile (portrait), wider on desktop (landscape)
    responsive: 'max-w-sm md:max-w-4xl',
  }

  // Poster dimensions based on aspect (use landscape for responsive)
  const posterDimensions = {
    portrait: { width: 640, height: 1136 },
    landscape: { width: 1280, height: 720 },
    square: { width: 800, height: 800 },
    responsive: { width: 1280, height: 720 },
  }

  const { width, height } = posterDimensions[aspect]
  const posterUrl = poster ? urlFor(poster).width(width).height(height).url() : undefined

  // Use native video controls for maximum iOS compatibility
  return (
    <div className={`relative ${aspectClasses[aspect]} w-full ${containerClasses[aspect]} mx-auto rounded-xl overflow-hidden shadow-lg bg-gray-900`}>
      <video
        src={videoUrl}
        poster={posterUrl}
        className="w-full h-full object-cover"
        controls
        playsInline
        preload="metadata"
        title={title}
      >
        <source src={videoUrl} type="video/mp4" />
        您的瀏覽器不支援影片播放
      </video>
    </div>
  )
}
