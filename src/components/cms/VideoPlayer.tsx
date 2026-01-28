'use client'

import { useRef, useCallback } from 'react'
import { urlFor } from '@/sanity/client'
import { trackVideoPlay, trackVideoProgress, trackVideoComplete } from '@/lib/analytics'

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
  // 追蹤已記錄的里程碑，避免重複觸發
  const trackedMilestones = useRef<Set<25 | 50 | 75>>(new Set())
  const hasStarted = useRef(false)

  const handlePlay = useCallback(() => {
    if (!hasStarted.current) {
      hasStarted.current = true
      trackVideoPlay(title || '未命名影片', videoUrl)
    }
  }, [title, videoUrl])

  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget
    if (!video.duration) return

    const percent = (video.currentTime / video.duration) * 100
    const milestones: (25 | 50 | 75)[] = [25, 50, 75]

    for (const milestone of milestones) {
      if (percent >= milestone && !trackedMilestones.current.has(milestone)) {
        trackedMilestones.current.add(milestone)
        trackVideoProgress(title || '未命名影片', milestone)
      }
    }
  }, [title])

  const handleEnded = useCallback(() => {
    trackVideoComplete(title || '未命名影片')
  }, [title])
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
        onPlay={handlePlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      >
        <source src={videoUrl} type="video/mp4" />
        您的瀏覽器不支援影片播放
      </video>
    </div>
  )
}
