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
  const [selectedCard, setSelectedCard] = useState<RoomCard | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // 鍵盤支援：Esc 關閉 Lightbox，Tab 循環焦點
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSelectedCard(null)
    }
    // Focus trap
    if (e.key === 'Tab') {
      e.preventDefault()
      closeButtonRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    if (selectedCard) {
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
  }, [selectedCard, handleKeyDown])

  if (!cards || cards.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card, index) => (
          <button
            key={index}
            onClick={(e) => {
              triggerRef.current = e.currentTarget
              setSelectedCard(card)
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
          onClick={() => setSelectedCard(null)}
        >
          <button
            ref={closeButtonRef}
            className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center text-white text-4xl hover:text-gray-300 hover:bg-white/10 rounded-full transition-colors"
            onClick={() => setSelectedCard(null)}
            aria-label="關閉"
          >
            &times;
          </button>
          <div className="relative max-w-2xl max-h-[90vh] w-full">
            <Image
              src={urlFor(selectedCard.asset).width(800).url()}
              alt={selectedCard.alt || '房型圖片'}
              width={800}
              height={1067}
              className="object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </>
  )
}
