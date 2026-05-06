'use client'

import { ExternalLink, MessageCircle } from 'lucide-react'

const LINE_URL = 'https://line.me/R/ti/p/@037nyuwk'

export function QuoteFooter({ isSample }: { isSample: boolean }) {
  return (
    <footer className="px-6 py-10 text-center" style={{ background: '#FDFBF4' }}>
      <div
        className="mx-auto mb-6 max-w-xl rounded-[24px] px-6 py-7"
        style={{
          background: 'rgba(255, 255, 255, 0.68)',
          border: '1px solid rgba(202, 138, 4, 0.22)',
          boxShadow: '0 18px 42px rgba(110, 77, 49, 0.08)',
        }}
      >
        <p
          className="text-[18px] font-black"
          style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
        >
          想調整行程或確認報價？
        </p>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-[1.8]" style={{ color: '#5F5648' }}>
          直接回 LINE 跟我們說，我們會依照人數、房型與實際需求協助微調。
        </p>
        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ background: '#06C755' }}
        >
          <MessageCircle size={17} />
          LINE 聊聊行程
        </a>
      </div>
      <a
        href="https://chiangway-travel.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold"
        style={{ background: '#0F0B05', color: '#FDFBF4' }}
      >
        <ExternalLink size={14} /> chiangway-travel.com
      </a>
      <div className="mt-3 text-[11px] tracking-[0.1em]" style={{ color: '#9A8E7E' }}>
        清微旅行 · 爸媽開的清邁親子包車
      </div>
    </footer>
  )
}
