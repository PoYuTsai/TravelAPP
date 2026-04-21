'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import type { QuoteData } from '@/lib/quote/types'

export function QuoteHero({ quote }: { quote: QuoteData }) {
  const { tripDays, tripNights, isSample } = quote

  const title = isSample
    ? `清邁親子\n${tripDays}天${tripNights}夜經典套餐`
    : quote.name

  const subtitle = isSample
    ? `${tripDays}天${tripNights}夜 · 2大2小`
    : `${tripDays}天${tripNights}夜 · ${quote.adults}大${quote.children}小${quote.createdAt ? ` · ${formatDateRange(quote.createdAt)}` : ''}`

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
      {/* Animated dashed SVG path */}
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

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
        {/* Brand — centered */}
        <motion.div
          className="flex flex-col items-center text-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Image
            src="/images/logo.png"
            alt="清微旅行"
            width={88}
            height={88}
            className="rounded-2xl object-contain p-2"
            style={{ background: '#0F0B05' }}
          />
          <div
            className="mt-3 text-[20px] font-black tracking-[0.05em]"
            style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
          >
            清微旅行
          </div>
          <div
            className="text-[10px] tracking-[0.18em]"
            style={{ color: '#7A6F5C' }}
          >
            CHIANGWAY TRAVEL
          </div>
          <div
            className="mt-1.5 text-[13px] font-medium"
            style={{ color: '#3A3224' }}
          >
            爸媽開的清邁親子包車
          </div>
        </motion.div>

        {/* Divider */}
        <motion.div
          className="mx-auto my-6 h-[2px] w-12 rounded-full md:my-8"
          style={{ background: '#0F0B0533' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        />

        {/* Title — centered */}
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="whitespace-pre-line font-black leading-[1.08]"
            style={{
              fontSize: 'clamp(36px, 7vw, 80px)',
              letterSpacing: '0.03em',
              color: '#0F0B05',
              fontFamily: 'var(--font-display, serif)',
            }}
          >
            {title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4 text-[15px] md:text-[17px]"
            style={{ color: '#3A3224' }}
          >
            {subtitle}
          </motion.p>
        </div>
      </div>
    </motion.section>
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
