import Link from 'next/link'
import Button from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-20 bg-gradient-to-b from-white to-primary-light/20">
      <div className="text-center px-4 max-w-lg mx-auto">
        {/* 404 Icon - Map with question mark */}
        <div className="mb-8 relative inline-block">
          <svg
            className="w-32 h-32 text-primary/80"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-lg">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Error code */}
        <p className="text-6xl font-bold text-primary/30 mb-4">404</p>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          找不到這個頁面
        </h1>
        <p className="text-gray-600 mb-8">
          看起來你迷路了！沒關係，讓我們帶你回到正確的地方。
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Button href="/">回首頁</Button>
          <Button href="/blog" variant="outline">
            看看部落格
          </Button>
        </div>

        {/* Quick links */}
        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-500 mb-3">或者前往：</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/tours" className="text-primary hover:underline">
              一日遊行程
            </Link>
            <Link href="/services/car-charter" className="text-primary hover:underline">
              包車服務
            </Link>
            <Link href="/homestay" className="text-primary hover:underline">
              芳縣民宿
            </Link>
            <Link href="/contact" className="text-primary hover:underline">
              聯絡我們
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
