// src/components/tours/CaseCard.tsx

interface CaseCardProps {
  name: string
  days: number
  startDate: string  // ISO format: 2026-02-20
  endDate: string | null  // ISO format or null for single day
  status: 'completed' | 'upcoming'
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
  const isCompleted = status === 'completed'
  const dateDisplay = formatDateRange(startDate, endDate)

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="text-lg font-semibold text-gray-900">
        {name}
      </div>
      <div className="text-sm text-gray-500 mt-1">
        {days} 天
      </div>
      <div className="text-sm text-gray-400 mt-1">
        {dateDisplay}
      </div>
      <div className={`text-xs mt-2 inline-flex items-center gap-1 ${
        isCompleted ? 'text-gray-400' : 'text-primary'
      }`}>
        {isCompleted ? (
          <>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            已完成
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            即將出發
          </>
        )}
      </div>
    </div>
  )
}
