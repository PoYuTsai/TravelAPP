// src/sanity/tools/dashboard/components/StatCard.tsx

import React from 'react'

interface StatCardProps {
  title: string
  value: number
  subtext: string
  warning?: boolean
  sparklineData?: number[]
}

export function StatCard({ title, value, subtext, warning, sparklineData }: StatCardProps) {
  const formattedValue = new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
  }).format(value)

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        {warning && <span className="warning-badge">⚠️</span>}
      </div>
      <div className="card-value">{formattedValue}</div>
      <div className="card-footer">
        <span className="card-subtext">{subtext}</span>
        {sparklineData && sparklineData.length > 0 && (
          <Sparkline data={sparklineData} />
        )}
      </div>
    </div>
  )
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const width = 60
  const height = 20
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((val - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const trend = data[data.length - 1] > data[0] ? '↗' : '↘'

  return (
    <div className="sparkline-container">
      <svg width={width} height={height} className="sparkline">
        <polyline
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2"
          points={points}
        />
      </svg>
      <span className="trend-indicator">{trend}</span>
    </div>
  )
}
