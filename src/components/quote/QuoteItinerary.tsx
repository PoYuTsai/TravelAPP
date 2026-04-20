'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { QuoteData, QuoteItineraryDay } from '@/lib/quote/types'
import { DayTimeline } from './DayTimeline'
import { DayPhotos } from './DayPhotos'

const DAY_COLORS = ['#E8A23B', '#4A6B3A', '#A8C8DC', '#CA8A04', '#B85C38', '#9333EA', '#059669', '#DC2626']
const DAY_GLYPHS = ['🛬', '🐘', '🏊', '🎢', '✈️', '🏔️', '🌴', '🎪']

/* ───── Desktop Path Node ───── */

interface PathNodeProps {
  index: number
  day: QuoteItineraryDay
  color: string
  glyph: string
  active: boolean
  onClick: () => void
}

function PathNode({ index, day, color, glyph, active, onClick }: PathNodeProps) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className="relative flex flex-col items-center text-left cursor-pointer group"
      style={{ outline: 'none' }}
    >
      {/* Pulse ring when active */}
      {active && (
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[88px] h-[88px] rounded-full animate-ping"
          style={{ background: color, opacity: 0.2 }}
        />
      )}

      {/* Main disc */}
      <motion.div
        animate={{
          scale: active ? 1.05 : 1,
          boxShadow: active
            ? `0 14px 32px ${color}77, 0 0 0 6px ${color}22`
            : '0 4px 10px rgba(15,11,5,0.08)',
        }}
        whileHover={{
          scale: 1.08,
          boxShadow: `0 16px 36px ${color}88, 0 0 0 4px ${color}33`,
        }}
        transition={{ type: 'spring', damping: 16, stiffness: 260 }}
        className="relative w-[88px] h-[88px] rounded-full flex items-center justify-center"
        style={{
          background: active ? '#0F0B05' : '#FDFBF4',
          border: `3px solid ${active ? color : '#0F0B05'}`,
        }}
      >
        <motion.span
          whileHover={{ rotate: [0, -8, 6, -4, 0], scale: 1.18 }}
          transition={{ duration: 0.6 }}
          className="text-[36px] block"
        >
          {glyph}
        </motion.span>
      </motion.div>

      {/* Labels */}
      <div
        className="mt-3 text-[10px] tracking-[0.2em] font-medium"
        style={{ color: '#7A6F5C' }}
      >
        DAY {index + 1}
      </div>
      <div
        className="font-bold mt-1 text-[17px]"
        style={{ color: '#0F0B05' }}
      >
        {day.title}
      </div>
      <div className="text-[12px] mt-0.5" style={{ color: '#7A6F5C' }}>
        {day.day}
      </div>
    </motion.button>
  )
}

/* ───── Mobile Path Node ───── */

function PathNodeMobile({ index, day, color, glyph, active, onClick }: PathNodeProps) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="relative flex items-center gap-4 w-full text-left pl-0"
      style={{ outline: 'none' }}
    >
      <div
        className="relative z-10 w-[58px] h-[58px] rounded-full flex items-center justify-center shrink-0"
        style={{
          background: active ? '#0F0B05' : '#FDFBF4',
          border: `2.5px solid ${active ? color : '#0F0B05'}`,
        }}
      >
        <span className="text-[26px]">{glyph}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[10px] tracking-[0.2em]"
          style={{ color: '#7A6F5C' }}
        >
          DAY {index + 1}
        </div>
        <div
          className="font-bold text-[18px] truncate"
          style={{ color: '#0F0B05' }}
        >
          {day.title}
        </div>
        <div className="text-[12px]" style={{ color: '#7A6F5C' }}>
          {day.day}
        </div>
      </div>
      {active ? (
        <ChevronUp size={20} className="shrink-0" style={{ color: '#7A6F5C' }} />
      ) : (
        <ChevronDown size={20} className="shrink-0" style={{ color: '#7A6F5C' }} />
      )}
    </motion.button>
  )
}

/* ───── Main Component ───── */

interface Props {
  quote: QuoteData
}

export function QuoteItinerary({ quote }: Props) {
  const [activeDay, setActiveDay] = useState<number | null>(null)

  const toggle = (i: number) => setActiveDay(activeDay === i ? null : i)

  return (
    <section
      id="itinerary"
      className="relative py-20 px-6 md:px-10"
      style={{ background: '#FDFBF4' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <div
            className="inline-block text-[11px] tracking-[0.2em] font-bold"
            style={{ color: '#CA8A04' }}
          >
            THE PATH FLOW
          </div>
          <h2
            className="font-bold mt-3"
            style={{
              fontSize: 'clamp(28px, 4vw, 44px)',
              color: '#0F0B05',
            }}
          >
            {quote.tripDays}日，一條路徑
          </h2>
          <p
            className="mt-4 text-[15px] max-w-xl mx-auto"
            style={{ color: '#3A3224' }}
          >
            點擊任一節點，展開當日的完整流程。
          </p>
        </div>

        {/* Desktop: horizontal path nodes */}
        <div className="hidden md:block relative">
          {/* Dashed SVG path connecting nodes */}
          <svg
            className="absolute left-0 right-0 top-[72px] w-full"
            height="60"
            viewBox="0 0 1000 60"
            preserveAspectRatio="none"
          >
            <path
              d="M 40 30 Q 220 -10 400 30 T 760 30 T 960 30"
              stroke="#FACC15"
              strokeWidth="3"
              strokeDasharray="6 8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <div
            className="relative grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${quote.itinerary.length}, 1fr)`,
            }}
          >
            {quote.itinerary.map((day, i) => (
              <PathNode
                key={i}
                index={i}
                day={day}
                color={DAY_COLORS[i % DAY_COLORS.length]}
                glyph={DAY_GLYPHS[i % DAY_GLYPHS.length]}
                active={activeDay === i}
                onClick={() => toggle(i)}
              />
            ))}
          </div>
        </div>

        {/* Mobile: vertical path nodes */}
        <div className="md:hidden relative">
          <div
            className="absolute left-[28px] top-0 bottom-0 w-[2px] border-l-2 border-dashed"
            style={{ borderColor: '#FACC15' }}
          />
          <div className="space-y-4">
            {quote.itinerary.map((day, i) => (
              <PathNodeMobile
                key={i}
                index={i}
                day={day}
                color={DAY_COLORS[i % DAY_COLORS.length]}
                glyph={DAY_GLYPHS[i % DAY_GLYPHS.length]}
                active={activeDay === i}
                onClick={() => toggle(i)}
              />
            ))}
          </div>
        </div>

        {/* Expanded day detail */}
        <AnimatePresence mode="wait">
          {activeDay !== null && (
            <motion.div
              key={activeDay}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 overflow-hidden"
            >
              <div className="rounded-[28px] overflow-hidden border-2 bg-white" style={{ borderColor: '#0F0B05', boxShadow: '12px 12px 0 #0F0B05' }}>
                {/* Day header bar */}
                <div
                  className="relative px-6 md:px-10 py-6 md:py-8"
                  style={{ background: DAY_COLORS[activeDay % DAY_COLORS.length] }}
                >
                  <svg
                    className="absolute right-0 top-0 h-full"
                    viewBox="0 0 300 200"
                    preserveAspectRatio="none"
                    style={{ width: '50%', opacity: 0.18 }}
                  >
                    <path
                      d="M 10 180 Q 100 40 200 100 T 290 30"
                      stroke="#0F0B05"
                      strokeWidth="3"
                      strokeDasharray="8 8"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="relative flex justify-between items-start gap-4 flex-wrap">
                    <div>
                      <div
                        className="text-[12px] tracking-[0.22em]"
                        style={{ color: '#0F0B05' }}
                      >
                        {quote.itinerary[activeDay].day}
                      </div>
                      <h3
                        className="font-bold mt-2 leading-tight"
                        style={{
                          fontSize: 'clamp(28px, 4vw, 48px)',
                          color: '#0F0B05',
                        }}
                      >
                        {quote.itinerary[activeDay].title}
                      </h3>
                    </div>
                    <button
                      onClick={() => setActiveDay(null)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-[13px]"
                      style={{ background: '#0F0B05', color: '#FDFBF4' }}
                    >
                      <ChevronUp size={14} /> 收合
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 md:p-10">
                  <DayPhotos photos={quote.photos} dayIndex={activeDay} />
                  <DayTimeline
                    items={quote.itinerary[activeDay].items}
                    hotel={quote.itinerary[activeDay].hotel}
                    heroColor={DAY_COLORS[activeDay % DAY_COLORS.length]}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
