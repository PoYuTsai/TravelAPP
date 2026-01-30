// src/app/tours/ToursPageClient.tsx
'use client'

import { useState, useEffect } from 'react'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'
import { CaseGridSkeleton } from '@/components/ui/LoadingSkeleton'
import TrustNumbers from '@/components/sections/TrustNumbers'
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
}

const INITIAL_CASES = 8
const CASES_PER_YEAR = 10  // 每年預設顯示筆數
const LOAD_MORE_COUNT = 10 // 每次載入更多筆數

interface HistoryData {
  grouped: { [year: number]: Case[] }
  years: number[]
}

export default function ToursPageClient({ packages, dayTours = [], familyCount }: ToursPageClientProps) {
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
    setShowHistory(false)
    // 滾動到最近案例區塊
    const recentSection = document.getElementById('recent-cases')
    if (recentSection) {
      recentSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section with TrustNumbers */}
        <section className="text-center mb-16">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
            清邁親子包車，交給 Eric & Min
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8">
            專為爸媽設計的包車旅程
          </p>
          <TrustNumbers compact familyCountValue={familyCount} />
        </section>

        {/* Signature Packages Section */}
        {packages.length > 0 && (
          <section className="mb-20">
            <SectionTitle
              title="給第一次來清邁的你"
              subtitle="我們設計好了，你只要帶孩子來"
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
          </section>
        )}

        {/* Day Tours Section */}
        {dayTours.length > 0 && (
          <section className="mb-20">
            <SectionTitle
              title="想自己排行程？"
              subtitle="這些一日遊隨你搭"
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
          </section>
        )}

        {/* Recent Cases Section */}
        <section id="recent-cases" className="mb-16">
          <SectionTitle
            title="最近出發的家庭"
            subtitle="每一組家庭的專屬清邁回憶"
          />

          {loading ? (
            <CaseGridSkeleton count={8} />
          ) : cases.length === 0 ? (
            <div className="text-center py-12 text-gray-500">尚無案例</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
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
              className="inline-flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors disabled:opacity-50"
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
                    <h3 className="text-lg font-semibold text-gray-600 mb-4 text-center border-b border-gray-200 pb-2">
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
                          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
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
                  className="inline-flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors"
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
        <section className="text-center bg-gradient-to-r from-primary-light to-primary/20 rounded-2xl p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            每個家庭都不一樣
          </h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            聊聊你們的想法，我們幫你規劃
          </p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external>
            LINE 聊聊
          </Button>
        </section>
      </div>
    </div>
  )
}
