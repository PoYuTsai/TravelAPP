// src/components/tours/YearFilter.tsx
'use client'

interface YearFilterProps {
  years: number[]
  selectedYear: number
  onChange: (year: number) => void
}

export default function YearFilter({ years, selectedYear, onChange }: YearFilterProps) {
  return (
    <div className="flex gap-2">
      {years.map((year) => (
        <button
          key={year}
          onClick={() => onChange(year)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedYear === year
              ? 'bg-primary text-black'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {year}
        </button>
      ))}
    </div>
  )
}
