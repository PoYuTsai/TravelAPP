'use client'

import { motion } from 'framer-motion'
import { ArrowDown, MessageCircle, Sparkles } from 'lucide-react'
import Image from 'next/image'
import type { QuoteData } from '@/lib/quote/types'

const LINE_URL = 'https://line.me/R/ti/p/@037nyuwk'

interface QuoteHeroProps {
  quote: QuoteData
}

export function QuoteHero({ quote }: QuoteHeroProps) {
  const { tripDays, tripNights, isSample } = quote

  const badge = `CHIANG MAI · ${tripDays}D${tripNights}N`

  const title = isSample
    ? `清邁親子${tripDays === 5 ? '五' : tripDays}日精緻路徑手冊`
    : quote.name

  const subtitle = isSample
    ? `從接機到送機，一條路徑，${tripDays}個白天。\n司機專心開車，導遊專心服務，孩子笑得出來，長輩坐得舒服。`
    : `${tripDays}天${tripNights}夜 · ${quote.adults}大${quote.children}小${quote.createdAt ? ` · ${formatDateRange(quote.createdAt)}` : ''}`

  const refNumber = `No. CWT-${new Date().getFullYear()}-CNX-${String(tripDays).padStart(2, '0')}D${String(tripNights).padStart(2, '0')}N`

  const ctaScroll = '展開行程路徑'
  const ctaLine = isSample ? 'LINE 聊聊行程' : 'LINE 確認這份報價'

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #FDE68A 0%, #FACC15 55%, #EAB308 100%)',
      }}
    >
      {/* Animated dashed SVG path — faithfully from HTML */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1600 700"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M -20 520 Q 300 340 620 460 T 1240 380 T 1650 280"
          stroke="#0F0B05"
          strokeWidth="2"
          strokeDasharray="8 10"
          strokeLinecap="round"
          fill="none"
          opacity="0.25"
          className="animate-dash-flow"
        />
      </svg>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-20">
        {/* Top bar */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Brand strip */}
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <Image
              src="/images/logo.png"
              alt="清微旅行"
              width={48}
              height={48}
              className="rounded-xl object-contain p-1"
              style={{ background: '#FCD34D' }}
            />
            <div className="leading-tight">
              <div
                className="text-[18px] font-black tracking-[0.05em]"
                style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
              >
                清微旅行
              </div>
              <div
                className="text-[10px] tracking-[0.14em]"
                style={{ color: '#7A6F5C' }}
              >
                CHIANGWAY TRAVEL
              </div>
            </div>
          </motion.div>

          {/* Top right label */}
          <motion.div
            className="hidden text-right sm:block"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div
              className="text-[11px] tracking-[0.2em]"
              style={{ color: '#3A3224' }}
            >
              PRIVATE ITINERARY · FAMILY
            </div>
            <div className="mt-1 text-[13px]" style={{ color: '#3A3224' }}>
              {refNumber}
            </div>
          </motion.div>
        </div>

        {/* Main content */}
        <div className="mt-14 max-w-4xl md:mt-24">
          {/* Badge pill */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold tracking-[0.14em]"
            style={{ background: '#0F0B05', color: '#FDFBF4' }}
          >
            <Sparkles size={13} /> {badge}
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-5 font-black leading-[1.02]"
            style={{
              fontSize: 'clamp(44px, 8vw, 104px)',
              letterSpacing: '0.04em',
              color: '#0F0B05',
              textWrap: 'balance',
              fontFamily: 'var(--font-display, serif)',
            }}
          >
            {title}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-7 max-w-2xl whitespace-pre-line text-[17px] leading-[1.75] md:text-[20px]"
            style={{ color: '#1F1A10' }}
          >
            {subtitle}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <button
              onClick={() => {
                document
                  .getElementById('itinerary')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold transition-all hover:-translate-y-[1px]"
              style={{
                background: '#0F0B05',
                color: '#FDFBF4',
                boxShadow: '0 8px 20px rgba(15,11,5,0.22)',
              }}
            >
              {ctaScroll} <ArrowDown size={16} />
            </button>

            <a
              href={LINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold text-white"
              style={{ background: '#06C755' }}
            >
              <MessageCircle size={16} />
              {ctaLine}
            </a>
          </motion.div>
        </div>
      </div>
    </motion.section>
  )
}

/** Format a date string to a readable range hint */
function formatDateRange(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const m = d.getMonth() + 1
    const day = d.getDate()
    return `${m}/${day} 出發`
  } catch {
    return ''
  }
}
