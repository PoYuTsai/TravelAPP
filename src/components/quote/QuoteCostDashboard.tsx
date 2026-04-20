'use client'

import { motion } from 'framer-motion'
import {
  Baby,
  Calculator,
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
  ArrowUp,
  Droplets,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { QuoteData } from '@/lib/quote/types'

const LINE_URL = 'https://line.me/R/ti/p/@037nyuwk'

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)

/* ─── Icon mapping helpers ─── */

type LucideIcon = ComponentType<{ className?: string; size?: number }>

const INCLUDED_ICON_MAP: [RegExp, LucideIcon][] = [
  [/包車|車資/, Car],
  [/導遊/, UserCheck],
  [/門票/, Ticket],
  [/保險/, ShieldCheck],
  [/住宿/, Home],
  [/餐/, UtensilsCrossed],
  [/座椅/, Baby],
  [/水/, Droplets],
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

/* ─── Sub: Included / Excluded Glass Cards (HTML lines 1040-1107) ─── */

function IncludedExcludedSection({
  included,
  excluded,
}: {
  included: string[]
  excluded: string[]
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Included — green glass */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-[24px] p-7 md:p-8"
        style={{
          background: 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(16px) saturate(1.15)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.15)',
          border: '1.5px solid rgba(74, 107, 58, 0.35)',
          boxShadow:
            '0 20px 50px -15px rgba(74, 107, 58, 0.28), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        {/* Corner glow */}
        <div
          className="pointer-events-none absolute right-0 top-0 h-28 w-28"
          style={{
            background: 'radial-gradient(circle at top right, rgba(74, 107, 58, 0.25), transparent 65%)',
          }}
        />
        <div className="relative mb-5 flex items-center gap-3">
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: '#4A6B3A', color: '#FDFBF4' }}
          >
            <Check size={22} strokeWidth={2.5} />
          </span>
          <div>
            <div className="text-[10px] tracking-[0.2em]" style={{ color: '#4A6B3A' }}>
              INCLUDED
            </div>
            <div
              className="text-[22px] font-black"
              style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
            >
              費用已包含
            </div>
          </div>
        </div>
        <ul className="relative space-y-4">
          {included.map((item, i) => {
            const Icon = pickIcon(item, INCLUDED_ICON_MAP, Check)
            return (
              <motion.li
                key={item}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 * i, duration: 0.4 }}
                className="flex gap-3"
              >
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(74, 107, 58, 0.15)', color: '#4A6B3A' }}
                >
                  <Icon size={16} />
                </span>
                <div className="flex-1 pt-0.5">
                  <div
                    className="text-[15px] font-bold"
                    style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
                  >
                    {item}
                  </div>
                </div>
              </motion.li>
            )
          })}
        </ul>
      </motion.div>

      {/* Not included — gray glass */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="relative overflow-hidden rounded-[24px] p-7 md:p-8"
        style={{
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(16px) saturate(1.15)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.15)',
          border: '1.5px solid rgba(122, 111, 92, 0.35)',
          boxShadow:
            '0 20px 50px -15px rgba(15, 11, 5, 0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
        }}
      >
        <div
          className="pointer-events-none absolute right-0 top-0 h-28 w-28"
          style={{
            background: 'radial-gradient(circle at top right, rgba(122, 111, 92, 0.18), transparent 65%)',
          }}
        />
        <div className="relative mb-5 flex items-center gap-3">
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: '#7A6F5C', color: '#FDFBF4' }}
          >
            <Minus size={22} strokeWidth={2.5} />
          </span>
          <div>
            <div className="text-[10px] tracking-[0.2em]" style={{ color: '#7A6F5C' }}>
              NOT INCLUDED
            </div>
            <div
              className="text-[22px] font-black"
              style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
            >
              費用不含
            </div>
          </div>
        </div>
        <ul className="relative space-y-4">
          {excluded.map((item, i) => {
            const Icon = pickIcon(item, EXCLUDED_ICON_MAP, Minus)
            return (
              <motion.li
                key={item}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 * i, duration: 0.4 }}
                className="flex gap-3"
              >
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(122, 111, 92, 0.15)', color: '#7A6F5C' }}
                >
                  <Icon size={16} />
                </span>
                <div className="flex-1 pt-0.5">
                  <div
                    className="text-[15px] font-bold"
                    style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
                  >
                    {item}
                  </div>
                </div>
              </motion.li>
            )
          })}
        </ul>
      </motion.div>
    </div>
  )
}

/* ─── Sub: Line Item Breakdown ─── */

function LineItemBreakdown({
  items,
  tripDays,
  tripNights,
  adults,
  childCount,
}: {
  items: { label: string; amountTHB: number; amountTWD: number; description?: string }[]
  tripDays: number
  tripNights: number
  adults: number
  childCount: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="overflow-hidden rounded-[24px] p-7 md:p-8"
      style={{
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(16px) saturate(1.15)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.15)',
        border: '1.5px solid rgba(202, 138, 4, 0.3)',
        boxShadow: '0 20px 50px -15px rgba(202, 138, 4, 0.18), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Receipt size={18} style={{ color: '#CA8A04' }} />
          <h3
            className="text-[20px] font-black"
            style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
          >
            價格明細
          </h3>
        </div>
        <p className="text-[12px]" style={{ color: '#7A6F5C' }}>
          {tripDays}天{tripNights}夜 · {adults}大{childCount}小
        </p>
      </div>
      <div className="space-y-0">
        {items.map((item, i) => (
          <div key={item.label}>
            {i > 0 && (
              <div
                className="my-3 border-t border-dashed"
                style={{ borderColor: '#EAE4D2' }}
              />
            )}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p
                  className="text-[14px] font-semibold"
                  style={{ color: '#0F0B05' }}
                >
                  {item.label}
                </p>
                {item.description && (
                  <p className="mt-0.5 text-[12px]" style={{ color: '#7A6F5C' }}>
                    {item.description}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[14px] font-semibold" style={{ color: '#0F0B05' }}>
                  NT$ {fmt(item.amountTWD)}
                </p>
                <p className="text-[12px]" style={{ color: '#7A6F5C' }}>
                  {fmt(item.amountTHB)} THB
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/* ─── Sub: Total Quote Card — Dark (HTML lines 1110-1141) ─── */

function TotalQuoteCard({
  name,
  totalTHB,
  totalTWD,
  isSample,
  tripDays,
  tripNights,
  exchangeRate,
}: {
  name: string
  totalTHB: number
  totalTWD: number
  isSample: boolean
  tripDays: number
  tripNights: number
  exchangeRate: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: 0.25 }}
      className="relative mt-10 overflow-hidden rounded-[28px] p-8 text-center md:p-12"
      style={{
        background: 'linear-gradient(135deg, #0F0B05 0%, #1F1A10 100%)',
        color: '#FDFBF4',
        boxShadow: '0 30px 60px -20px rgba(15,11,5,0.5)',
      }}
    >
      {/* Animated dashed SVG */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1000 400"
        preserveAspectRatio="none"
      >
        <path
          d="M -20 320 Q 250 140 500 260 T 1020 180"
          stroke="#FACC15"
          strokeWidth="2"
          strokeDasharray="6 10"
          strokeLinecap="round"
          fill="none"
          opacity="0.25"
          className="animate-path-dash"
        />
      </svg>

      <div className="relative">
        <div className="mb-4 text-[11px] tracking-[0.3em]" style={{ color: '#FACC15' }}>
          {isSample ? 'REFERENCE QUOTE' : `${name.toUpperCase()} · EXCLUSIVE QUOTE`}
        </div>
        <div
          className="font-black leading-[1.05]"
          style={{
            fontSize: 'clamp(26px, 3.5vw, 40px)',
            color: '#EAE4D2',
            textWrap: 'balance',
            fontFamily: 'var(--font-display, serif)',
          }}
        >
          {isSample ? '參考報價' : `${name} 專屬行程總報價`}
        </div>

        {/* Big price */}
        <div className="mt-6 flex flex-wrap items-end justify-center gap-3">
          <span
            className="font-black leading-[0.9]"
            style={{
              fontSize: 'clamp(56px, 10vw, 110px)',
              color: '#FACC15',
              letterSpacing: '-0.02em',
            }}
          >
            {fmt(totalTHB)}
          </span>
          <span
            className="pb-3 font-black"
            style={{ fontSize: 'clamp(22px, 3vw, 32px)', color: '#FACC15' }}
          >
            THB
          </span>
        </div>

        {/* Exchange rate badge */}
        <div
          className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] tracking-[0.12em]"
          style={{
            background: 'rgba(253,251,244,0.08)',
            border: '1px solid rgba(253,251,244,0.18)',
          }}
        >
          <Calculator size={13} /> ≈ NT$ {fmt(totalTWD)} · 匯率 {exchangeRate.toFixed(3)}
        </div>

        {isSample && (
          <div className="mt-4 text-[12px]" style={{ color: 'rgba(253,251,244,0.5)' }}>
            以一家四口 · {tripDays}天{tripNights}夜為例，實際費用依人數與行程客製
          </div>
        )}

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold"
            style={{ background: '#06C755', color: '#fff' }}
          >
            <MessageCircle size={15} /> {isSample ? 'LINE 聊聊行程' : '我要確認這份報價'}
          </a>
          <a
            href="#itinerary"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold"
            style={{
              background: 'rgba(250,204,21,0.18)',
              border: '1.5px solid #FACC15',
              color: '#FACC15',
            }}
          >
            <ArrowUp size={15} /> 重新瀏覽行程
          </a>
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Sub: Payment Notes ─── */

function PaymentNotesSection({
  paymentNotes,
  carCount,
}: {
  paymentNotes: string[]
  carCount: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="overflow-hidden rounded-[24px] p-7 md:p-8"
      style={{
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(16px) saturate(1.15)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.15)',
        border: '1.5px solid rgba(202, 138, 4, 0.25)',
        boxShadow: '0 20px 50px -15px rgba(110, 77, 49, 0.12)',
      }}
    >
      <h3
        className="mb-4 text-[18px] font-black"
        style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
      >
        付款說明
      </h3>
      <ul className="space-y-2">
        {paymentNotes.map((note, i) => (
          <li key={i} className="flex gap-2 text-[14px]" style={{ color: '#3A3224' }}>
            <span className="mt-0.5 shrink-0" style={{ color: '#CA8A04' }}>
              &#x2022;
            </span>
            {note}
          </li>
        ))}
      </ul>
      <div
        className="mt-5 border-t border-dashed pt-4"
        style={{ borderColor: '#EAE4D2' }}
      >
        <h4 className="mb-1 text-[14px] font-semibold" style={{ color: '#0F0B05' }}>
          超時費用
        </h4>
        <p className="text-[14px]" style={{ color: '#3A3224' }}>
          每日包車服務最多 10 小時，超時 300 泰銖/小時
          {carCount > 1 ? ` × ${carCount} 台車` : ''}
        </p>
      </div>
    </motion.div>
  )
}

/* ─── Sub: Bank Transfer ─── */

function BankTransferSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="overflow-hidden rounded-[24px] p-7 md:p-8"
      style={{
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(16px) saturate(1.15)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.15)',
        border: '1.5px solid rgba(202, 138, 4, 0.25)',
        boxShadow: '0 20px 50px -15px rgba(110, 77, 49, 0.08)',
      }}
    >
      <h3
        className="mb-4 text-[18px] font-black"
        style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
      >
        匯款帳號
      </h3>
      <div className="space-y-2 text-[14px]" style={{ color: '#0F0B05' }}>
        <div className="flex justify-between">
          <span style={{ color: '#7A6F5C' }}>戶名</span>
          <span className="font-medium">蔡柏裕</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: '#7A6F5C' }}>銀行名稱</span>
          <span className="font-medium">彰化銀行</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: '#7A6F5C' }}>銀行代碼</span>
          <span className="font-medium">009</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: '#7A6F5C' }}>帳號</span>
          <span className="font-medium tracking-wider">51619501772100</span>
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Sub: Hotel Deposit ─── */

function HotelDepositSection({
  hotels,
  totalDeposit,
}: {
  hotels: { name: string; deposit: number; rooms: number }[]
  totalDeposit: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="overflow-hidden rounded-[24px] p-7 md:p-8"
      style={{
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(16px) saturate(1.15)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.15)',
        border: '1.5px solid rgba(202, 138, 4, 0.25)',
        boxShadow: '0 20px 50px -15px rgba(110, 77, 49, 0.08)',
      }}
    >
      <h3
        className="mb-4 text-[18px] font-black"
        style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
      >
        住宿押金
      </h3>
      <div className="space-y-3">
        {hotels.map((hotel) => (
          <div key={hotel.name} className="flex items-start justify-between gap-4 text-[14px]">
            <div>
              <p className="font-medium" style={{ color: '#0F0B05' }}>
                {hotel.name}
              </p>
              <p className="text-[12px]" style={{ color: '#7A6F5C' }}>
                {hotel.rooms} 間房
              </p>
            </div>
            <p className="shrink-0 font-semibold" style={{ color: '#0F0B05' }}>
              {fmt(hotel.deposit)} THB
            </p>
          </div>
        ))}
      </div>
      <div
        className="mt-4 flex justify-between border-t border-dashed pt-3 text-[14px]"
        style={{ borderColor: '#EAE4D2' }}
      >
        <span className="font-semibold" style={{ color: '#0F0B05' }}>
          押金合計
        </span>
        <span className="font-bold" style={{ color: '#CA8A04' }}>
          {fmt(totalDeposit)} THB
        </span>
      </div>
    </motion.div>
  )
}

/* ─── Sub: Null Quote Fallback ─── */

function NullQuoteFallback() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-[24px] p-8 text-center"
      style={{
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(16px) saturate(1.15)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.15)',
        border: '1.5px solid rgba(202, 138, 4, 0.25)',
      }}
    >
      <p className="mb-4 text-[15px]" style={{ color: '#3A3224' }}>
        報價資料準備中，請聯繫我們取得完整報價。
      </p>
      <a
        href={LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-bold text-white shadow-lg transition-transform hover:scale-105"
        style={{ background: '#06C755' }}
      >
        <MessageCircle size={16} />
        LINE 聊聊行程
      </a>
    </motion.div>
  )
}

/* ===================================================================
   Main Component
   =================================================================== */

interface QuoteCostDashboardProps {
  quote: QuoteData
}

export function QuoteCostDashboard({ quote }: QuoteCostDashboardProps) {
  const { isSample } = quote
  const breakdown = quote.quote

  return (
    <section className="relative overflow-hidden px-6 py-20 md:px-10 md:py-28">
      {/* Background gradient (HTML line 1025-1027) */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: 'linear-gradient(160deg, #F9F5EA 0%, #FEF3C7 55%, #FDE68A 100%)',
        }}
      />

      {/* Decorative glow blobs (HTML lines 1029-1030) */}
      <div
        className="pointer-events-none absolute -left-20 -top-20 -z-10 h-[420px] w-[420px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #FACC1555 0%, transparent 65%)',
          filter: 'blur(30px)',
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 -z-10 h-[380px] w-[380px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #4A6B3A33 0%, transparent 65%)',
          filter: 'blur(35px)',
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-14 text-center">
          <div className="inline-block text-[11px] tracking-[0.22em]" style={{ color: '#CA8A04' }}>
            PROFESSIONAL SERVICES · QUOTE
          </div>
          <h2
            className="mt-3 font-black"
            style={{
              fontSize: 'clamp(30px, 4.5vw, 52px)',
              color: '#0F0B05',
              textWrap: 'balance',
              fontFamily: 'var(--font-display, serif)',
            }}
          >
            費用清單與專屬報價
          </h2>
          <p
            className="mx-auto mt-4 max-w-2xl text-[15px] leading-[1.8] md:text-[17px]"
            style={{ color: '#3A3224' }}
          >
            我們把所有費用攤開給你看，沒有隱藏項目 —— 每一筆都為了這趟旅行更舒服。
          </p>
        </div>

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
              childCount={quote.children}
            />

            {/* 3. Total Quote Card */}
            <TotalQuoteCard
              name={quote.name}
              totalTHB={breakdown.totalTHB}
              totalTWD={breakdown.totalTWD}
              isSample={isSample}
              tripDays={quote.tripDays}
              tripNights={quote.tripNights}
              exchangeRate={quote.exchangeRate}
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
