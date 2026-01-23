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
const LOAD_MORE_COUNT = 10

export default function ToursPageClient({ packages, dayTours = [], familyCount }: ToursPageClientProps) {
  const [cases, setCases] = useState<Case[]>([])
  const [totalCases, setTotalCases] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // 2025 past cases
  const [pastCases, setPastCases] = useState<Case[]>([])
  const [showPastCases, setShowPastCases] = useState(false)
  const [loadingPast, setLoadingPast] = useState(false)

  // Fetch initial cases for current year
  useEffect(() => {
    fetch(`/api/tours/cases?limit=${INITIAL_CASES}`)
      .then((res) => res.json())
      .then((data) => {
        setCases(data.cases || [])
        setTotalCases(data.total || 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Load more cases
  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/tours/cases?limit=${LOAD_MORE_COUNT}&offset=${cases.length}`)
      const data = await res.json()
      setCases((prev) => [...prev, ...(data.cases || [])])
      setIsExpanded(true)
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingMore(false)
    }
  }

  // Collapse back to initial count
  const collapse = () => {
    setCases((prev) => prev.slice(0, INITIAL_CASES))
    setIsExpanded(false)
  }

  // Load 2025 past cases
  const loadPastCases = async () => {
    if (pastCases.length > 0) {
      setShowPastCases(!showPastCases)
      return
    }

    setLoadingPast(true)
    try {
      const res = await fetch('/api/tours/cases?year=2025&limit=100')
      const data = await res.json()
      setPastCases(data.cases || [])
      setShowPastCases(true)
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingPast(false)
    }
  }

  const hasMore = cases.length < totalCases

  return (
    <div className="py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section with TrustNumbers */}
        <section className="text-center mb-16">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
            清邁親子自由行，交給在地家庭
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

        {/* Past Cases Section */}
        <section className="mb-16">
          <SectionTitle
            title="最近出發的家庭"
            subtitle="每一組家庭的專屬清邁回憶"
          />

          {loading ? (
            <CaseGridSkeleton count={8} />
          ) : cases.length === 0 ? (
            <div className="text-center py-12 text-gray-500">尚無案例</div>
          ) : (
            <>
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

              {/* Load More / Collapse */}
              <div className="text-center mt-8 flex justify-center gap-3">
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 font-medium transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? '載入中...' : '載入更多'}
                  </button>
                )}
                {isExpanded && (
                  <button
                    onClick={collapse}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 font-medium transition-colors"
                  >
                    收回
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {/* 2025 Past Cases Section */}
        <section className="mb-16">
          <div className="text-center">
            <button
              onClick={loadPastCases}
              disabled={loadingPast}
              className="inline-flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showPastCases ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {loadingPast ? '載入中...' : showPastCases ? '隱藏 2025 年案例' : '查看 2025 年過往案例'}
            </button>
          </div>

          {showPastCases && pastCases.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-600 mb-4 text-center">2025 年案例</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                {pastCases.map((c) => (
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
              {/* 收回按鈕 */}
              <div className="text-center mt-6">
                <button
                  onClick={() => setShowPastCases(false)}
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
                  收回 2025 年案例
                </button>
              </div>
            </div>
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
