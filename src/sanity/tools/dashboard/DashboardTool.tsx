// src/sanity/tools/dashboard/DashboardTool.tsx

import React, { useEffect, useState } from 'react'
import { useCurrentUser } from 'sanity'
import type { DashboardData } from '@/lib/notion/types'
import { StatCard } from './components/StatCard'
import { PendingTable } from './components/PendingTable'
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

  const userEmail = currentUser?.email || ''

  // 白名單檢查
  const hasAccess = ALLOWED_EMAILS.length === 0 || ALLOWED_EMAILS.includes(userEmail)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard', {
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
  }

  useEffect(() => {
    if (hasAccess) {
      fetchData()
    }
  }, [hasAccess])

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

  if (loading) {
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
          <button onClick={fetchData} className="refresh-button">重試</button>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const sparklineData = data.monthlyTrend.map(m => m.profit)

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>📊 財務監控</h1>
        <div className="header-actions">
          <span className="last-updated">
            上次更新: {new Date(data.lastUpdated).toLocaleString('zh-TW')}
          </span>
          <button onClick={fetchData} className="refresh-button" disabled={loading}>
            🔄 刷新
          </button>
        </div>
      </div>

      {data.hasUncertainValues && (
        <div className="notice-banner">
          ⚠️ 部分數值為自動計算，建議核對 Notion 原始資料
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          title="本月利潤"
          value={data.monthlyProfit}
          subtext={`${data.monthlyOrderCount} 筆訂單`}
          sparklineData={sparklineData}
        />
        <StatCard
          title="待收款項"
          value={data.pendingPayment}
          subtext={`${data.pendingPaymentCount} 筆未收`}
          warning={data.pendingPaymentCount > 0}
        />
      </div>

      <PendingTable orders={data.pendingOrders} />
    </div>
  )
}
