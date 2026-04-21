'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import type { QuoteData } from '@/lib/quote/types'

const ease = [0.22, 1, 0.36, 1] as const

/**
 * 從後台名稱拆解客人名和行程描述
 * 格式：「客人名-行程描述」或「客人名」
 * 例如：「林小姐-清邁4天3夜」→ { client: '林小姐', trip: '清邁4天3夜' }
 *       「清邁親子5天4夜經典套餐」→ { client: null, trip: '清邁親子5天4夜經典套餐' }
 */
function parseQuoteName(name: string): { client: string | null; trip: string } {
  const sep = name.indexOf('-')
  if (sep > 0 && sep < name.length - 1) {
    return { client: name.slice(0, sep).trim(), trip: name.slice(sep + 1).trim() }
  }
  return { client: null, trip: name }
}

export function QuoteHero({ quote }: { quote: QuoteData }) {
  const { tripDays, tripNights, isSample } = quote
  const { client, trip } = parseQuoteName(quote.name)

  // 標題：行程描述（自動換行）
  const title = isSample
    ? `清邁親子\n${tripDays}天${tripNights}夜經典套餐`
    : trip.replace(/(\d+天\d+夜)/, '\n$1') // 在「X天X夜」前換行

  const subtitle = quote.children > 0
    ? `${quote.adults}大${quote.children}小`
    : `${quote.adults}位旅客`

  // 客戶名：從 name 拆出，或 null（sample 模式）
  const clientName = isSample ? null : client

  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: 'min(100vh, 960px)', background: '#0B0A08' }}
    >
      {/* ── Background layers ── */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-bg.jpg"
          alt=""
          fill
          className="object-cover"
          style={{ filter: 'blur(3px) saturate(1.05)' }}
          priority
        />
        {/* Rim blur */}
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

        {/* ── Logo 大、無白框 ── */}
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease }}
        >
          <Image
            src="/images/logo.png"
            alt="清微旅行"
            width={120}
            height={120}
            className="rounded-3xl object-contain p-2"
            style={{
              background: 'transparent',
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))',
            }}
          />
        </motion.div>

        {/* ── 品牌名 + 定位語 ── */}
        <motion.div
          className="mt-5 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
        >
          <div
            className="text-[26px] font-black tracking-[0.1em] md:text-[30px]"
            style={{
              color: '#FDFCF0',
              fontFamily: 'var(--font-display, serif)',
              textShadow: '0 2px 14px rgba(0,0,0,0.55)',
            }}
          >
            清微旅行
          </div>
          <div
            className="mt-2 text-[14px] font-bold tracking-[0.15em] md:text-[15px]"
            style={{ color: '#FFD700' }}
          >
            爸媽開的清邁親子包車
          </div>
        </motion.div>

        {/* ── 金色分隔線 ── */}
        <motion.div
          className="mx-auto my-7 h-[2px] w-16 rounded-full md:my-9"
          style={{ background: 'rgba(255,215,0,0.5)' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        />

        {/* ── 標題 ── */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.9, ease }}
          className="whitespace-pre-line text-center font-black leading-[1.04]"
          style={{
            fontSize: 'clamp(40px, 8vw, 92px)',
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-display, serif)',
            background: 'linear-gradient(180deg, #FDFCF0 0%, #F7EFD3 55%, #E8D9A7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.35)) drop-shadow(0 6px 18px rgba(0,0,0,0.55))',
          }}
        >
          {title}
        </motion.h1>

        {/* ── 副標題 ── */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5, ease }}
          className="mt-5 text-center text-[16px] font-medium tracking-[0.05em] md:text-[18px]"
          style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.75 }}
        >
          {subtitle}
        </motion.p>

        {/* ── 客戶專屬 badge ── */}
        {!isSample && clientName && (
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
              {clientName} 專屬行程
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
