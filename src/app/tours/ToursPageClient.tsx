// src/app/tours/ToursPageClient.tsx
'use client'

import { useState, useEffect } from 'react'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'
import PackageCard from '@/components/tours/PackageCard'
import CaseCard from '@/components/tours/CaseCard'
import YearFilter from '@/components/tours/YearFilter'

interface Package {
  title: string
  slug: string
  subtitle?: string
  coverImage?: any
  duration?: string
  highlights?: string[]
}

interface Case {
  id: string
  name: string
  month: string
  days: number
  status: 'completed' | 'upcoming'
}

interface ToursPageClientProps {
  packages: Package[]
}

const CASES_PER_PAGE = 20

export default function ToursPageClient({ packages }: ToursPageClientProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear, currentYear - 1])
  const [cases, setCases] = useState<Case[]>([])
  const [totalCases, setTotalCases] = useState(0)
  const [allTimeTotalCases, setAllTimeTotalCases] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Fetch cases when year changes
  useEffect(() => {
    setLoading(true)
    setCases([])

    fetch(`/api/tours/cases?year=${selectedYear}&limit=${CASES_PER_PAGE}`)
      .then((res) => res.json())
      .then((data) => {
        setCases(data.cases || [])
        setTotalCases(data.total || 0)
        if (data.availableYears) {
          setAvailableYears(data.availableYears)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedYear])

  // Fetch all-time total on mount
  useEffect(() => {
    Promise.all([
      fetch(`/api/tours/cases?year=${currentYear}&limit=1`).then(r => r.json()),
      fetch(`/api/tours/cases?year=${currentYear - 1}&limit=1`).then(r => r.json()),
    ]).then(([current, last]) => {
      setAllTimeTotalCases((current.total || 0) + (last.total || 0))
    }).catch(console.error)
  }, [currentYear])

  // Load more cases
  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const res = await fetch(
        `/api/tours/cases?year=${selectedYear}&limit=${CASES_PER_PAGE}&offset=${cases.length}`
      )
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
    <div className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {allTimeTotalCases > 0 ? `${allTimeTotalCases} 組家庭的清邁回憶` : '每一組家庭的清邁回憶'}
          </h1>
          <p className="text-xl text-gray-600">
            每趟旅程都是獨一無二的故事
          </p>
        </div>

        {/* Signature Packages Section */}
        {packages.length > 0 && (
          <section className="mb-20">
            <SectionTitle
              title="招牌推薦"
              subtitle="精選套餐，為你的清邁之旅開啟最棒的開始"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {packages.map((pkg) => (
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

        {/* Past Cases Section */}
        <section className="mb-16">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <SectionTitle
              title="過去案例"
              subtitle="真實服務紀錄，見證每一趟精彩旅程"
            />
            <YearFilter
              years={availableYears}
              selectedYear={selectedYear}
              onChange={setSelectedYear}
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">載入中...</div>
          ) : cases.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {selectedYear} 年尚無案例
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {cases.map((c) => (
                  <CaseCard
                    key={c.id}
                    name={c.name}
                    days={c.days}
                    month={c.month}
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
            想打造專屬於你們家的行程嗎？
          </h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            每個家庭的需求都不同，告訴我們你的想法，我們幫你量身打造
          </p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external>
            LINE 免費諮詢
          </Button>
        </section>
      </div>
    </div>
  )
}
