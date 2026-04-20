'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { MapPin, Images, X } from 'lucide-react'
import type { QuotePhoto } from '@/lib/quote/types'

/* ===================================================================
   PhotoIllustration SVG placeholders (HTML lines 475-564)
   =================================================================== */

const ILLUSTRATION_KINDS = [
  'temple', 'food', 'mango', 'elephant', 'waterfall', 'dinner',
  'water', 'art', 'safari', 'rope', 'pig', 'crown', 'coffee', 'plane',
] as const

type IllustrationKind = (typeof ILLUSTRATION_KINDS)[number]

function PhotoIllustration({
  kind = 'temple',
  tone = '#E8A23B',
  mist = '#C89F6E',
}: {
  kind?: string
  tone?: string
  mist?: string
}) {
  const p = {
    stroke: tone,
    fill: 'none',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const bg = `linear-gradient(155deg, ${mist}66, ${tone}22 50%, #FDFBF455)`

  const svgContent = (() => {
    switch (kind) {
      case 'temple':
        return (
          <>
            <path {...p} d="M -70 40 L -70 -20 L 0 -60 L 70 -20 L 70 40 Z" />
            <path {...p} d="M -50 40 L -50 0 L 50 0 L 50 40" opacity="0.7" />
            <path {...p} d="M -20 40 L -20 10 L 20 10 L 20 40" />
            <circle cx="0" cy="-70" r="6" fill={tone} />
          </>
        )
      case 'food':
        return (
          <>
            <ellipse cx="0" cy="10" rx="60" ry="28" {...p} />
            <path {...p} d="M -40 -30 Q 0 -50 40 -30 Q 30 10 0 5 Q -30 10 -40 -30 Z" fill={tone} fillOpacity="0.35" />
            <circle cx="-20" cy="-10" r="3" fill={tone} />
            <circle cx="15" cy="-15" r="3" fill={tone} />
          </>
        )
      case 'elephant':
        return (
          <>
            <path {...p} d="M -80 40 Q -60 -30 0 -40 Q 60 -40 70 0 L 80 40 L 80 60 L 60 60 L 60 40 M 30 60 L 30 40 M -30 60 L -30 40 M -60 60 L -60 40 M -70 -20 Q -90 0 -80 40" />
            <circle cx="-30" cy="-15" r="4" fill={tone} />
          </>
        )
      case 'waterfall':
        return (
          <>
            <path {...p} d="M -60 -40 L -60 30 M -30 -50 L -30 35 M 0 -60 L 0 30 M 30 -50 L 30 35 M 60 -40 L 60 30" />
            <path {...p} opacity="0.6" d="M -80 40 Q -40 55 0 45 Q 40 55 80 40" />
          </>
        )
      case 'water':
        return (
          <>
            <path {...p} d="M -80 0 Q -40 -30 0 0 Q 40 30 80 0" />
            <path {...p} opacity="0.7" d="M -80 30 Q -40 0 0 30 Q 40 60 80 30" />
            <circle cx="-30" cy="-20" r="3" fill={tone} />
            <circle cx="40" cy="10" r="2.5" fill={tone} opacity="0.7" />
          </>
        )
      case 'coffee':
        return (
          <>
            <path {...p} d="M -40 -30 L -40 30 L 40 30 L 40 -30 Z" />
            <path {...p} d="M 40 -10 Q 65 -10 65 10 Q 65 25 40 25" />
            <path {...p} opacity="0.7" d="M -20 -50 Q -25 -60 -20 -70 M 0 -50 Q -5 -60 0 -70 M 20 -50 Q 15 -60 20 -70" />
          </>
        )
      case 'plane':
        return (
          <>
            <path {...p} d="M -70 20 L 70 -20 L 80 0 L -60 40 Z" fill={tone} fillOpacity="0.3" />
            <path {...p} d="M -20 10 L -10 40 L 10 35 L 0 5" />
            <path {...p} opacity="0.5" d="M -90 40 L 90 40" />
          </>
        )
      case 'dinner':
        return (
          <>
            <circle cx="0" cy="0" r="50" {...p} />
            <path {...p} d="M -30 0 L 30 0 M 0 -30 L 0 30" opacity="0.4" />
            <circle cx="-20" cy="-20" r="4" fill={tone} />
            <circle cx="15" cy="15" r="3" fill={tone} />
          </>
        )
      case 'mango':
        return (
          <>
            <ellipse cx="-20" cy="-10" rx="30" ry="22" {...p} fill={tone} fillOpacity="0.4" />
            <ellipse cx="25" cy="15" rx="28" ry="20" {...p} fill={tone} fillOpacity="0.5" />
            <circle cx="-10" cy="20" r="3" fill={tone} />
          </>
        )
      case 'art':
        return (
          <>
            <rect x="-60" y="-40" width="50" height="40" {...p} />
            <rect x="-20" y="-10" width="40" height="50" {...p} />
            <rect x="30" y="-30" width="40" height="35" {...p} />
            <circle cx="-35" cy="-20" r="6" fill={tone} opacity="0.6" />
          </>
        )
      case 'safari':
        return (
          <>
            <circle cx="-30" cy="-10" r="18" {...p} />
            <circle cx="-30" cy="-10" r="6" fill={tone} />
            <circle cx="30" cy="-10" r="18" {...p} />
            <circle cx="30" cy="-10" r="6" fill={tone} />
            <path {...p} opacity="0.6" d="M -70 50 L 70 50" />
          </>
        )
      case 'rope':
        return (
          <>
            <path {...p} d="M -90 -60 L 90 30" />
            <path {...p} d="M -50 -40 Q -50 -20 -60 -10 L -60 40 M -60 40 L -70 50 M -60 40 L -50 50" />
          </>
        )
      case 'pig':
        return (
          <>
            <ellipse cx="0" cy="10" rx="55" ry="38" {...p} />
            <circle cx="-25" cy="-5" r="3" fill={tone} />
            <circle cx="20" cy="-5" r="3" fill={tone} />
            <ellipse cx="0" cy="15" rx="12" ry="8" {...p} />
          </>
        )
      case 'crown':
        return (
          <>
            <path {...p} d="M -60 20 L -50 -40 L -20 0 L 0 -50 L 20 0 L 50 -40 L 60 20 Z" fill={tone} fillOpacity="0.35" />
            <circle cx="-50" cy="-40" r="5" fill={tone} />
            <circle cx="0" cy="-50" r="6" fill={tone} />
            <circle cx="50" cy="-40" r="5" fill={tone} />
          </>
        )
      default:
        return <path {...p} d="M -70 40 L -30 -20 L 0 10 L 30 -30 L 70 40 Z" />
    }
  })()

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: bg }}>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="-100 -100 200 200"
        preserveAspectRatio="xMidYMid slice"
      >
        <g>{svgContent}</g>
      </svg>
    </div>
  )
}

/* ===================================================================
   Polaroid Card  (photo-card + tape from HTML)
   =================================================================== */

function PolaroidCard({
  children,
  caption,
  waypointLabel,
  rotate = 0,
  isActive = false,
}: {
  children: React.ReactNode
  caption?: string
  waypointLabel?: string
  rotate?: number
  isActive?: boolean
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.08, rotate: 0, y: -8 }}
      transition={{ type: 'spring', damping: 14, stiffness: 200 }}
      className="cursor-pointer overflow-hidden rounded-[6px]"
      style={{
        background: '#FDFBF4',
        border: '6px solid #FFFFFF',
        boxShadow: isActive
          ? '0 30px 50px -12px rgba(15,11,5,0.38), 0 10px 20px rgba(15,11,5,0.15)'
          : '0 18px 36px -10px rgba(15,11,5,0.28), 0 4px 10px rgba(15,11,5,0.10)',
        position: 'relative',
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {/* Gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'linear-gradient(155deg, rgba(255,255,255,0.22) 0%, transparent 35%, transparent 65%, rgba(15,11,5,0.08) 100%)',
        }}
      />
      {/* Tape decoration */}
      <div
        className="absolute -top-[12px] left-1/2 z-20 h-[18px] w-[54px] rounded-sm"
        style={{
          transform: 'translateX(-50%) rotate(-2deg)',
          background: 'rgba(250,204,21,0.55)',
          border: '1px solid rgba(15,11,5,0.12)',
          boxShadow: '0 2px 6px rgba(15,11,5,0.12)',
        }}
      />

      {/* Photo area */}
      <div className="w-full" style={{ aspectRatio: '4/5' }}>
        {children}
      </div>

      {/* Caption area */}
      <div className="px-3 pb-3 pt-2 text-center">
        {caption && (
          <div
            className="text-[12.5px] font-bold"
            style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
          >
            {caption}
          </div>
        )}
        {waypointLabel && (
          <div
            className="mt-0.5 text-[8.5px] tracking-[0.2em]"
            style={{ color: '#7A6F5C' }}
          >
            {waypointLabel}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ===================================================================
   Waypoint — Polaroid with MapPin + IntersectionObserver active state
   (HTML lines 727-800)
   =================================================================== */

function Waypoint({
  image,
  index,
  total,
  rightSide,
  y,
}: {
  image: { url: string; hotspot?: { x: number; y: number } }
  index: number
  total: number
  rightSide: boolean
  y: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const rotate = rightSide ? -2.5 : 2.5

  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver(
      ([e]) => setActive(e.isIntersecting && e.intersectionRatio > 0.5),
      { threshold: [0, 0.5, 1], rootMargin: '-25% 0px -25% 0px' },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, scale: 0.92, rotate }}
      whileInView={{ opacity: 1, y: 0, scale: 1, rotate }}
      viewport={{ once: false, amount: 0.25 }}
      animate={
        active
          ? { scale: 1.04, y: [0, -4, 0] }
          : { scale: 1 }
      }
      transition={{
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
        y: active ? { duration: 3.5, repeat: Infinity, ease: 'easeInOut' } : undefined,
      }}
      className="absolute"
      style={{
        width: 200,
        top: y,
        [rightSide ? 'right' : 'left']: 10,
      }}
    >
      {/* MapPin + handwritten caption */}
      <div
        className={`mb-2 flex items-center gap-1.5 ${rightSide ? 'justify-start pl-3' : 'justify-end pr-3'}`}
      >
        <motion.span
          whileHover={{ scale: 1.35, rotate: [0, -10, 8, 0], transition: { duration: 0.5 } }}
          animate={active ? { y: [0, -3, 0] } : {}}
          transition={{ duration: 1.6, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full animate-pin-bounce"
          style={{
            background: '#FACC15',
            color: '#0F0B05',
            boxShadow: '0 4px 10px rgba(15,11,5,0.22), 0 0 0 3px rgba(255,255,255,0.9)',
          }}
        >
          <MapPin size={13} strokeWidth={2.4} />
        </motion.span>
        <span
          className="text-[12.5px] italic"
          style={{
            color: '#1F1A10',
            fontWeight: 700,
            transform: 'rotate(-2deg)',
            textShadow: '0 1px 0 #fff',
            fontFamily: 'var(--font-display, serif)',
          }}
        >
          Photo {index + 1}
        </span>
      </div>

      {/* Polaroid */}
      <PolaroidCard
        waypointLabel={`WAYPOINT ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`}
        rotate={0}
        isActive={active}
      >
        <div className="relative h-full w-full">
          <Image
            src={image.url}
            alt={`Photo ${index + 1}`}
            fill
            className="object-cover"
            sizes="200px"
            {...(image.hotspot
              ? {
                  style: {
                    objectPosition: `${image.hotspot.x * 100}% ${image.hotspot.y * 100}%`,
                  },
                }
              : {})}
          />
        </div>
      </PolaroidCard>

      {/* "View more" micro-interaction */}
      <div className={`mt-2 ${rightSide ? 'pl-2 text-left' : 'pr-2 text-right'}`}>
        <button
          onClick={() => setShowMore((s) => !s)}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-[0.08em] transition-all hover:scale-105"
          style={{
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(15,11,5,0.12)',
            color: '#3A3224',
            backdropFilter: 'blur(6px)',
          }}
        >
          {showMore ? <X size={11} /> : <Images size={11} />}{' '}
          {showMore ? '收起' : '查看更多照片'}
        </button>
      </div>
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            className={`mt-2 flex gap-1.5 ${rightSide ? 'justify-start' : 'justify-end'}`}
          >
            {[0, 1, 2].map((k) => (
              <div
                key={k}
                className="h-[42px] w-[42px] overflow-hidden rounded-md"
                style={{
                  border: '2px solid #fff',
                  boxShadow: '0 4px 10px rgba(15,11,5,0.18)',
                }}
              >
                <Image
                  src={image.url}
                  alt=""
                  width={42}
                  height={42}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ===================================================================
   SilkMotionPath — SVG Bezier curve with glow + particles
   (HTML lines 643-724)
   =================================================================== */

function SilkMotionPath({
  photoCount,
  containerRef,
}: {
  photoCount: number
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const W = 320
  const photoH = 300
  const topPad = 40
  const H = topPad + photoCount * photoH + 40

  // Build winding path
  const pathD = (() => {
    let d = `M 30 ${topPad - 20}`
    for (let i = 0; i < photoCount; i++) {
      const y = topPad + 80 + i * photoH
      const x = i % 2 === 0 ? W - 40 : 50
      const ctrlY = y - photoH * 0.35
      const ctrlX = i % 2 === 0 ? W - 20 : 30
      d += ` Q ${ctrlX} ${ctrlY}, ${x} ${y}`
    }
    d += ` Q ${W / 2} ${H - 20}, 30 ${H}`
    return d
  })()

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })
  const drawLen = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
    >
      <defs>
        <linearGradient id="sfade-silk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FACC15" stopOpacity="0.05" />
          <stop offset="15%" stopColor="#FACC15" stopOpacity="0.95" />
          <stop offset="85%" stopColor="#FACC15" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#FACC15" stopOpacity="0.05" />
        </linearGradient>
        <filter id="sblur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id="silkGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Silk aura (14px yellow glow) */}
      <path
        d={pathD}
        stroke="#FACC15"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
        opacity="0.22"
        filter="url(#sblur)"
      />

      {/* Silk main ribbon (scroll-driven) */}
      <motion.path
        d={pathD}
        stroke="url(#sfade-silk)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#silkGlow)"
        style={{ pathLength: drawLen }}
      />

      {/* Sparkle dashes */}
      <path
        d={pathD}
        stroke="#FFF6C4"
        strokeWidth="1"
        strokeDasharray="1 12"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
        className="animate-path-dash"
      />
    </svg>
  )
}

/* ===================================================================
   DesktopPhotoRibbon — Silk path + Polaroid waypoints
   =================================================================== */

function DesktopPhotoRibbon({
  images,
}: {
  images: { url: string; hotspot?: { x: number; y: number } }[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const photoH = 300
  const topPad = 40
  const H = topPad + images.length * photoH + 40

  return (
    <div
      ref={containerRef}
      className="relative hidden lg:block"
      style={{ width: 320, minHeight: H }}
    >
      <SilkMotionPath photoCount={images.length} containerRef={containerRef} />
      {images.map((img, i) => {
        const y = topPad + 20 + i * photoH
        const rightSide = i % 2 === 0
        return (
          <Waypoint
            key={i}
            image={img}
            index={i}
            total={images.length}
            rightSide={rightSide}
            y={y}
          />
        )
      })}
    </div>
  )
}

/* ===================================================================
   MobilePhoto — single polaroid card (HTML lines 806-819)
   =================================================================== */

function MobilePhoto({
  image,
  index,
}: {
  image: { url: string; hotspot?: { x: number; y: number } }
  index: number
}) {
  const rotate = index % 2 === 0 ? -1.8 : 1.8
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6 }}
      className="mx-auto my-5"
      style={{ width: '78%', transform: `rotate(${rotate}deg)` }}
    >
      <PolaroidCard
        waypointLabel="CHIANGWAY · FILM"
        rotate={0}
      >
        <div className="relative h-full w-full">
          <Image
            src={image.url}
            alt={`Photo ${index + 1}`}
            fill
            className="object-cover"
            sizes="300px"
            {...(image.hotspot
              ? {
                  style: {
                    objectPosition: `${image.hotspot.x * 100}% ${image.hotspot.y * 100}%`,
                  },
                }
              : {})}
          />
        </div>
      </PolaroidCard>
    </motion.div>
  )
}

/* ===================================================================
   Main DayPhotos component
   =================================================================== */

interface Props {
  photos: QuotePhoto[]
  dayIndex: number
}

export function DayPhotos({ photos, dayIndex }: Props) {
  const dayPhotos = photos.find((p) => p.dayIndex === dayIndex)
  if (!dayPhotos || dayPhotos.images.length === 0) {
    // Show illustration placeholders when no photos
    return null
  }

  return (
    <>
      {/* Desktop: silk ribbon path with waypoints */}
      <DesktopPhotoRibbon images={dayPhotos.images} />

      {/* Mobile: interleaved polaroids */}
      <div className="lg:hidden">
        <div className="mb-4 text-[11px] tracking-[0.2em]" style={{ color: '#7A6F5C' }}>
          PHOTO HIGHLIGHTS
        </div>
        {dayPhotos.images.map((img, i) => (
          <MobilePhoto key={i} image={img} index={i} />
        ))}
      </div>
    </>
  )
}
