'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'
import type { QuoteData, QuoteItineraryDay } from '@/lib/quote/types'
import { DayTimeline } from './DayTimeline'
import { DayPhotos } from './DayPhotos'

const DAY_COLORS = ['#E8A23B', '#4A6B3A', '#A8C8DC', '#CA8A04', '#B85C38', '#9333EA', '#059669', '#DC2626']

const TITLE_GLYPHS: [RegExp, string][] = [
  [/抵達|機場|接機/i, '🛬'],
  [/大象/i, '🐘'],
  [/水上|泳|水樂園/i, '🏊'],
  [/冒險|攀岩|繩索/i, '🎢'],
  [/送機|回國|返/i, '✈️'],
  [/山|高山/i, '🏔️'],
  [/海|沙灘/i, '🌴'],
  [/夜市|市集/i, '🎪'],
]
const DEFAULT_GLYPHS = ['🛬', '🐘', '🏊', '🎢', '✈️', '🏔️', '🌴', '🎪']

function inferGlyph(title: string, index: number): string {
  for (const [pattern, glyph] of TITLE_GLYPHS) {
    if (pattern.test(title)) return glyph
  }
  return DEFAULT_GLYPHS[index % DEFAULT_GLYPHS.length]
}

/* ===================================================================
   PathNode — 3D Magnetic Hover (HTML lines 369-454)
   =================================================================== */

interface PathNodeProps {
  index: number
  day: QuoteItineraryDay
  color: string
  glyph: string
  active: boolean
  onClick: () => void
}

function PathNode({ day, color, glyph, active, onClick, index }: PathNodeProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [hover, setHover] = useState(false)

  // Mouse-following motion values
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)

  // Springs for magnetic effect
  const sx = useSpring(mx, { damping: 15, stiffness: 220, mass: 0.6 })
  const sy = useSpring(my, { damping: 15, stiffness: 220, mass: 0.6 })
  const srx = useSpring(rx, { damping: 18, stiffness: 200 })
  const sry = useSpring(ry, { damping: 18, stiffness: 200 })

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      mx.set(dx * 0.25)
      my.set(dy * 0.25)
      ry.set(dx * 0.15)
      rx.set(-dy * 0.15)
    },
    [mx, my, rx, ry],
  )

  const onLeave = useCallback(() => {
    mx.set(0)
    my.set(0)
    rx.set(0)
    ry.set(0)
    setHover(false)
  }, [mx, my, rx, ry])

  const dateLabel = `DAY ${String(index + 1).padStart(2, '0')}`

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={onLeave}
      onMouseMove={onMove}
      whileTap={{ scale: 0.96 }}
      style={{
        x: sx,
        y: sy,
        outline: 'none',
        transformStyle: 'preserve-3d',
      }}
      className="relative flex cursor-pointer flex-col items-center text-left group"
    >
      <motion.div
        className="relative"
        style={{
          rotateX: srx,
          rotateY: sry,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Active pulse ring */}
        {active && (
          <span
            className="absolute inset-0 rounded-full animate-pulse-ring"
            style={{ background: color, opacity: 0.35 }}
          />
        )}

        {/* Hover radial glow */}
        <AnimatePresence>
          {hover && !active && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1.25, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${color}88 0%, ${color}00 65%)`,
                filter: 'blur(8px)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Hover expanding ripple */}
        <AnimatePresence>
          {hover && (
            <motion.span
              key="ripple"
              initial={{ scale: 0.5, opacity: 0.7 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 1.1, ease: 'easeOut', repeat: Infinity }}
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                border: `2px solid ${color}`,
                boxShadow: `0 0 20px ${color}66`,
              }}
            />
          )}
        </AnimatePresence>

        {/* Main disc */}
        <motion.div
          animate={{
            scale: hover ? 1.08 : 1,
            boxShadow: active
              ? `0 14px 32px ${color}77, 0 0 0 6px ${color}22`
              : hover
                ? `0 16px 36px ${color}88, 0 0 0 4px ${color}33`
                : '0 4px 10px rgba(15,11,5,0.08)',
          }}
          transition={{ type: 'spring', damping: 16, stiffness: 260 }}
          className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full"
          style={{
            background: active ? '#0F0B05' : hover ? color : '#FDFBF4',
            border: `3px solid ${active || hover ? color : '#0F0B05'}`,
            transformStyle: 'preserve-3d',
          }}
        >
          <motion.span
            animate={{
              rotate: hover ? [0, -8, 6, -4, 0] : 0,
              scale: hover ? 1.18 : 1,
            }}
            transition={{ duration: hover ? 0.6 : 0.3 }}
            className="block text-[36px]"
            style={{
              transform: 'translateZ(14px)',
              filter: hover ? `drop-shadow(0 4px 8px ${color}aa)` : 'none',
            }}
          >
            {glyph}
          </motion.span>
        </motion.div>
      </motion.div>

      {/* Labels */}
      <motion.div
        animate={{ color: hover ? '#0F0B05' : '#7A6F5C', y: hover ? -2 : 0 }}
        className="mt-3 text-[10px] tracking-[0.2em]"
      >
        {dateLabel}
      </motion.div>
      <motion.div
        animate={{ y: hover ? -2 : 0 }}
        className="mt-1 text-[17px] font-black"
        style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
      >
        {day.title}
      </motion.div>
    </motion.button>
  )
}

/* ===================================================================
   PathNodeMobile
   =================================================================== */

function PathNodeMobile({ index, day, color, glyph, active, onClick }: PathNodeProps) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="relative flex w-full items-center gap-4 pl-0 text-left"
      style={{ outline: 'none' }}
    >
      {/* Circle with day color + glow */}
      <div className="relative z-10 shrink-0">
        {/* Glow ring */}
        {active && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{
              background: color,
              opacity: 0.3,
              filter: 'blur(10px)',
            }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.15, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <motion.div
          className="relative flex h-[58px] w-[58px] items-center justify-center rounded-full"
          style={{
            background: `linear-gradient(135deg, ${color}dd, ${color})`,
            border: `2.5px solid ${color}`,
            boxShadow: active
              ? `0 0 20px ${color}66, 0 4px 12px rgba(0,0,0,0.15)`
              : `0 2px 8px rgba(0,0,0,0.1)`,
          }}
          animate={active ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={active ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : {}}
        >
          <motion.span
            className="text-[28px]"
            style={{ filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.3))` }}
            animate={active ? { scale: [1, 1.15, 1], rotate: [0, -3, 3, 0] } : {}}
            transition={active ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : {}}
          >
            {glyph}
          </motion.span>
        </motion.div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] tracking-[0.2em]" style={{ color: '#7A6F5C' }}>
          DAY {String(index + 1).padStart(2, '0')}
        </div>
        <div
          className="truncate text-[18px] font-black"
          style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
        >
          {day.title}
        </div>
      </div>
      {/* Arrow — always pointing down to "go to this day" */}
      <ChevronDown size={20} className="shrink-0" style={{ color: active ? color : '#7A6F5C' }} />
    </motion.button>
  )
}

/* ===================================================================
   AmbientParticles Canvas (HTML lines 567-606)
   =================================================================== */

function getAmbientTone(color: string): 'forest' | 'water' | 'warm' {
  const c = color.toLowerCase()
  if (c.includes('4a6b3a') || c.includes('059669')) return 'forest'
  if (c.includes('a8c8dc')) return 'water'
  return 'warm'
}

function AmbientParticles({ tone }: { tone: 'forest' | 'water' | 'warm' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const parent = c.parentElement
      if (!parent) return
      const r = parent.getBoundingClientRect()
      c.width = r.width
      c.height = r.height
    }
    resize()

    const ro = new ResizeObserver(resize)
    if (c.parentElement) ro.observe(c.parentElement)

    const palette =
      tone === 'forest'
        ? [
            [180, 210, 180],
            [140, 180, 155],
          ]
        : tone === 'water'
          ? [
              [168, 200, 220],
              [200, 220, 235],
            ]
          : [
              [250, 204, 21],
              [232, 162, 59],
            ]

    const N = 55
    const dots = Array.from({ length: N }, () => ({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: 1.5 + Math.random() * 3.5,
      vx: (Math.random() - 0.5) * 0.22,
      vy: -0.08 - Math.random() * 0.28,
      a: 0.35 + Math.random() * 0.55,
      t: Math.random() * 6.28,
      col: palette[Math.floor(Math.random() * palette.length)],
    }))

    let raf: number
    const tick = () => {
      ctx.clearRect(0, 0, c.width, c.height)
      for (const p of dots) {
        p.x += p.vx
        p.y += p.vy
        p.t += 0.02
        if (p.y < -10) {
          p.y = c.height + 10
          p.x = Math.random() * c.width
        }
        const alpha = p.a * (0.55 + 0.45 * Math.sin(p.t))
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.5)
        g.addColorStop(0, `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${alpha})`)
        g.addColorStop(1, `rgba(${p.col[0]},${p.col[1]},${p.col[2]},0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 3.5, 0, 6.28)
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [tone])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[1]"
      style={{ opacity: 0.95, mixBlendMode: 'screen' }}
    />
  )
}

/* ===================================================================
   Main Component
   =================================================================== */

interface Props {
  quote: QuoteData
}

export function QuoteItinerary({ quote }: Props) {
  // 預設展開所有天（手機直接往下滑看完）
  const [expandedDays, setExpandedDays] = useState<Set<number>>(
    () => new Set(quote.itinerary.map((_, i) => i))
  )
  const timelineRef = useRef<HTMLDivElement>(null)

  const scrollToDay = (i: number) => {
    // 確保展開，然後滾動
    setExpandedDays(prev => {
      const next = new Set(prev)
      next.add(i) // 只加不刪 — 點擊永遠是「去到那天」
      return next
    })
    setTimeout(() => {
      const el = document.getElementById(`day-detail-${i}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }

  const collapseDay = (i: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      next.delete(i)
      return next
    })
  }
  // Backward compat — activeDay for PathNode highlight
  const activeDay = expandedDays.size === 1 ? Array.from(expandedDays)[0] : null

  return (
    <section
      id="itinerary"
      className="relative px-6 py-8 md:px-10 md:py-12"
      style={{ background: '#FDFBF4' }}
    >
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-14 text-center">
          <div
            className="inline-block text-[11px] tracking-[0.2em]"
            style={{ color: '#CA8A04' }}
          >
            THE PATH FLOW
          </div>
          <h2
            className="mt-3 font-black"
            style={{
              fontSize: 'clamp(28px, 4vw, 44px)',
              color: '#0F0B05',
              fontFamily: 'var(--font-display, serif)',
            }}
          >
            {quote.tripDays}日，一條路徑
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl text-[15px] md:text-[17px]"
            style={{ color: '#3A3224' }}
          >
            點擊任一節點，展開當日的完整流程、親子提醒與用餐細節。
          </p>
        </div>

        {/* Desktop: horizontal path nodes */}
        <div className="relative hidden md:block">
          <svg
            className="absolute left-0 right-0 top-[72px] w-full"
            height="60"
            viewBox="0 0 1000 60"
            preserveAspectRatio="none"
          >
            <path
              d="M 40 30 Q 220 -10 400 30 T 760 30 T 960 30"
              stroke="#FACC15"
              strokeWidth="3"
              strokeDasharray="6 8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <div
            className="relative grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${quote.itinerary.length}, 1fr)`,
            }}
          >
            {quote.itinerary.map((day, i) => (
              <PathNode
                key={i}
                index={i}
                day={day}
                color={DAY_COLORS[i % DAY_COLORS.length]}
                glyph={inferGlyph(day.title, i)}
                active={expandedDays.has(i)}
                onClick={() => scrollToDay(i)}
              />
            ))}
          </div>
        </div>

        {/* Mobile: vertical path nodes */}
        <div className="relative md:hidden">
          <div
            className="absolute left-[28px] top-0 bottom-0 w-[2px] border-l-2 border-dashed"
            style={{ borderColor: '#FACC15' }}
          />
          <div className="space-y-4">
            {quote.itinerary.map((day, i) => (
              <PathNodeMobile
                key={i}
                index={i}
                day={day}
                color={DAY_COLORS[i % DAY_COLORS.length]}
                glyph={inferGlyph(day.title, i)}
                active={expandedDays.has(i)}
                onClick={() => scrollToDay(i)}
              />
            ))}
          </div>
        </div>

        {/* Expanded day details */}
        <AnimatePresence>
          {quote.itinerary.map((day, i) =>
            expandedDays.has(i) ? (
            <motion.div
              key={i}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              id={`day-detail-${i}`}
              className="mt-8 overflow-hidden"
            >
              <DayDetailCard
                day={day}
                dayIndex={i}
                color={DAY_COLORS[i % DAY_COLORS.length]}
                photos={quote.photos}
                onClose={() => collapseDay(i)}
                timelineRef={timelineRef}
              />
            </motion.div>
          ) : null)}
        </AnimatePresence>
      </div>
    </section>
  )
}

/* ===================================================================
   DayDetailCard — rounded card with offset shadow (HTML lines 887-971)
   =================================================================== */

function DayDetailCard({
  day,
  dayIndex,
  color,
  photos,
  onClose,
  timelineRef,
}: {
  day: QuoteItineraryDay
  dayIndex: number
  color: string
  photos: QuoteData['photos']
  onClose: () => void
  timelineRef: React.RefObject<HTMLDivElement | null>
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const ambientTone = getAmbientTone(color)

  return (
    <div
      className="overflow-hidden rounded-[28px] border-2"
      style={{
        borderColor: '#0F0B05',
        boxShadow: '12px 12px 0 #0F0B05',
      }}
    >
      {/* Day header bar */}
      <div
        className="relative px-6 py-8 md:px-10 md:py-12"
        style={{ background: color }}
      >
        {/* Decorative SVG dashes */}
        <svg
          className="absolute right-0 top-0 h-full"
          viewBox="0 0 300 200"
          preserveAspectRatio="none"
          style={{ width: '50%', opacity: 0.18 }}
        >
          <path
            d="M 10 180 Q 100 40 200 100 T 290 30"
            stroke="#0F0B05"
            strokeWidth="3"
            strokeDasharray="8 8"
            fill="none"
            strokeLinecap="round"
          />
        </svg>

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[12px] tracking-[0.22em]" style={{ color: '#0F0B05' }}>
              {day.day}
            </div>
            <h3
              className="mt-2 font-black leading-[1]"
              style={{
                fontSize: 'clamp(34px, 5vw, 64px)',
                color: '#0F0B05',
                textWrap: 'balance',
                fontFamily: 'var(--font-display, serif)',
              }}
            >
              {day.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold"
            style={{ background: '#0F0B05', color: '#FDFBF4' }}
          >
            <X size={14} /> 收合
          </button>
        </div>
      </div>

      {/* Body: 2-column layout */}
      <div
        ref={bodyRef}
        className="relative overflow-hidden p-6 md:p-10"
        style={{ background: '#FFFFFF' }}
      >
        {/* Ambient particles */}
        <AmbientParticles tone={ambientTone} />

        {/* Brand watermark */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.05]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.png"
            alt=""
            className="h-[360px] w-[360px]"
            style={{ filter: 'grayscale(1) brightness(0) invert(1)' }}
          />
        </div>

        <div className="relative z-[2] grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* LEFT — Timeline */}
          <div>
            <DayTimeline
              items={day.items}
              hotel={day.hotel}
              heroColor={color}
            />

            {/* Mobile photos interleaved */}
            <div className="lg:hidden">
              <DayPhotos photos={photos} dayIndex={dayIndex} />
            </div>
          </div>

          {/* RIGHT — Photo ribbon (desktop only) */}
          <div className="hidden lg:block">
            <DayPhotos photos={photos} dayIndex={dayIndex} />
          </div>
        </div>
      </div>
    </div>
  )
}
