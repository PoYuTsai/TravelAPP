import Button from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-20">
      <div className="text-center px-4">
        <div className="text-8xl mb-6">🗺️</div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          找不到這個頁面
        </h1>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          看起來你迷路了！沒關係，讓我們帶你回到正確的地方。
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button href="/">回首頁</Button>
          <Button href="/blog" variant="outline">
            看看部落格
          </Button>
        </div>
      </div>
    </div>
  )
}
