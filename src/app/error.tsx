'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">發生錯誤</h1>
        <p className="text-gray-600 mb-8">
          抱歉，頁面載入時發生問題。請重新整理或返回首頁。
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-primary hover:bg-primary-dark text-black px-6 py-3 rounded-full font-medium transition-colors"
          >
            重新整理
          </button>
          <a
            href="/"
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-full font-medium transition-colors"
          >
            返回首頁
          </a>
        </div>
      </div>
    </div>
  )
}
