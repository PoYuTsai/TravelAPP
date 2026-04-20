'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import type { QuotePhoto } from '@/lib/quote/types'

interface Props {
  photos: QuotePhoto[]
  dayIndex: number
}

export function DayPhotos({ photos, dayIndex }: Props) {
  const dayPhotos = photos.find((p) => p.dayIndex === dayIndex)
  if (!dayPhotos || dayPhotos.images.length === 0) return null

  return (
    <div className="mb-8">
      <div
        className="text-[11px] tracking-[0.2em] mb-4"
        style={{ color: '#7A6F5C' }}
      >
        PHOTO HIGHLIGHTS
      </div>

      {/* Horizontal scroll container */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 snap-x snap-mandatory scrollbar-hide">
        {dayPhotos.images.map((img, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{
              delay: 0.08 * i,
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={{ scale: 1.04, y: -4, rotate: 0 }}
            className="shrink-0 snap-start"
            style={{
              transform: `rotate(${i % 2 === 0 ? -2 : 2}deg)`,
            }}
          >
            <div
              className="relative w-[180px] md:w-[200px] rounded-xl overflow-hidden"
              style={{
                background: '#FFFFFF',
                boxShadow:
                  '0 18px 36px -10px rgba(15,11,5,0.2), 0 4px 10px rgba(15,11,5,0.08)',
                border: '3px solid #FFFFFF',
              }}
            >
              {/* Tape decoration */}
              <div
                className="absolute top-[-6px] left-1/2 -translate-x-1/2 z-10 w-[48px] h-[14px] rounded-sm"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(250,204,21,0.6) 0%, rgba(250,204,21,0.35) 100%)',
                  transform: 'translateX(-50%) rotate(-2deg)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              />

              {/* Photo */}
              <div className="relative" style={{ aspectRatio: '4/5' }}>
                <Image
                  src={img.url}
                  alt={`Day ${dayIndex + 1} photo ${i + 1}`}
                  fill
                  className="object-cover"
                  sizes="200px"
                  {...(img.hotspot
                    ? {
                        style: {
                          objectPosition: `${img.hotspot.x * 100}% ${img.hotspot.y * 100}%`,
                        },
                      }
                    : {})}
                />
              </div>

              {/* Caption */}
              <div className="px-3 pt-2 pb-3 text-center">
                <div
                  className="text-[8.5px] tracking-[0.2em]"
                  style={{ color: '#7A6F5C' }}
                >
                  WAYPOINT {String(i + 1).padStart(2, '0')} /{' '}
                  {String(dayPhotos.images.length).padStart(2, '0')}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
