'use client'

import { motion } from 'framer-motion'
import { MessageCircle, ArrowUp } from 'lucide-react'

interface QuoteFooterProps {
  isSample: boolean
}

const LINE_URL = 'https://line.me/R/ti/p/@037nyuwk'

export function QuoteFooter({ isSample }: QuoteFooterProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <motion.footer
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative mt-12 overflow-hidden"
    >
      {/* Dark gradient card */}
      <div
        className="relative rounded-3xl px-6 py-12 text-center"
        style={{
          background: 'linear-gradient(135deg, #0F0B05 0%, #1F1A10 100%)',
        }}
      >
        {/* Animated dashed SVG path background */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <path
            d="M 40 20 Q 200 80, 360 40 T 680 60 T 1000 30"
            fill="none"
            stroke="#FACC15"
            strokeWidth="1"
            strokeDasharray="8 6"
            opacity="0.15"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-28"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M 20 100 Q 180 60, 400 120 T 720 80 T 1000 110"
            fill="none"
            stroke="#FACC15"
            strokeWidth="1"
            strokeDasharray="6 8"
            opacity="0.1"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="28"
              dur="3s"
              repeatCount="indefinite"
            />
          </path>
        </svg>

        <div className="relative z-10">
          <h2 className="mb-8 text-xl font-medium" style={{ color: '#EAE4D2' }}>
            想聊聊這趟旅行嗎？
          </h2>

          {/* LINE CTA button */}
          <motion.a
            href={LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="mx-auto mb-6 flex w-fit items-center gap-3 rounded-full px-8 py-4 text-lg font-bold text-white shadow-lg transition-shadow hover:shadow-xl"
            style={{ backgroundColor: '#06C755' }}
          >
            <MessageCircle className="h-5 w-5" />
            {isSample ? 'LINE 聊聊行程' : 'LINE 確認這份報價'}
          </motion.a>

          {/* Scroll to top button */}
          <button
            onClick={scrollToTop}
            className="mx-auto flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors hover:bg-white/5"
            style={{
              borderColor: '#FACC15',
              color: '#FACC15',
            }}
          >
            <ArrowUp className="h-4 w-4" />
            重新瀏覽行程
          </button>
        </div>
      </div>

      {/* Brand info */}
      <div className="mt-8 pb-8 text-center">
        <p className="text-base font-medium" style={{ color: '#EAE4D2' }}>
          清微旅行 Chiangway Travel
        </p>
        <p className="mt-1 text-sm" style={{ color: '#7A6F5C' }}>
          台灣爸爸 &times; 泰國媽媽｜清邁親子包車
        </p>
        <p className="mt-2 text-xs" style={{ color: '#7A6F5C' }}>
          &copy; {new Date().getFullYear()} Chiangway Travel
        </p>
      </div>
    </motion.footer>
  )
}
