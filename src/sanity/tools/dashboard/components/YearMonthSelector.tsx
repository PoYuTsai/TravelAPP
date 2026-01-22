// src/sanity/tools/dashboard/components/YearMonthSelector.tsx

import React from 'react'

interface YearMonthSelectorProps {
  selectedYear: number
  selectedMonth: number
  availableYears: number[]
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
}

const MONTHS = [
  { value: 1, label: '1月' },
  { value: 2, label: '2月' },
  { value: 3, label: '3月' },
  { value: 4, label: '4月' },
  { value: 5, label: '5月' },
  { value: 6, label: '6月' },
  { value: 7, label: '7月' },
  { value: 8, label: '8月' },
  { value: 9, label: '9月' },
  { value: 10, label: '10月' },
  { value: 11, label: '11月' },
  { value: 12, label: '12月' },
]

export function YearMonthSelector({
  selectedYear,
  selectedMonth,
  availableYears,
  onYearChange,
  onMonthChange,
}: YearMonthSelectorProps) {
  return (
    <div className="selector-container">
      <select
        className="year-select"
        value={selectedYear}
        onChange={(e) => onYearChange(parseInt(e.target.value, 10))}
      >
        {availableYears.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
      <select
        className="month-select"
        value={selectedMonth}
        onChange={(e) => onMonthChange(parseInt(e.target.value, 10))}
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  )
}
