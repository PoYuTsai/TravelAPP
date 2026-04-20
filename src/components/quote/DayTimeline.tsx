'use client'

import { motion } from 'framer-motion'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Hotel } from 'lucide-react'
import type { TimelineItem, ItemKind } from '@/lib/quote/inferTimelineItem'

const KIND_META: Record<ItemKind, { label: string; bg: string; text: string }> = {
  transport: { label: '交通', bg: '#F6F1E4', text: '#1F1A10' },
  stop:      { label: '停留', bg: '#F2ECD9', text: '#1F1A10' },
  meal:      { label: '用餐', bg: 'rgba(184, 92, 56, 0.1)', text: '#B85C38' },
  snack:     { label: '下午茶', bg: 'rgba(232, 162, 59, 0.15)', text: '#CA8A04' },
  activity:  { label: '體驗', bg: '#FCD34D', text: '#0F0B05' },
}

function getIcon(name: string): LucideIcon {
  const icon = (LucideIcons as Record<string, unknown>)[name] as LucideIcon | undefined
  return icon ?? LucideIcons.Sparkles
}

interface Props {
  items: TimelineItem[]
  hotel: string | null
  heroColor?: string
}

export function DayTimeline({ items, hotel, heroColor = '#E8A23B' }: Props) {
  return (
    <div className="mt-6">
      <div
        className="text-[11px] tracking-[0.2em] mb-6"
        style={{ color: '#7A6F5C' }}
      >
        HOUR-BY-HOUR
      </div>

      <ol className="relative">
        {/* Vertical rail */}
        <div
          className="absolute left-[14px] top-2 bottom-2 w-[2.5px]"
          style={{ background: '#FEF3C7' }}
        />
        <div
          className="absolute left-[14px] top-2 bottom-2 w-[2.5px] border-l-[2.5px] border-dashed"
          style={{ borderColor: '#FACC15' }}
        />

        {items.map((it, i) => {
          const IconComp = getIcon(it.icon)
          const kindMeta = KIND_META[it.kind]

          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * i, duration: 0.4 }}
              whileHover={{
                scale: 1.02,
                x: 6,
                background: `linear-gradient(90deg, ${heroColor}14 0%, ${heroColor}04 70%, transparent 100%)`,
              }}
              className="relative pl-12 py-4 pr-4 rounded-xl cursor-default"
              style={{ transformOrigin: 'left center' }}
            >
              {/* Icon circle */}
              <span
                className="absolute left-0 top-[18px] w-[32px] h-[32px] rounded-full flex items-center justify-center"
                style={{
                  background: '#FDFBF4',
                  border: '2.5px solid #D8D2C2',
                  color: '#A8A08E',
                }}
              >
                <IconComp size={14} />
              </span>

              {/* Time + kind chip */}
              <div className="flex flex-wrap items-baseline gap-3">
                <span
                  className="text-[12px] tracking-[0.12em] tabular-nums font-medium"
                  style={{ color: '#7A6F5C' }}
                >
                  {it.time}
                </span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full tracking-[0.1em]"
                  style={{
                    background: kindMeta.bg,
                    color: kindMeta.text,
                  }}
                >
                  {kindMeta.label}
                </span>
              </div>

              {/* Label */}
              <div
                className="font-bold text-[17px] md:text-[19px] mt-1.5"
                style={{ color: '#0F0B05' }}
              >
                {it.label}
              </div>
            </motion.li>
          )
        })}
      </ol>

      {/* Hotel info */}
      {hotel && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-6 flex items-center gap-3 px-5 py-4 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%)',
            border: '1.5px solid #FACC15',
          }}
        >
          <Hotel size={18} style={{ color: '#CA8A04' }} />
          <div>
            <div
              className="text-[10px] tracking-[0.15em] font-bold"
              style={{ color: '#CA8A04' }}
            >
              TODAY&apos;S HOTEL
            </div>
            <div
              className="font-bold text-[15px] mt-0.5"
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
