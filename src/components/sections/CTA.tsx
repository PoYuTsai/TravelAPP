import Button from '@/components/ui/Button'

export default function CTA() {
  return (
    <section className="py-16 md:py-20 bg-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
          準備好帶孩子來清邁了嗎？
        </h2>
        <p className="text-lg md:text-xl text-gray-800 mb-8">
          免費諮詢，讓在地爸媽幫你規劃最適合的親子行程
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button href="https://line.me/R/ti/p/@037nyuwk" external variant="secondary" size="lg">
            LINE 免費諮詢
          </Button>
          <Button href="/services/car-charter" variant="outline" size="lg">
            瀏覽服務內容
          </Button>
        </div>
      </div>
    </section>
  )
}
