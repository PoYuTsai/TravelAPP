// src/sanity/tools/dashboard/DashboardTool.tsx

import React, { useEffect, useState, useCallback } from 'react'
import { useCurrentUser } from 'sanity'
import type { DashboardData } from '@/lib/notion/types'
import { StatCard } from './components/StatCard'
import { PendingTable } from './components/PendingTable'
import { YearMonthSelector } from './components/YearMonthSelector'
import { YearComparison } from './components/YearComparison'
import { YearlyTrendChart } from './components/YearlyTrendChart'
import './styles.css'

// Email 白名單
const ALLOWED_EMAILS: string[] = [
  // 'eric@example.com',
  // 'min@example.com',
]

export function DashboardTool() {
  const currentUser = useCurrentUser()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 選擇的年月
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

  const userEmail = currentUser?.email || ''

  // 白名單檢查
  const hasAccess = ALLOWED_EMAILS.length === 0 || ALLOWED_EMAILS.includes(userEmail)

  const fetchData = useCallback(async (year: number, month: number) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/dashboard?year=${year}&month=${month}`, {
        headers: {
          'x-user-email': userEmail,
        },
      })
      if (!response.ok) {
        throw new Error('無法取得資料')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生錯誤')
    } finally {
      setLoading(false)
    }
  }, [userEmail])

  useEffect(() => {
    if (hasAccess) {
      fetchData(selectedYear, selectedMonth)
    }
  }, [hasAccess, selectedYear, selectedMonth, fetchData])

  const handleYearChange = (year: number) => {
    setSelectedYear(year)
  }

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month)
  }

  const handleRefresh = () => {
    fetchData(selectedYear, selectedMonth)
  }

  if (!hasAccess) {
    return (
      <div className="dashboard-container">
        <div className="access-denied">
          <h2>🔒 無權限存取</h2>
          <p>此 Dashboard 僅限授權人員使用。</p>
          <p className="email-info">目前登入：{userEmail || '未知'}</p>
        </div>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="dashboard-container">
        <div className="loading">載入中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error">
          <h2>❌ 錯誤</h2>
          <p>{error}</p>
          <button onClick={handleRefresh} className="refresh-button">重試</button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>📊 財務監控</h1>
        <div className="header-actions">
          <span className="last-updated">
            上次更新: {new Date(data.lastUpdated).toLocaleString('zh-TW')}
          </span>
          <button onClick={handleRefresh} className="refresh-button" disabled={loading}>
            {loading ? '載入中...' : '🔄 刷新'}
          </button>
        </div>
      </div>

      {/* 年月選擇器 */}
      <YearMonthSelector
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        availableYears={data.availableYears}
        onYearChange={handleYearChange}
        onMonthChange={handleMonthChange}
      />

      {data.hasUncertainValues && (
        <div className="notice-banner">
          ⚠️ 部分數值為自動計算，建議核對 Notion 原始資料
        </div>
      )}

      {/* 當月統計卡片 */}
      <div className="stats-grid">
        <StatCard
          title={`${selectedMonth}月利潤`}
          value={data.monthlyProfit}
          subtext={`${data.monthlyOrderCount} 筆訂單`}
        />
        <StatCard
          title="待收款項"
          value={data.pendingPayment}
          subtext={`${data.pendingPaymentCount} 筆未收`}
          warning={data.pendingPaymentCount > 0}
        />
      </div>

      {/* 年度比較 */}
      <YearComparison data={data.yearComparison} upToMonth={selectedMonth} />

      {/* 年度月趨勢圖 */}
      <YearlyTrendChart data={data.yearlyTrend} year={selectedYear} />

      {/* 待收款清單 */}
      <PendingTable orders={data.pendingOrders} />
    </div>
  )
}
