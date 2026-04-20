'use client'

import { motion } from 'framer-motion'
import {
  Baby,
  Car,
  Check,
  HandCoins,
  Home,
  MessageCircle,
  Minus,
  Plane,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Ticket,
  UserCheck,
  UtensilsCrossed,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { QuoteData } from '@/lib/quote/types'

const LINE_URL = 'https://line.me/R/ti/p/@037nyuwk'

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)

// ---------------------------------------------------------------------------
// Icon mapping helpers
// ---------------------------------------------------------------------------

type LucideIcon = ComponentType<{ className?: string; size?: number }>

const INCLUDED_ICON_MAP: [RegExp, LucideIcon][] = [
  [/包車/, Car],
  [/導遊/, UserCheck],
  [/門票/, Ticket],
  [/保險/, ShieldCheck],
  [/住宿/, Home],
  [/餐/, UtensilsCrossed],
  [/座椅/, Baby],
]

const EXCLUDED_ICON_MAP: [RegExp, LucideIcon][] = [
  [/機票/, Plane],
  [/個人消費/, ShoppingBag],
  [/小費/, HandCoins],
  [/住宿/, Home],
  [/餐/, UtensilsCrossed],
]

function pickIcon(text: string, map: [RegExp, LucideIcon][], fallback: LucideIcon): LucideIcon {
  for (const [re, Icon] of map) {
    if (re.test(text)) return Icon
  }
  return fallback
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
}

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function IncludedExcludedSection({
  included,
  excluded,
}: {
  included: string[]
  excluded: string[]
}) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="grid gap-6 md:grid-cols-2"
    >
      {/* Included */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl p-6"
        style={{
          background: 'rgba(255, 255, 255, 0.55)',
          border: '1.5px solid rgba(74, 107, 58, 0.35)',
          boxShadow:
            '0 20px 50px -15px rgba(74, 107, 58, 0.28), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
            <Check className="text-green-700" size={16} />
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-green-700">INCLUDED</p>
            <p className="text-sm font-bold text-green-900">費用已包含</p>
          </div>
        </div>
        <ul className="space-y-3">
          {included.map((item) => {
            const Icon = pickIcon(item, INCLUDED_ICON_MAP, Check)
            return (
              <motion.li key={item} variants={fadeUp} className="flex items-center gap-3">
                <Icon className="shrink-0 text-green-600" size={16} />
                <span className="text-sm text-green-900">{item}</span>
              </motion.li>
            )
          })}
        </ul>
      </motion.div>

      {/* Not Included */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl p-6"
        style={{
          background: 'rgba(255, 255, 255, 0.45)',
          border: '1.5px solid rgba(122, 111, 92, 0.35)',
          boxShadow: '0 20px 50px -15px rgba(122, 111, 92, 0.18)',
        }}
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
            <Minus className="text-gray-500" size={16} />
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-gray-500">NOT INCLUDED</p>
            <p className="text-sm font-bold text-gray-700">費用不含</p>
          </div>
        </div>
        <ul className="space-y-3">
          {excluded.map((item) => {
            const Icon = pickIcon(item, EXCLUDED_ICON_MAP, Minus)
            return (
              <motion.li key={item} variants={fadeUp} className="flex items-center gap-3">
                <Icon className="shrink-0 text-gray-400" size={16} />
                <span className="text-sm text-gray-600">{item}</span>
              </motion.li>
            )
          })}
        </ul>
      </motion.div>
    </motion.div>
  )
}

function LineItemBreakdown({
  items,
  tripDays,
  tripNights,
  adults,
  children,
}: {
  items: { label: string; amountTHB: number; amountTWD: number; description?: string }[]
  tripDays: number
  tripNights: number
  adults: number
  children: number
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="rounded-2xl p-6"
      style={{
        background: '#fffaf2',
        border: '1.5px solid #e7d7c2',
        boxShadow: '0 20px 50px -15px rgba(110, 77, 49, 0.12)',
      }}
    >
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="text-[#c57c35]" size={18} />
          <h3 className="text-lg font-bold text-[#5c4338]">價格明細</h3>
        </div>
        <p className="text-xs text-[#9a826f]">
          {tripDays}天{tripNights}夜 · {adults}大{children}小
        </p>
      </div>
      <div className="space-y-0">
        {items.map((item, i) => (
          <div key={item.label}>
            {i > 0 && (
              <div className="my-3 border-t border-dashed" style={{ borderColor: '#e7d7c2' }} />
            )}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#5c4338]">{item.label}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs text-[#9a826f]">{item.description}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-[#5c4338]">
                  NT$ {fmt(item.amountTWD)}
                </p>
                <p className="text-xs text-[#9a826f]">{fmt(item.amountTHB)} THB</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function TotalQuoteCard({
  name,
  totalTHB,
  totalTWD,
  isSample,
  tripDays,
  tripNights,
}: {
  name: string
  totalTHB: number
  totalTWD: number
  isSample: boolean
  tripDays: number
  tripNights: number
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="relative overflow-hidden rounded-2xl px-6 py-10 text-center"
      style={{
        background: 'linear-gradient(135deg, #0F0B05 0%, #1F1A10 100%)',
      }}
    >
      {/* Animated dashed SVG background */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-10"
        aria-hidden="true"
      >
        <motion.path
          d="M0,60 Q200,20 400,80 T800,50"
          fill="none"
          stroke="#FACC15"
          strokeWidth="1.5"
          strokeDasharray="8 6"
          initial={{ strokeDashoffset: 100 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
        <motion.path
          d="M0,120 Q250,70 500,130 T1000,90"
          fill="none"
          stroke="#FACC15"
          strokeWidth="1"
          strokeDasharray="6 8"
          initial={{ strokeDashoffset: 80 }}
          animate={{ strokeDashoffset: -20 }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
        />
      </svg>

      <div className="relative z-10">
        <p className="mb-1 text-[10px] font-semibold tracking-[0.25em] text-yellow-400/70">
          {isSample ? 'REFERENCE QUOTE' : 'EXCLUSIVE QUOTE'}
        </p>
        <h3 className="mb-6 text-sm font-medium text-white/60">
          {isSample ? '參考報價' : `${name} 專屬行程總報價`}
        </h3>
        <p className="text-4xl font-extrabold tracking-tight text-[#FACC15] sm:text-5xl">
          NT$ {fmt(totalTWD)}
        </p>
        <p className="mt-2 text-sm text-white/50">約 {fmt(totalTHB)} 泰銖</p>

        {isSample && (
          <div className="mt-6 space-y-1">
            <p className="text-xs text-white/40">
              以一家四口 · {tripDays}天{tripNights}夜為例
            </p>
            <p className="text-xs text-yellow-400/50">實際費用依人數與行程客製</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function PaymentNotesSection({
  paymentNotes,
  carCount,
}: {
  paymentNotes: string[]
  carCount: number
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="rounded-2xl p-6"
      style={{
        background: '#fffaf2',
        border: '1.5px solid #e7d7c2',
        boxShadow: '0 20px 50px -15px rgba(110, 77, 49, 0.08)',
      }}
    >
      <h3 className="mb-4 text-base font-bold text-[#5c4338]">付款說明</h3>
      <ul className="space-y-2">
        {paymentNotes.map((note, i) => (
          <li key={i} className="flex gap-2 text-sm text-[#7a6255]">
            <span className="mt-0.5 shrink-0 text-[#d89b47]">&#x2022;</span>
            {note}
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-dashed pt-4" style={{ borderColor: '#e7d7c2' }}>
        <h4 className="mb-1 text-sm font-semibold text-[#5c4338]">超時費用</h4>
        <p className="text-sm text-[#7a6255]">
          每日包車服務最多 10 小時，超時 300 泰銖/小時
          {carCount > 1 ? ` × ${carCount} 台車` : ''}
        </p>
      </div>
    </motion.div>
  )
}

function BankTransferSection() {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="rounded-2xl p-6"
      style={{
        background: '#fffaf2',
        border: '1.5px solid #e7d7c2',
        boxShadow: '0 20px 50px -15px rgba(110, 77, 49, 0.08)',
      }}
    >
      <h3 className="mb-4 text-base font-bold text-[#5c4338]">匯款帳號</h3>
      <div className="space-y-2 text-sm text-[#5c4338]">
        <div className="flex justify-between">
          <span className="text-[#9a826f]">戶名</span>
          <span className="font-medium">蔡柏裕</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#9a826f]">銀行名稱</span>
          <span className="font-medium">彰化銀行</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#9a826f]">銀行代碼</span>
          <span className="font-medium">009</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#9a826f]">帳號</span>
          <span className="font-medium tracking-wider">51619501772100</span>
        </div>
      </div>
    </motion.div>
  )
}

function HotelDepositSection({
  hotels,
  totalDeposit,
}: {
  hotels: { name: string; deposit: number; rooms: number }[]
  totalDeposit: number
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="rounded-2xl p-6"
      style={{
        background: '#fffaf2',
        border: '1.5px solid #e7d7c2',
        boxShadow: '0 20px 50px -15px rgba(110, 77, 49, 0.08)',
      }}
    >
      <h3 className="mb-4 text-base font-bold text-[#5c4338]">住宿押金</h3>
      <div className="space-y-3">
        {hotels.map((hotel) => (
          <div key={hotel.name} className="flex items-start justify-between gap-4 text-sm">
            <div>
              <p className="font-medium text-[#5c4338]">{hotel.name}</p>
              <p className="text-xs text-[#9a826f]">{hotel.rooms} 間房</p>
            </div>
            <p className="shrink-0 font-semibold text-[#5c4338]">{fmt(hotel.deposit)} THB</p>
          </div>
        ))}
      </div>
      <div
        className="mt-4 flex justify-between border-t border-dashed pt-3 text-sm"
        style={{ borderColor: '#e7d7c2' }}
      >
        <span className="font-semibold text-[#5c4338]">押金合計</span>
        <span className="font-bold text-[#c57c35]">{fmt(totalDeposit)} THB</span>
      </div>
    </motion.div>
  )
}

function NullQuoteFallback() {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="rounded-2xl p-8 text-center"
      style={{
        background: '#fffaf2',
        border: '1.5px solid #e7d7c2',
      }}
    >
      <p className="mb-4 text-[#5c4338]">報價資料準備中，請聯繫我們取得完整報價。</p>
      <a
        href={LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-[#06C755] px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle size={16} />
        LINE 聊聊行程
      </a>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface QuoteCostDashboardProps {
  quote: QuoteData
}

export function QuoteCostDashboard({ quote }: QuoteCostDashboardProps) {
  const { isSample } = quote
  const breakdown = quote.quote

  return (
    <section className="relative overflow-hidden py-20">
      {/* Background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: 'linear-gradient(160deg, #F9F5EA 0%, #FEF3C7 55%, #FDE68A 100%)',
        }}
      />

      {/* Decorative glow blobs */}
      <div
        className="absolute -left-32 top-20 -z-10 h-80 w-80 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, #FBBF24 0%, transparent 70%)' }}
      />
      <div
        className="absolute -right-32 bottom-20 -z-10 h-96 w-96 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #F59E0B 0%, transparent 70%)' }}
      />

      <div className="mx-auto max-w-6xl px-4">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <p className="mb-2 text-[10px] font-semibold tracking-[0.3em] text-[#c57c35]">
            PROFESSIONAL SERVICES &middot; QUOTE
          </p>
          <h2 className="text-2xl font-bold text-[#5c4338] sm:text-3xl">費用清單與專屬報價</h2>
          <p className="mt-2 text-sm text-[#7a6255]">
            我們把所有費用攤開給你看，沒有隱藏項目
          </p>
        </motion.div>

        {breakdown === null ? (
          <NullQuoteFallback />
        ) : (
          <div className="space-y-8">
            {/* 1. Included / Not Included */}
            <IncludedExcludedSection
              included={breakdown.included}
              excluded={breakdown.excluded}
            />

            {/* 2. Line Item Breakdown */}
            <LineItemBreakdown
              items={breakdown.items}
              tripDays={quote.tripDays}
              tripNights={quote.tripNights}
              adults={quote.adults}
              children={quote.children}
            />

            {/* 3. Total Quote */}
            <TotalQuoteCard
              name={quote.name}
              totalTHB={breakdown.totalTHB}
              totalTWD={breakdown.totalTWD}
              isSample={isSample}
              tripDays={quote.tripDays}
              tripNights={quote.tripNights}
            />

            {/* 4. Payment Notes — customer only */}
            {!isSample && (
              <PaymentNotesSection
                paymentNotes={breakdown.paymentNotes}
                carCount={quote.carCount}
              />
            )}

            {/* 5. Bank Transfer — customer only */}
            {!isSample && <BankTransferSection />}

            {/* 6. Hotel Deposit — conditional, customer only */}
            {!isSample &&
              quote.collectDeposit &&
              quote.hotelsWithDeposit.length > 0 && (
                <HotelDepositSection
                  hotels={quote.hotelsWithDeposit}
                  totalDeposit={quote.totalDeposit}
                />
              )}
          </div>
        )}
      </div>
    </section>
  )
}
