// src/app/tours/ToursPageClient.tsx
'use client'

import { useState, useEffect } from 'react'
import type { SiteTrustCard } from '@/lib/site-settings'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'
import { CaseGridSkeleton } from '@/components/ui/LoadingSkeleton'
import TrustNumbers from '@/components/sections/TrustNumbers'
import LineCTAButton from '@/components/ui/LineCTAButton'
import PackageCard from '@/components/tours/PackageCard'
import DayTourCard from '@/components/tours/DayTourCard'
import CaseCard from '@/components/tours/CaseCard'

interface Package {
  title: string
  slug: string
  subtitle?: string
  coverImage?: any
  duration?: string
  highlights?: string[]
}

interface DayTour {
  title: string
  slug: string
  subtitle?: string
  location?: string
  coverImage?: any
  highlights?: string[]
  basePrice?: number
}

interface Case {
  id: string
  name: string
  days: number
  startDate: string
  endDate: string | null
  status: 'completed' | 'traveling' | 'upcoming'
}

interface ToursPageClientProps {
  packages: Package[]
  dayTours?: DayTour[]
  familyCount?: number
  reviewCount?: number
  ratingValue?: number
  trustCards?: SiteTrustCard[]
}

const INITIAL_CASES = 8
const CASES_PER_YEAR = 10  // 每年預設顯示筆數
const LOAD_MORE_COUNT = 10 // 每次載入更多筆數

interface HistoryData {
  grouped: { [year: number]: Case[] }
  years: number[]
}

export default function ToursPageClient({
  packages,
  dayTours = [],
  familyCount,
  reviewCount,
  ratingValue,
  trustCards,
}: ToursPageClientProps) {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)

  // 歷史案例（按年份分組）
  const [historyData, setHistoryData] = useState<HistoryData | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  // 每年顯示數量的狀態
  const [yearLimits, setYearLimits] = useState<{ [year: number]: number }>({})

  // 浮動按鈕顯示狀態
  const [showFloatingButton, setShowFloatingButton] = useState(false)

  // Fetch recent cases (跨年份，狀態優先排序)
  useEffect(() => {
    fetch(`/api/tours/cases?mode=recent&limit=${INITIAL_CASES}`)
      .then((res) => res.json())
      .then((data) => {
        setCases(data.cases || [])
      })
      .catch(() => { /* Silent fail for public data */ })
      .finally(() => setLoading(false))
  }, [])

  // 展開歷史案例時立即顯示浮動按鈕
  useEffect(() => {
    setShowFloatingButton(showHistory)
  }, [showHistory])

  // Load history cases (按年份分組)
  const loadHistory = async () => {
    if (historyData) {
      setShowHistory(!showHistory)
      return
    }

    setLoadingHistory(true)
    try {
      const res = await fetch('/api/tours/cases?mode=history')
      const data = await res.json()
      setHistoryData(data)
      // 初始化每年顯示數量
      const initialLimits: { [year: number]: number } = {}
      data.years.forEach((year: number) => {
        initialLimits[year] = CASES_PER_YEAR
      })
      setYearLimits(initialLimits)
      setShowHistory(true)
    } catch {
      // Silent fail for public data
    } finally {
      setLoadingHistory(false)
    }
  }

  // 載入更多某年的案例
  const loadMoreForYear = (year: number) => {
    setYearLimits((prev) => ({
      ...prev,
      [year]: (prev[year] || CASES_PER_YEAR) + LOAD_MORE_COUNT,
    }))
  }

  // 收回歷史案例並滾動回「最近出發的家庭」區塊
  const collapseHistory = () => {
    // 先隱藏歷史區塊並重置每年顯示數量
    setShowHistory(false)
    setYearLimits({})

    // 等待 DOM 更新後，再滾動到目標位置
    setTimeout(() => {
      const recentSection = document.getElementById('recent-cases')
      if (recentSection) {
        recentSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
  }

  const journeyModes = [
    {
      title: '直接選招牌套餐',
      description: '適合第一次來清邁，想先抓到穩穩的親子節奏。',
    },
    {
      title: '一日遊自由搭配',
      description: '已經有想法，只想補進幾個適合孩子的亮點。',
    },
    {
      title: '先看真實家庭案例',
      description: '從別人的旅程節奏，找到最接近你們家的安排方式。',
    },
  ]

  return (
    <div className="py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[36px] bg-stone-950 px-6 py-8 shadow-[0_34px_100px_-45px_rgba(0,0,0,0.55)] md:px-10 md:py-12 lg:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,192,9,0.28),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_24%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-light/90">
                Chiang Mai Family Travel Cases
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
                清邁親子包車，
                <br />
                先從適合你們家的方式開始
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/78 md:text-xl">
                不一定要先決定完整行程。你可以先看招牌套餐、挑一日遊靈感，或直接參考其他家庭怎麼安排，再一起調成你們家的版本。
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <LineCTAButton
                  location="Tours Hero CTA"
                  className="shadow-[0_20px_45px_-18px_rgba(247,192,9,0.88)]"
                >
                  LINE 聊聊你們家的旅程
                </LineCTAButton>
                <Button
                  href="#recent-cases"
                  variant="outline"
                  size="lg"
                  className="border-white/35 text-white hover:border-white hover:bg-white hover:text-stone-900"
                >
                  先看真實家庭案例
                </Button>
              </div>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                {journeyModes.map((mode) => (
                  <div key={mode.title} className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                    <p className="text-sm font-semibold text-white">{mode.title}</p>
                    <p className="mt-2 text-sm leading-6 text-white/65">{mode.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/15 bg-white/94 p-6 shadow-[0_26px_70px_-35px_rgba(0,0,0,0.45)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                這頁面怎麼看最快
              </p>
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-amber-50 px-4 py-4">
                  <p className="text-sm font-medium text-stone-500">招牌套餐</p>
                  <p className="mt-1 text-2xl font-bold text-stone-900">{Math.min(packages.length, 2)} 條先看</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-stone-100 px-4 py-4">
                    <p className="text-sm font-medium text-stone-500">一日遊靈感</p>
                    <p className="mt-1 text-xl font-bold text-stone-900">{dayTours.length} 條</p>
                  </div>
                  <div className="rounded-2xl bg-stone-100 px-4 py-4">
                    <p className="text-sm font-medium text-stone-500">真實家庭</p>
                    <p className="mt-1 text-xl font-bold text-stone-900">{familyCount || 114}+</p>
                  </div>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-stone-600">
                如果你還沒想清楚行程，也沒關係。先看「最近出發的家庭」，通常最容易知道你們會喜歡哪種節奏。
              </p>
            </div>
          </div>
        </section>

        <div className="-mt-6 mb-16 px-2 md:-mt-8 md:mb-20">
          <TrustNumbers
            compact
            familyCountValue={familyCount}
            reviewCount={reviewCount}
            ratingValue={ratingValue}
            cards={trustCards}
          />
        </div>

        {/* Signature Packages Section */}
        {packages.length > 0 && (
          <section className="mb-20 rounded-[32px] bg-gradient-to-br from-amber-50 via-white to-stone-50 px-6 py-8 md:px-8 md:py-10">
            <SectionTitle
              title="給第一次來清邁的你"
              subtitle="如果你希望有人先把旅程骨架整理好，這兩條招牌套餐最適合先看。"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {packages.slice(0, 2).map((pkg) => (
                <PackageCard
                  key={pkg.slug}
                  title={pkg.title}
                  slug={pkg.slug}
                  subtitle={pkg.subtitle}
                  coverImage={pkg.coverImage}
                  duration={pkg.duration}
                  highlights={pkg.highlights}
                />
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <LineCTAButton location="Tours Package Section CTA" variant="secondary">
                不確定哪條適合？先聊聊
              </LineCTAButton>
            </div>
          </section>
        )}

        {/* Day Tours Section */}
        {dayTours.length > 0 && (
          <section className="mb-20 rounded-[32px] bg-stone-950 px-6 py-8 md:px-8 md:py-10">
            <SectionTitle
              title="想自己排行程？"
              subtitle="把幾個最適合孩子的亮點先挑起來，再來拼出你們家的版本。"
            />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {dayTours.map((tour) => (
                <DayTourCard
                  key={tour.slug}
                  title={tour.title}
                  slug={tour.slug}
                  location={tour.location}
                  coverImage={tour.coverImage}
                  highlights={tour.highlights}
                  priceFrom={tour.basePrice}
                />
              ))}
            </div>
            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/8 p-5 text-center backdrop-blur-sm">
              <p className="text-base font-medium text-white">
                不知道哪些能順路排在一起？
              </p>
              <p className="mt-2 text-sm leading-6 text-white/68">
                把孩子年齡、旅行天數和幾個想去的點丟給我們，我們幫你把順路度和體力節奏排好。
              </p>
            </div>
          </section>
        )}

        {/* Recent Cases Section */}
        <section id="recent-cases" className="mb-16">
          <SectionTitle
            title="最近出發的家庭"
            subtitle="如果你還在想該怎麼排，先看別的家庭最近怎麼玩，最容易找到方向。"
          />

          {loading ? (
            <CaseGridSkeleton count={8} />
          ) : cases.length === 0 ? (
            <div className="text-center py-12 text-gray-500">尚無案例</div>
          ) : (
            <>
              <div className="mb-6 rounded-[26px] border border-stone-200 bg-stone-50 px-5 py-5 text-center">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-stone-400">挑案例的方法</p>
                <p className="mt-2 text-base leading-7 text-stone-600">
                  先找和你們家天數接近、孩子節奏相似的案例，再決定要偏放鬆、偏景點，還是偏移動式探索。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5 sm:grid-cols-3 md:grid-cols-4">
                {cases.map((c) => (
                  <CaseCard
                    key={c.id}
                    name={c.name}
                    days={c.days}
                    startDate={c.startDate}
                    endDate={c.endDate}
                    status={c.status}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* History Cases Section */}
        <section className="mb-16">
          <div className="text-center">
            <button
              onClick={loadHistory}
              disabled={loadingHistory}
              aria-expanded={showHistory}
              aria-controls="history-cases"
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-6 py-3 text-stone-500 font-medium transition-colors hover:border-stone-300 hover:text-stone-700 disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {loadingHistory ? '載入中...' : showHistory ? '隱藏歷史案例' : '查看所有歷史案例'}
            </button>
          </div>

          {showHistory && historyData && historyData.years.length > 0 && (
            <div id="history-cases" className="mt-6 space-y-8">
              {historyData.years.map((year) => {
                const allCases = historyData.grouped[year] || []
                const limit = yearLimits[year] || CASES_PER_YEAR
                const visibleCases = allCases.slice(0, limit)
                const hasMore = allCases.length > limit

                return (
                  <div key={year}>
                    <h3 className="mb-4 border-b border-gray-200 pb-2 text-center text-lg font-semibold text-gray-600">
                      {year} 年案例
                      <span className="text-sm font-normal text-gray-400 ml-2">
                        ({visibleCases.length}/{allCases.length})
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                      {visibleCases.map((c) => (
                        <CaseCard
                          key={c.id}
                          name={c.name}
                          days={c.days}
                          startDate={c.startDate}
                          endDate={c.endDate}
                          status={c.status}
                        />
                      ))}
                    </div>
                    {hasMore && (
                      <div className="text-center mt-4">
                        <button
                          onClick={() => loadMoreForYear(year)}
                          className="rounded-full px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        >
                          載入更多 {year} 年案例
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {/* 底部收回按鈕 */}
              <div className="text-center mt-6">
                <button
                  onClick={collapseHistory}
                  className="inline-flex items-center gap-2 px-6 py-3 text-gray-500 font-medium transition-colors hover:text-gray-700"
                >
                  <svg
                    className="w-4 h-4 rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  收回歷史案例
                </button>
              </div>
            </div>
          )}

          {/* 浮動收回按鈕 - 位置在 LINE 按鈕上方 */}
          {showFloatingButton && (
            <button
              onClick={collapseHistory}
              className="fixed bottom-36 right-4 md:bottom-20 md:right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:bg-primary-dark hover:shadow-[0_6px_25px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 active:scale-95 transition-all duration-200 animate-fade-in"
              aria-label="收回歷史案例"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              收回
            </button>
          )}
        </section>

        {/* CTA Section */}
        <section className="relative overflow-hidden rounded-[32px] bg-stone-950 px-8 py-10 text-center md:px-12 md:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,192,9,0.24),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_24%)]" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              每個家庭都不一樣
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
              先把孩子年齡、旅行天數和你們現在的想法丟給我們，我們再一起把節奏和路線理順。
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <LineCTAButton
                location="Tours Bottom CTA"
                className="shadow-[0_20px_45px_-18px_rgba(247,192,9,0.88)]"
              >
                LINE 聊聊
              </LineCTAButton>
              <Button
                href="#recent-cases"
                variant="outline"
                className="border-white/35 text-white hover:border-white hover:bg-white hover:text-stone-900"
              >
                先看案例再決定
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
