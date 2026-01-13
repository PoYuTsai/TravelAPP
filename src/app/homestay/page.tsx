import type { Metadata } from 'next'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'

export const metadata: Metadata = {
  title: '芳縣特色民宿 | Huen San Fang Hotel | 清微旅行',
  description: '遠離觀光區的寧靜民宿，體驗泰北在地生活。適合長住深度旅遊，民宿主人親自接待。',
}

const features = [
  {
    icon: '🌿',
    title: '遠離觀光區',
    description: '位於芳縣，享受真正的泰北寧靜',
  },
  {
    icon: '🏡',
    title: '在地生活體驗',
    description: '不只是住宿，更是體驗當地人的日常',
  },
  {
    icon: '👨‍👩‍👧',
    title: '民宿主人接待',
    description: '我們親自接待，有問題隨時找得到人',
  },
  {
    icon: '🚐',
    title: '包車搭配',
    description: '搭配包車服務，交通接送都安排好',
  },
]

export default function HomestayPage() {
  return (
    <div className="py-12 md:py-20">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="text-center mb-8">
          <p className="text-primary font-medium mb-2">Huen San Fang Hotel</p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            芳縣特色民宿
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            遠離觀光客的喧囂，在清邁芳縣體驗真正的泰北生活。
            <br />
            我們自己住這裡，也邀請你來住。
          </p>
        </div>

        {/* Placeholder for images */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-square bg-gradient-to-br from-primary-light to-primary/20 rounded-xl flex items-center justify-center"
            >
              <span className="text-4xl">🏠</span>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
            LINE 詢問房況
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle title="民宿特色" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white p-6 rounded-xl shadow-sm text-center"
              >
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle title="位置" subtitle="芳縣 Fang District" />
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <p className="text-gray-600 mb-4">
              芳縣位於清邁北方約 150 公里，車程約 2.5 小時。這裡遠離觀光區，
              是真正的泰北農村生活。適合想要深度體驗、長住的旅客。
            </p>
            <p className="text-gray-600">
              我們可以安排從清邁市區的接送，搭配包車行程，交通完全不用擔心。
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            想來住住看嗎？
          </h2>
          <p className="text-gray-800 mb-6">
            告訴我們你的旅行日期，我們幫你安排
          </p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external variant="secondary" size="lg">
            LINE 詢問房況
          </Button>
        </div>
      </section>
    </div>
  )
}
