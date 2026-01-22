// src/sanity/tools/dashboard/components/YearlyTrendChart.tsx

import React from 'react'
import type { MonthlyStats } from '@/lib/notion/types'

interface YearlyTrendChartProps {
  data: MonthlyStats[]
  year: number
}

function formatCurrency(value: number): string {
  if (value >= 10000) {
    return `${Math.round(value / 1000)}K`
  }
  return new Intl.NumberFormat('zh-TW').format(value)
}

export function YearlyTrendChart({ data, year }: YearlyTrendChartProps) {
  const maxProfit = Math.max(...data.map((d) => d.profit), 1)
  const totalProfit = data.reduce((sum, d) => sum + d.profit, 0)
  const totalCount = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="dashboard-card trend-chart">
      <div className="card-header">
        <span className="card-title">{year} 年月度趨勢</span>
        <span className="trend-total">
          全年：NT$ {new Intl.NumberFormat('zh-TW').format(totalProfit)} / {totalCount} 筆
        </span>
      </div>
      <div className="chart-container">
        {data.map((item, index) => {
          const month = index + 1
          const heightPercent = maxProfit > 0 ? (item.profit / maxProfit) * 100 : 0

          return (
            <div key={item.month} className="chart-bar-wrapper">
              <div className="chart-bar-container">
                <div
                  className={`chart-bar ${item.profit > 0 ? 'has-value' : ''}`}
                  style={{ height: `${Math.max(heightPercent, 2)}%` }}
                  title={`${month}月: NT$ ${new Intl.NumberFormat('zh-TW').format(item.profit)} (${item.count}筆)`}
                >
                  {item.profit > 0 && (
                    <span className="bar-value">{formatCurrency(item.profit)}</span>
                  )}
                </div>
              </div>
              <span className="chart-label">{month}月</span>
              {item.count > 0 && (
                <span className="chart-count">{item.count}筆</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
