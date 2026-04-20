'use client'

import { motion } from 'framer-motion'
import { ChevronDown, MessageCircle } from 'lucide-react'
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
    ? `清邁親子${tripDays}天${tripNights}夜 精緻路徑手冊`
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
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, #FDE68A 0%, #FACC15 55%, #EAB308 100%)',
      }}
    >
      {/* Animated dashed SVG path */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <motion.path
          d="M-20,80 Q200,20 400,90 T800,60"
          fill="none"
          stroke="rgba(15,11,5,0.08)"
          strokeWidth="2"
          strokeDasharray="8 6"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: 'easeInOut' }}
        />
        <motion.path
          d="M-20,180 Q250,120 500,190 T900,150"
          fill="none"
          stroke="rgba(15,11,5,0.05)"
          strokeWidth="1.5"
          strokeDasharray="6 8"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.5, ease: 'easeInOut', delay: 0.3 }}
        />
      </svg>

      <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-12">
        {/* Top bar */}
        <div className="flex items-start justify-between">
          {/* Brand strip */}
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
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
                style={{ color: '#0F0B05' }}
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
            transition={{ duration: 0.5, delay: 0.2 }}
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
        <div className="mt-10 sm:mt-14">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="mb-4 inline-block rounded-full border px-4 py-1.5 text-[12px] font-semibold tracking-[0.15em]"
            style={{
              color: '#3A3224',
              borderColor: 'rgba(58,50,36,0.25)',
              background: 'rgba(255,255,255,0.2)',
            }}
          >
            {badge}
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-[28px] font-black leading-tight sm:text-[36px]"
            style={{ color: '#0F0B05' }}
          >
            {title}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.65 }}
            className="mt-4 max-w-xl whitespace-pre-line text-[15px] leading-relaxed sm:text-[16px]"
            style={{ color: '#3A3224' }}
          >
            {subtitle}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <button
              onClick={() => {
                document
                  .getElementById('itinerary')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold transition-transform hover:scale-[1.03] active:scale-[0.98]"
              style={{
                background: '#0F0B05',
                color: '#FDE68A',
              }}
            >
              {ctaScroll}
              <ChevronDown className="h-4 w-4" />
            </button>

            <a
              href={LINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
              style={{ background: '#06C755' }}
            >
              <MessageCircle className="h-4 w-4" />
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
