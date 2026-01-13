import Image from 'next/image'
import Button from '@/components/ui/Button'

// Simple blur placeholder (light golden gradient matching brand)
const blurDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQRBQYSIRMxQWH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABYRAQEBAAAAAAAAAAAAAAAAAAABEf/aAAwDAQACEQMRAD8AotuXM19qN5cXEhmWOdkjQnpFXrgA/PtZpSlIr//Z'

export default function Hero() {
  return (
    <section className="relative">
      {/* Hero Image */}
      <div className="relative w-full aspect-[21/9] bg-primary-light">
        <Image
          src="/images/hero-bg.png"
          alt="清微旅行 - 清邁親子包車自由行"
          fill
          className="object-cover object-top"
          priority
          placeholder="blur"
          blurDataURL={blurDataURL}
        />
      </div>

      {/* CTA Section */}
      <div className="bg-white py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
            清邁親子自由行
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-2">
            在地家庭經營，專為爸媽設計的旅程
          </p>
          <p className="text-base text-gray-500 mb-6">
            Eric & Min，住在清邁的台泰夫妻，我們也有女兒，懂爸媽帶小孩出遊的需求
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
              LINE 免費諮詢
            </Button>
            <Button href="/services/car-charter" variant="outline" size="lg">
              瀏覽服務
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
