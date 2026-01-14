'use client'

import { useState } from 'react'
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

  if (!cards || cards.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card, index) => (
          <button
            key={index}
            onClick={() => setSelectedCard(card)}
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
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCard(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300"
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
