'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { urlFor } from '@/sanity/client'
import type { SanityImageSource } from '@sanity/image-url'

interface RoomCard {
  asset: SanityImageSource
  alt?: string
}

interface RoomCardsProps {
  cards: RoomCard[]
}

export default function RoomCards({ cards }: RoomCardsProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const selectedCard = selectedIndex !== null ? cards[selectedIndex] : null

  // 導航函數
  const goToPrev = useCallback(() => {
    if (selectedIndex === null || cards.length <= 1) return
    setSelectedIndex((selectedIndex - 1 + cards.length) % cards.length)
  }, [selectedIndex, cards.length])

  const goToNext = useCallback(() => {
    if (selectedIndex === null || cards.length <= 1) return
    setSelectedIndex((selectedIndex + 1) % cards.length)
  }, [selectedIndex, cards.length])

  // 鍵盤支援：Esc 關閉，左右方向鍵導航，Tab 循環焦點
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSelectedIndex(null)
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goToPrev()
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      goToNext()
    }
    // Focus trap
    if (e.key === 'Tab') {
      e.preventDefault()
      closeButtonRef.current?.focus()
    }
  }, [goToPrev, goToNext])

  useEffect(() => {
    if (selectedIndex !== null) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      setTimeout(() => closeButtonRef.current?.focus(), 0)
    } else {
      triggerRef.current?.focus()
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [selectedIndex, handleKeyDown])

  if (!cards || cards.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card, index) => (
          <button
            key={index}
            onClick={(e) => {
              triggerRef.current = e.currentTarget
              setSelectedIndex(index)
            }}
            className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow cursor-pointer group"
          >
            <Image
              src={urlFor(card.asset).width(400).height(533).url()}
              alt={card.alt || `房型 ${index + 1}`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedCard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="房型圖片檢視器"
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedIndex(null)}
        >
          <button
            ref={closeButtonRef}
            className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center text-white text-4xl hover:text-gray-300 hover:bg-white/10 rounded-full transition-colors"
            onClick={() => setSelectedIndex(null)}
            aria-label="關閉"
          >
            &times;
          </button>

          {/* 左右導航按鈕 */}
          {cards.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goToPrev() }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-white text-2xl hover:bg-white/10 rounded-full transition-colors"
                aria-label="上一張"
              >
                ‹
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToNext() }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-white text-2xl hover:bg-white/10 rounded-full transition-colors"
                aria-label="下一張"
              >
                ›
              </button>
            </>
          )}

          <div className="relative max-w-2xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <Image
              src={urlFor(selectedCard.asset).width(800).url()}
              alt={selectedCard.alt || '房型圖片'}
              width={800}
              height={1067}
              className="object-contain mx-auto"
            />
          </div>
          {/* 圖片計數 */}
          {cards.length > 1 && (
            <p className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-sm">
              {(selectedIndex ?? 0) + 1} / {cards.length}
            </p>
          )}
        </div>
      )}
    </>
  )
}
