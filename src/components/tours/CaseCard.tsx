// src/components/tours/CaseCard.tsx

interface CaseCardProps {
  name: string
  days: number
  startDate: string  // ISO format: 2026-02-20
  endDate: string | null  // ISO format or null for single day
  status: 'completed' | 'traveling' | 'upcoming'
}

/**
 * Format date range for display
 * - Multi-day: "2026/2/20~2/26"
 * - Single day: "2026/2/20"
 */
function formatDateRange(startDate: string, endDate: string | null): string {
  const start = new Date(startDate)
  const startYear = start.getFullYear()
  const startMonth = start.getMonth() + 1
  const startDay = start.getDate()

  if (!endDate) {
    return `${startYear}/${startMonth}/${startDay}`
  }

  const end = new Date(endDate)
  const endMonth = end.getMonth() + 1
  const endDay = end.getDate()

  // Same day check
  if (startDate === endDate) {
    return `${startYear}/${startMonth}/${startDay}`
  }

  // Multi-day: show full start date and abbreviated end date
  return `${startYear}/${startMonth}/${startDay}~${endMonth}/${endDay}`
}

export default function CaseCard({ name, days, startDate, endDate, status }: CaseCardProps) {
  const dateDisplay = formatDateRange(startDate, endDate)

  // Status styling
  const statusConfig = {
    completed: {
      color: 'text-gray-400',
      label: '已完成',
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ),
    },
    traveling: {
      color: 'text-green-600',
      label: '旅遊中',
      icon: (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      ),
    },
    upcoming: {
      color: 'text-primary',
      label: '即將出發',
      icon: (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
      ),
    },
  }

  const { color, label, icon } = statusConfig[status]

  return (
    <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-[0_18px_45px_-35px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-35px_rgba(0,0,0,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-stone-900">
            {name}
          </div>
          <div className="mt-1 text-sm text-stone-500">
            {dateDisplay}
          </div>
        </div>
        <div className={`inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium ${color}`}>
          {icon}
          {label}
        </div>
      </div>

      <div className="mt-4 border-t border-stone-100 pt-4">
        <div className="text-xs uppercase tracking-[0.18em] text-stone-400">
          行程長度
        </div>
        <div className="mt-1 text-base font-semibold text-stone-700">
          {days} 天
        </div>
      </div>
    </div>
  )
}
