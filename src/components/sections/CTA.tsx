import Button from '@/components/ui/Button'

export default function CTA() {
  return (
    <section className="py-20 bg-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          準備好您的清邁親子之旅了嗎？
        </h2>
        <p className="text-xl text-gray-800 mb-8">
          免費諮詢，讓我們為您規劃完美行程
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button href="https://line.me/R/ti/p/@037nyuwk" external variant="secondary" size="lg">
            LINE 立即諮詢
          </Button>
          <Button href="https://chiangway-travel.rezio.shop" external variant="outline" size="lg">
            查看熱門行程
          </Button>
        </div>
      </div>
    </section>
  )
}
