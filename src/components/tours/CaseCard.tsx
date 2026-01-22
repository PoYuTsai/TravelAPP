// src/components/tours/CaseCard.tsx

interface CaseCardProps {
  name: string
  days: number
  month: string
  status: 'completed' | 'upcoming'
}

export default function CaseCard({ name, days, month, status }: CaseCardProps) {
  const isCompleted = status === 'completed'

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="text-lg font-semibold text-gray-900">
        {name}
      </div>
      <div className="text-sm text-gray-500 mt-1">
        {days} 天
      </div>
      <div className="text-sm text-gray-400 mt-1">
        {month}
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
            <span>🔜</span>
            即將出發
          </>
        )}
      </div>
    </div>
  )
}
