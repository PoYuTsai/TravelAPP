import Image from 'next/image'
import Button from '@/components/ui/Button'

export default function Hero() {
  return (
    <section className="relative">
      {/* Hero Image */}
      <div className="relative w-full aspect-[21/9]">
        <Image
          src="/images/hero-bg.png"
          alt="清微旅行 - 清邁親子包車自由行"
          fill
          className="object-cover object-top"
          priority
        />
      </div>

      {/* CTA Section */}
      <div className="bg-white py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            清邁親子自由行，找清微旅行就對了！
          </h1>
          <p className="text-lg text-gray-600 mb-6">
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
    </section>
  )
}
