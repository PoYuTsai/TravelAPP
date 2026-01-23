// src/app/tours/ToursPageClient.tsx
'use client'

import { useState, useEffect } from 'react'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'
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
  location?: string
  coverImage?: any
  highlights?: string[]
  priceFrom?: number
}

interface Case {
  id: string
  name: string
  days: number
  startDate: string
  endDate: string | null
  status: 'completed' | 'upcoming'
}

interface ToursPageClientProps {
  packages: Package[]
  dayTours?: DayTour[]
}

const INITIAL_CASES = 8
const LOAD_MORE_COUNT = 10

// Default day tours (placeholder until CMS data is available)
const defaultDayTours: DayTour[] = [
  { title: '大象保護營', slug: 'elephant-day', location: '清邁', highlights: ['餵大象', '黏黏瀑布'], priceFrom: 2800 },
  { title: '夜間動物園', slug: 'night-safari', location: '清邁', highlights: ['近距離餵食', '夜間探險'], priceFrom: 1800 },
  { title: '古城文化遊', slug: 'old-city', location: '清邁', highlights: ['寺廟巡禮', '傳統市場'], priceFrom: 1500 },
  { title: '南邦一日遊', slug: 'lampang', location: '南邦', highlights: ['馬車遊城', '陶瓷村'], priceFrom: 2500 },
  { title: '清萊一日遊', slug: 'chiang-rai', location: '清萊', highlights: ['白廟', '藍廟', '黑屋'], priceFrom: 2200 },
  { title: '茵他儂一日遊', slug: 'doi-inthanon', location: '茵他儂', highlights: ['泰國最高峰', '雙塔'], priceFrom: 2000 },
]

export default function ToursPageClient({ packages, dayTours = defaultDayTours }: ToursPageClientProps) {
  const [cases, setCases] = useState<Case[]>([])
  const [totalCases, setTotalCases] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Fetch initial cases (no year filter - use Notion ordering)
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
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingMore(false)
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
          <TrustNumbers compact />
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
                priceFrom={tour.priceFrom}
              />
            ))}
          </div>
        </section>

        {/* Past Cases Section */}
        <section className="mb-16">
          <SectionTitle
            title="最近出發的家庭"
            subtitle="每一組家庭的專屬清邁回憶"
          />

          {loading ? (
            <div className="text-center py-12 text-gray-500">載入中...</div>
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

              {/* Load More */}
              {hasMore && (
                <div className="text-center mt-8">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 font-medium transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? '載入中...' : '載入更多'}
                  </button>
                </div>
              )}
            </>
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
