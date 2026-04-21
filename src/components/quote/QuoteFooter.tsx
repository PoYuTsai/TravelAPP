'use client'

import { ExternalLink } from 'lucide-react'

export function QuoteFooter({ isSample }: { isSample: boolean }) {
  return (
    <footer className="px-6 py-6 text-center" style={{ background: '#FDFBF4' }}>
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
