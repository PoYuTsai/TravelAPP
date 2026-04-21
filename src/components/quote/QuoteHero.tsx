'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import type { QuoteData } from '@/lib/quote/types'

const ease = [0.22, 1, 0.36, 1] as const

export function QuoteHero({ quote }: { quote: QuoteData }) {
  const { tripDays, tripNights, isSample } = quote

  const title = isSample
    ? `清邁親子\n${tripDays}天${tripNights}夜經典套餐`
    : `清邁親子\n${tripDays}天${tripNights}夜`

  const subtitle = isSample
    ? '2大2小 · 經典路線'
    : `${quote.adults}大${quote.children}小${quote.createdAt ? ` · ${formatDateRange(quote.createdAt)}` : ''}`

  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: 'min(100vh, 960px)', background: '#0B0A08' }}
    >
      {/* ── Background: photo + depth-of-field layers ── */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-bg.jpg"
          alt=""
          fill
          className="object-cover"
          style={{ filter: 'blur(3px) saturate(1.05)' }}
          priority
        />
        {/* Rim blur layer */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/images/hero-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(22px)',
            transform: 'scale(1.1)',
            maskImage: 'radial-gradient(ellipse 58% 62% at 50% 46%, transparent 45%, black 92%)',
            WebkitMaskImage: 'radial-gradient(ellipse 58% 62% at 50% 46%, transparent 45%, black 92%)',
          }}
        />
        {/* Readability gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(11,10,8,0.55) 0%, rgba(11,10,8,0.20) 25%, rgba(11,10,8,0.18) 50%, rgba(11,10,8,0.62) 75%, rgba(11,10,8,0.94) 100%)',
          }}
        />
        {/* Gold whisper */}
        <div
          className="absolute -left-20 -top-20 h-[520px] w-[520px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.14) 0%, transparent 70%)' }}
        />
        {/* Film grain */}
        <div
          className="absolute inset-0 mix-blend-overlay"
          style={{
            opacity: 0.16,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '3px 3px',
          }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto flex min-h-[min(100vh,960px)] max-w-5xl flex-col items-center justify-center px-6 py-16 md:px-10">

        {/* ── Logo container (frosted glass capsule) ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease }}
          className="flex items-center gap-5 rounded-[32px] px-6 py-4 md:px-8 md:py-5"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))',
            backdropFilter: 'blur(44px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(44px) saturate(1.6)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 26px 60px rgba(0,0,0,0.52), inset 0 1.5px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <Image
            src="/images/logo.png"
            alt="清微旅行"
            width={80}
            height={80}
            className="rounded-[20px] object-contain p-1.5"
            style={{
              background: 'rgba(255,255,255,0.92)',
            }}
          />
          <div>
            <div
              className="text-[11px] font-black tracking-[0.34em]"
              style={{
                color: '#FFD700',
                fontFamily: 'var(--font-latin, sans-serif)',
              }}
            >
              CHIANGWAY TRAVEL
            </div>
            <div
              className="mt-1 font-black tracking-[0.18em]"
              style={{
                fontSize: 'clamp(22px, 2.6vw, 30px)',
                color: '#FDFCF0',
                fontFamily: 'var(--font-display, serif)',
                textShadow: '0 2px 14px rgba(0,0,0,0.55)',
              }}
            >
              清微旅行
            </div>
            <div
              className="mt-0.5 text-[11px] tracking-[0.22em]"
              style={{ color: 'rgba(255,255,255,0.62)' }}
            >
              爸媽開的 · 清邁親子包車
            </div>
          </div>
        </motion.div>

        {/* ── Divider ── */}
        <motion.div
          className="mx-auto my-8 flex items-center gap-4 md:my-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <div className="h-[2px] w-10 rounded-full" style={{ background: '#FFD700' }} />
          <div
            className="text-[12px] font-black tracking-[0.32em]"
            style={{ color: '#FFD700', fontFamily: 'var(--font-latin, sans-serif)' }}
          >
            PRIVATE · FAMILY · ITINERARY
          </div>
          <div className="h-[2px] w-10 rounded-full" style={{ background: '#FFD700' }} />
        </motion.div>

        {/* ── Title ── */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.9, ease }}
          className="whitespace-pre-line text-center font-black leading-[1.04]"
          style={{
            fontSize: 'clamp(38px, 7.8vw, 88px)',
            letterSpacing: '0.045em',
            fontFamily: 'var(--font-display, serif)',
            background: 'linear-gradient(180deg, #FDFCF0 0%, #F7EFD3 55%, #E8D9A7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.35)) drop-shadow(0 6px 18px rgba(0,0,0,0.55))',
          }}
        >
          {title}
        </motion.h1>

        {/* ── Subtitle ── */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5, ease }}
          className="mt-5 text-center text-[16px] font-medium tracking-[0.05em] md:text-[18px]"
          style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.75 }}
        >
          {subtitle}
        </motion.p>

        {/* ── Client badge (customer mode only) ── */}
        {!isSample && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.75, duration: 0.5, ease }}
            className="mt-6 inline-flex items-center gap-2.5 rounded-full px-5 py-2.5"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.11), rgba(255,215,0,0.08))',
              backdropFilter: 'blur(20px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
              border: '1px solid rgba(255,215,0,0.45)',
              boxShadow: '0 8px 26px rgba(0,0,0,0.3)',
            }}
          >
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px]"
              style={{
                background: 'linear-gradient(135deg, #FFE98A, #FFD700, #C9A227)',
                boxShadow: '0 0 14px rgba(255,215,0,0.4)',
              }}
            >
              ✦
            </span>
            <span
              className="text-[15px] font-black tracking-[0.08em]"
              style={{
                fontFamily: 'var(--font-display, serif)',
                background: 'linear-gradient(135deg, #FFF4B8, #FFE07A, #FFD700, #D9A520)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.55)) drop-shadow(0 1px 0 rgba(90,60,10,0.55))',
              }}
            >
              {quote.name} 專屬行程
            </span>
          </motion.div>
        )}
      </div>
    </section>
  )
}

function formatDateRange(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()} 出發`
  } catch {
    return ''
  }
}
