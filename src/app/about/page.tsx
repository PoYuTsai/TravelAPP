import type { Metadata } from 'next'
import Image from 'next/image'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'

export const metadata: Metadata = {
  title: '關於我們',
  description: '清微旅行是住在清邁的台泰夫妻 Eric 和 Min 創立。我們也有女兒，懂爸媽帶小孩出遊的需求。',
}

// Blur placeholder for founders photo
const blurDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQRBQYSIRMxQWH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABYRAQEBAAAAAAAAAAAAAAAAAAABEf/aAAwDAQACEQMRAD8AotuXM19qN5cXEhmWOdkjQnpFXrgA/PtZpSlIr//Z'

const differentiators = [
  {
    icon: '🏠',
    title: '在地家庭經營',
    description: '不是旅行社，是真正住在清邁的家庭。台灣爸爸 + 泰國媽媽，給您最真實的在地體驗。',
  },
  {
    icon: '👶',
    title: '自己也是爸媽',
    description: '我們有女兒，懂帶小孩出遊的眉角。行程節奏、休息時間、用餐地點，都從爸媽角度思考。',
  },
  {
    icon: '🚐',
    title: '司機導遊分工',
    description: '專業分工，司機專心開車，導遊專心服務。不是中文司機一人包辦，服務品質更好。',
  },
]

export default function AboutPage() {
  return (
    <div className="py-12 md:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="關於清微旅行"
          subtitle="您在清邁的家人"
        />

        {/* Founders Photo */}
        <div className="mb-12 rounded-2xl overflow-hidden shadow-xl bg-primary-light">
          <Image
            src="/images/eric-min.jpg"
            alt="Eric 與 Min 穿著泰服在清邁銀廟前 - 清微旅行創辦人"
            width={1200}
            height={1500}
            className="w-full h-auto object-cover"
            priority
            placeholder="blur"
            blurDataURL={blurDataURL}
          />
        </div>

        {/* Story */}
        <div className="bg-primary-light rounded-2xl p-6 md:p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">我們的故事</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            嗨！我們是 Eric 和 Min，一對住在清邁的台泰夫妻。Eric 來自台灣，Min 是土生土長的清邁人。我們在這裡落地生根，有了自己的女兒。
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            自己當了爸媽後，更深刻體會到帶著孩子旅行的種種需求——需要彈性的行程、舒適的交通、能夠順暢溝通的導遊，還有懂小孩的服務人員。
          </p>
          <p className="text-gray-700 leading-relaxed">
            「清微旅行」就是在這樣的理念下誕生的。我們用在地人的視角，帶您體驗最道地的清邁；用父母的心情，為您規劃最適合家庭的行程。
          </p>
        </div>

        {/* Differentiators */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">為什麼選擇我們</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {differentiators.map((item) => (
              <div key={item.title} className="bg-white rounded-xl shadow-lg p-6 text-center">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-4xl mb-3">👨</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Eric</h3>
            <p className="text-gray-600 text-sm mb-2">台灣人・行程規劃・客戶溝通</p>
            <p className="text-gray-600">
              熱愛探索清邁的大街小巷，專門發掘適合親子的私房景點。會站在台灣爸媽的角度，規劃最適合的行程。
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-4xl mb-3">👩</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Min</h3>
            <p className="text-gray-600 text-sm mb-2">清邁人・在地資源・品質把關</p>
            <p className="text-gray-600">
              熟悉泰北文化與當地資源，確保每趟旅程都安全順利。芳縣自家民宿的主人，讓您體驗真正的泰北生活。
            </p>
          </div>
        </div>

        {/* Homestay mention */}
        <div className="bg-gray-50 rounded-2xl p-6 md:p-8 mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-3">不只包車，還有自家民宿</h2>
          <p className="text-gray-600 mb-4">
            除了包車服務，我們在芳縣還有自家經營的民宿「Huen San Fang Hotel」。
            想要深度體驗泰北生活？歡迎來住住看。
          </p>
          <Button href="/homestay" variant="outline">
            了解芳縣民宿
          </Button>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">準備好認識清邁了嗎？</h2>
          <p className="text-gray-600 mb-6">
            告訴我們你的旅行計畫，讓在地爸媽幫你規劃
          </p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
            LINE 免費諮詢
          </Button>
        </div>
      </div>
    </div>
  )
}
