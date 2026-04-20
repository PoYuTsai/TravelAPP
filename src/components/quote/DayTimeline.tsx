'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Hotel } from 'lucide-react'
import type { TimelineItem, ItemKind } from '@/lib/quote/inferTimelineItem'

/* ─── Kind metadata ─── */

const KIND_META: Record<ItemKind, { label: string; bg: string; text: string }> = {
  transport: { label: '交通', bg: '#F6F1E4', text: '#1F1A10' },
  stop:      { label: '停留', bg: '#F2ECD9', text: '#1F1A10' },
  meal:      { label: '用餐', bg: '#FEE4D6', text: '#B85C38' },
  snack:     { label: '下午茶', bg: '#FEF3C7', text: '#92400E' },
  activity:  { label: '體驗', bg: '#FCD34D', text: '#0F0B05' },
}

function getIcon(name: string): LucideIcon {
  const icon = (LucideIcons as Record<string, unknown>)[name] as LucideIcon | undefined
  return icon ?? LucideIcons.Sparkles
}

/* ─── TimelineItemRow — full hover effects (HTML lines 822-883) ─── */

function TimelineItemRow({
  item,
  index,
  heroColor,
}: {
  item: TimelineItem
  index: number
  heroColor: string
}) {
  const itemRef = useRef<HTMLLIElement>(null)
  const [inView, setInView] = useState(false)
  const [hover, setHover] = useState(false)

  useEffect(() => {
    if (!itemRef.current) return
    const io = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting && e.intersectionRatio > 0.45),
      { threshold: [0, 0.45, 1], rootMargin: '-30% 0px -30% 0px' },
    )
    io.observe(itemRef.current)
    return () => io.disconnect()
  }, [])

  const emphasized = inView || hover
  const IconComp = getIcon(item.icon)
  const kindMeta = KIND_META[item.kind]

  return (
    <motion.li
      ref={itemRef}
      layout
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.05 * index, duration: 0.4 }}
      animate={{ scale: hover ? 1.035 : 1, x: hover ? 6 : 0 }}
      className="group relative cursor-pointer rounded-xl py-4 pl-12 pr-4"
      style={{
        transformOrigin: 'left center',
        background: hover
          ? `linear-gradient(90deg, ${heroColor}14 0%, ${heroColor}04 70%, transparent 100%)`
          : 'transparent',
        boxShadow: hover
          ? `0 18px 36px -10px ${heroColor}33, 0 0 0 1px ${heroColor}22`
          : 'none',
        transition: 'background 0.35s ease, box-shadow 0.35s ease',
      }}
    >
      {/* Hover glow blob (left) */}
      <AnimatePresence>
        {hover && (
          <motion.span
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none absolute -left-3 top-[10px] h-[48px] w-[48px] rounded-full"
            style={{
              background: `radial-gradient(circle, ${heroColor}99 0%, ${heroColor}00 65%)`,
              filter: 'blur(10px)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Icon with multi-ring glow + shake on hover */}
      <motion.span
        animate={{
          scale: hover ? 1.32 : emphasized ? 1.08 : 1,
          rotate: hover ? [0, -6, 5, 0] : 0,
        }}
        transition={{
          type: 'spring',
          damping: 14,
          stiffness: 240,
          rotate: { duration: 0.5 },
        }}
        className={`absolute left-0 top-[18px] flex h-[32px] w-[32px] items-center justify-center rounded-full ${emphasized && !hover ? 'animate-icon-pulse' : ''}`}
        style={{
          background: emphasized ? heroColor : '#FDFBF4',
          border: `2.5px solid ${emphasized ? heroColor : '#D8D2C2'}`,
          color: emphasized ? '#0F0B05' : '#A8A08E',
          boxShadow: hover
            ? `0 0 0 8px ${heroColor}44, 0 0 28px ${heroColor}cc, 0 8px 18px ${heroColor}88`
            : emphasized
              ? `0 0 0 6px ${heroColor}33, 0 0 18px ${heroColor}88`
              : 'none',
        }}
      >
        <IconComp size={14} />
      </motion.span>

      {/* Time + kind chip row */}
      <motion.div
        animate={{ y: hover ? -1 : 0 }}
        className="relative flex flex-wrap items-baseline gap-3"
      >
        <span
          className="text-[12px] tabular-nums tracking-[0.12em]"
          style={{
            color: emphasized ? '#0F0B05' : '#7A6F5C',
            fontWeight: emphasized ? 900 : 500,
            transition: 'color 0.3s',
          }}
        >
          {item.time}
        </span>
        <motion.span
          animate={{ scale: hover ? 1.08 : 1 }}
          className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.1em]"
          style={{ background: kindMeta.bg, color: kindMeta.text }}
        >
          {kindMeta.label}
        </motion.span>
      </motion.div>

      {/* Label */}
      <motion.div
        animate={{ color: hover ? heroColor : '#0F0B05', y: hover ? -1 : 0 }}
        className="relative mt-1.5 text-[17px] font-bold md:text-[19px]"
        style={{
          textWrap: 'balance',
          transition: 'color 0.3s',
          fontFamily: 'var(--font-display, serif)',
        }}
      >
        {item.label}
      </motion.div>
    </motion.li>
  )
}

/* ─── Main Component ─── */

interface Props {
  items: TimelineItem[]
  hotel: string | null
  heroColor?: string
}

export function DayTimeline({ items, hotel, heroColor = '#E8A23B' }: Props) {
  return (
    <div>
      <div className="mb-6 text-[11px] tracking-[0.2em]" style={{ color: '#7A6F5C' }}>
        HOUR-BY-HOUR
      </div>

      <ol className="relative">
        {/* Glowing breathing rail (SVG) */}
        <svg
          className="pointer-events-none absolute left-[14px] top-2 bottom-2"
          width="4"
          height="100%"
          viewBox="0 0 4 1000"
          preserveAspectRatio="none"
        >
          <line
            x1="2" y1="0" x2="2" y2="1000"
            stroke="#FEF3C7"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1="2" y1="0" x2="2" y2="1000"
            stroke="#FACC15"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="10 12"
            className="animate-breath-line animate-path-dash"
          />
        </svg>

        {items.map((item, i) => (
          <TimelineItemRow
            key={i}
            item={item}
            index={i}
            heroColor={heroColor}
          />
        ))}
      </ol>

      {/* Hotel info */}
      {hotel && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-6 flex items-center gap-3 rounded-2xl px-5 py-4"
          style={{
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%)',
            border: '1.5px solid #FACC15',
          }}
        >
          <Hotel size={18} style={{ color: '#CA8A04' }} />
          <div>
            <div
              className="text-[10px] font-bold tracking-[0.15em]"
              style={{ color: '#CA8A04' }}
            >
              TODAY&apos;S HOTEL
            </div>
            <div
              className="mt-0.5 text-[15px] font-bold"
              style={{ color: '#0F0B05' }}
            >
              {hotel}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
