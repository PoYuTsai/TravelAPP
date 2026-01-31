// src/components/tours/OverviewVideo.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface OverviewVideoProps {
  src: string
  title?: string
}

export default function OverviewVideo({ src, title = '行程總覽' }: OverviewVideoProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // Hide floating LINE button when lightbox is open
  const openFullscreen = () => {
    previousActiveElement.current = document.activeElement as HTMLElement
    setIsFullscreen(true)
    document.body.setAttribute('data-lightbox-open', 'true')
  }

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false)
    document.body.removeAttribute('data-lightbox-open')
    // Restore focus to previous element
    previousActiveElement.current?.focus()
  }, [])

  // Keyboard handling: Escape to close
  useEffect(() => {
    if (!isFullscreen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeFullscreen()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, closeFullscreen])

  // Focus trap: keep focus within modal
  useEffect(() => {
    if (!isFullscreen || !modalRef.current) return

    // Focus the close button when modal opens
    closeButtonRef.current?.focus()

    const modal = modalRef.current
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    modal.addEventListener('keydown', handleTabKey)
    return () => modal.removeEventListener('keydown', handleTabKey)
  }, [isFullscreen])

  return (
    <>
      {/* Video Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
        <p className="text-gray-600 mb-4 text-sm">點擊影片可全螢幕觀看</p>
        <div
          className="relative rounded-2xl overflow-hidden bg-gray-100 cursor-pointer group"
          onClick={openFullscreen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openFullscreen()
            }
          }}
          aria-label={`全螢幕觀看${title}`}
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
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${title}全螢幕播放`}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={closeFullscreen}
        >
          {/* Close button - 48px touch target for WCAG */}
          <button
            ref={closeButtonRef}
            className="absolute top-4 right-4 text-white/80 hover:text-white w-12 h-12 flex items-center justify-center z-10 rounded-full hover:bg-white/10 transition-colors"
            onClick={closeFullscreen}
            aria-label="關閉全螢幕"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Fullscreen video - clicking also closes */}
          <video
            src={src}
            autoPlay
            loop
            muted
            playsInline
            className="max-w-full max-h-full object-contain cursor-pointer"
          />

          {/* Hint text */}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            點擊任意處或按 Esc 關閉
          </p>
        </div>
      )}
    </>
  )
}
