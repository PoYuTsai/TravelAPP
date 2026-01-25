'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { urlFor } from '@/sanity/client'
import type { SanityImageSource } from '@sanity/image-url'

interface GalleryImage {
  asset: SanityImageSource
  alt?: string
  caption?: string
}

interface ImageGalleryProps {
  images: GalleryImage[]
  columns?: 2 | 3 | 4
}

export default function ImageGallery({ images, columns = 3 }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // 鍵盤支援：Esc 關閉 Lightbox，Tab 循環焦點
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSelectedImage(null)
    }
    // Focus trap: 只有一個可聚焦元素（關閉按鈕），所以 Tab 就保持在那
    if (e.key === 'Tab') {
      e.preventDefault()
      closeButtonRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    if (selectedImage) {
      document.addEventListener('keydown', handleKeyDown)
      // 防止背景滾動
      document.body.style.overflow = 'hidden'
      // Focus trap：開啟時聚焦到關閉按鈕
      setTimeout(() => closeButtonRef.current?.focus(), 0)
    } else {
      // 關閉時返回原觸發元素
      triggerRef.current?.focus()
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [selectedImage, handleKeyDown])

  if (!images || images.length === 0) return null

  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  }

  return (
    <>
      <div className={`grid ${gridCols[columns]} gap-4`}>
        {images.map((image, index) => (
          <button
            key={index}
            onClick={(e) => {
              triggerRef.current = e.currentTarget
              setSelectedImage(image)
            }}
            className="relative aspect-[4/3] rounded-lg overflow-hidden group cursor-pointer"
          >
            <Image
              src={urlFor(image.asset).width(600).height(450).url()}
              alt={image.alt || `照片 ${index + 1}`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {image.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-sm">{image.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="圖片檢視器"
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            ref={closeButtonRef}
            className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center text-white text-4xl hover:text-gray-300 hover:bg-white/10 rounded-full transition-colors"
            onClick={() => setSelectedImage(null)}
            aria-label="關閉"
          >
            &times;
          </button>
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full">
            <Image
              src={urlFor(selectedImage.asset).width(1200).url()}
              alt={selectedImage.alt || '照片'}
              fill
              className="object-contain"
            />
          </div>
          {selectedImage.caption && (
            <p className="absolute bottom-4 left-0 right-0 text-center text-white">
              {selectedImage.caption}
            </p>
          )}
        </div>
      )}
    </>
  )
}
