import type { Metadata } from 'next'
import Image from 'next/image'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'

export const metadata: Metadata = {
  title: '關於我們',
  description: '清微旅行是住在清邁的台泰夫妻 Eric 和 Min 創立，提供專業的清邁親子包車服務。',
}

export default function AboutPage() {
  return (
    <div className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="關於清微旅行"
          subtitle="您在清邁的家人"
        />

        {/* Family Photo */}
        <div className="mb-12 rounded-2xl overflow-hidden shadow-xl">
          <Image
            src="/images/family.jpg"
            alt="Eric、Min 與孩子們的全家福 - 清微旅行"
            width={1200}
            height={800}
            className="w-full h-auto"
            priority
          />
        </div>

        <div className="prose prose-lg max-w-none">
          <div className="bg-primary-light rounded-2xl p-8 mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">我們的故事</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              嗨！我們是 Eric 和 Min，一對住在清邁的台泰夫妻。Eric 來自台灣，Min 是土生土長的清邁人。
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              因為愛上清邁的悠閒步調和豐富文化，我們決定在這裡落地生根。自己也有小孩後，更深刻體會到帶著孩子旅行的種種需求——需要彈性的行程、舒適的交通、以及能夠順暢溝通的導遊。
            </p>
            <p className="text-gray-700 leading-relaxed">
              「清微旅行」就是在這樣的理念下誕生的。我們希望用在地人的視角，帶您體驗最道地的清邁；用父母的心情，為您規劃最適合家庭的行程。
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-4xl mb-4">👨</div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Eric</h4>
              <p className="text-gray-600">來自台灣，負責行程規劃與客戶溝通。熱愛探索清邁的大街小巷，專門發掘適合親子的私房景點。</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-4xl mb-4">👩</div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Min</h4>
              <p className="text-gray-600">清邁在地人，熟悉泰北文化與當地資源。確保每趟旅程都安全順利，讓您玩得放心。</p>
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">準備好認識清邁了嗎？</h3>
            <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
              LINE 聊聊
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
