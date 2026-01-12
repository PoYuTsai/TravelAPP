import Button from '@/components/ui/Button'

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-br from-primary-light to-white py-20 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            清邁親子自由行
            <span className="block text-primary mt-2">專屬包車服務</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
            住在清邁的台泰夫妻，為您打造安全、舒適、難忘的家庭旅行體驗
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
              LINE 免費諮詢
            </Button>
            <Button href="/tours" variant="outline" size="lg">
              瀏覽行程
            </Button>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent" />
    </section>
  )
}
