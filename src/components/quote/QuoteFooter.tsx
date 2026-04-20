'use client'

import { motion } from 'framer-motion'
import { MessageCircle, ArrowUp, ExternalLink } from 'lucide-react'

interface QuoteFooterProps {
  isSample: boolean
}

const LINE_URL = 'https://line.me/R/ti/p/@037nyuwk'

export function QuoteFooter({ isSample }: QuoteFooterProps) {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative overflow-hidden"
    >
      {/* Yellow CTA section (HTML lines 1171-1194) */}
      <section
        className="relative overflow-hidden px-6 py-20 md:px-10 md:py-28"
        style={{ background: '#FACC15' }}
      >
        {/* Animated dashed SVG path */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 1200 400"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M -20 320 Q 300 120 620 260 T 1240 180"
            stroke="#0F0B05"
            strokeWidth="2.5"
            strokeDasharray="8 10"
            strokeLinecap="round"
            fill="none"
            opacity="0.25"
            className="animate-dash-flow"
          />
        </svg>

        <div className="relative mx-auto max-w-4xl text-center">
          <h2
            className="font-black leading-[1.1]"
            style={{
              fontSize: 'clamp(30px, 4.5vw, 56px)',
              color: '#0F0B05',
              textWrap: 'balance',
              fontFamily: 'var(--font-display, serif)',
            }}
          >
            這份行程，<br className="md:hidden" />
            就差你們家的名字了
          </h2>
          <p
            className="mx-auto mt-6 max-w-2xl text-[16px] leading-[1.75] md:text-[18px]"
            style={{ color: '#1F1A10' }}
          >
            每個家庭都不一樣。告訴我們孩子年齡、長輩腳力、想去想吃的地方，我們把這條路徑微調成你們的專屬版本。
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={LINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-[16px] font-bold text-white"
              style={{
                background: '#06C755',
                boxShadow: '0 8px 20px rgba(6,199,85,0.32)',
              }}
            >
              <MessageCircle size={18} />{' '}
              {isSample ? 'LINE 聊聊我家的版本' : 'LINE 確認這份報價'}
            </a>
            <a
              href="https://chiangway-travel.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-[16px] font-bold"
              style={{ background: '#0F0B05', color: '#FDFBF4' }}
            >
              <ExternalLink size={16} /> chiangway-travel.com
            </a>
          </div>

          {/* Brand info */}
          <div className="mt-10 text-[12px] tracking-[0.12em]" style={{ color: '#3A3224' }}>
            &copy; {new Date().getFullYear()} 清微旅行 CHIANGWAY TRAVEL · 爸媽開的清邁親子包車
          </div>
        </div>
      </section>
    </motion.footer>
  )
}
