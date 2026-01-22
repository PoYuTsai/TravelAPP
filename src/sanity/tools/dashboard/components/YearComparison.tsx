// src/sanity/tools/dashboard/components/YearComparison.tsx

import React from 'react'
import type { YearComparison as YearComparisonType } from '@/lib/notion/types'

interface YearComparisonProps {
  data: YearComparisonType
  upToMonth: number
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
  }).format(value)
}

export function YearComparison({ data, upToMonth }: YearComparisonProps) {
  const hasLastYearData = data.lastYearProfit > 0 || data.lastYearCount > 0

  return (
    <div className="dashboard-card year-comparison">
      <div className="card-header">
        <span className="card-title">年度比較（1-{upToMonth}月累計）</span>
      </div>
      <div className="comparison-grid">
        <div className="comparison-column">
          <div className="comparison-year">{data.currentYear} 年</div>
          <div className="comparison-value">{formatCurrency(data.currentYearProfit)}</div>
          <div className="comparison-count">{data.currentYearCount} 筆訂單</div>
        </div>
        <div className="comparison-vs">vs</div>
        <div className="comparison-column">
          <div className="comparison-year">{data.lastYear} 年</div>
          <div className="comparison-value secondary">
            {hasLastYearData ? formatCurrency(data.lastYearProfit) : '-'}
          </div>
          <div className="comparison-count">
            {hasLastYearData ? `${data.lastYearCount} 筆訂單` : '無資料'}
          </div>
        </div>
      </div>
      {data.growthPercent !== null && (
        <div className={`growth-badge ${data.growthPercent >= 0 ? 'positive' : 'negative'}`}>
          {data.growthPercent >= 0 ? '↑' : '↓'} {Math.abs(data.growthPercent)}%
          {data.growthPercent >= 0 ? '成長' : '減少'}
        </div>
      )}
    </div>
  )
}
