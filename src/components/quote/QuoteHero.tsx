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
      style={{ minHeight: '70vh' }}
    >
      {/* Background photo */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-bg.jpg"
          alt=""
          fill
          className="object-cover"
          priority
        />
        {/* Warm gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(253,227,138,0.88) 0%, rgba(250,204,21,0.82) 40%, rgba(234,179,8,0.75) 100%)',
          }}
        />
      </div>

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
          opacity="0.2"
          className="animate-dash-flow"
        />
      </svg>

      <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-6xl flex-col items-center justify-center px-6 py-16 md:px-10 md:py-20">
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
            style={{
              background: '#0F0B05',
              boxShadow: '0 8px 32px rgba(15,11,5,0.3)',
            }}
          />
          <div
            className="mt-4 text-[22px] font-black tracking-[0.05em]"
            style={{
              color: '#0F0B05',
              fontFamily: 'var(--font-display, serif)',
              textShadow: '0 1px 2px rgba(255,255,255,0.3)',
            }}
          >
            清微旅行
          </div>
          <div
            className="text-[10px] font-bold tracking-[0.2em]"
            style={{ color: '#3A3224' }}
          >
            CHIANGWAY TRAVEL
          </div>
          <div
            className="mt-2 rounded-full px-4 py-1 text-[13px] font-bold"
            style={{
              background: 'rgba(15,11,5,0.12)',
              color: '#1F1A10',
              backdropFilter: 'blur(4px)',
            }}
          >
            爸媽開的清邁親子包車
          </div>
        </motion.div>

        {/* Divider */}
        <motion.div
          className="mx-auto my-8 h-[2px] w-16 rounded-full md:my-10"
          style={{ background: 'rgba(15,11,5,0.2)' }}
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
              fontSize: 'clamp(38px, 8vw, 88px)',
              letterSpacing: '0.03em',
              color: '#0F0B05',
              fontFamily: 'var(--font-display, serif)',
              textShadow: '0 2px 4px rgba(255,255,255,0.2)',
            }}
          >
            {title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-5 text-[16px] font-medium md:text-[18px]"
            style={{ color: '#1F1A10' }}
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
