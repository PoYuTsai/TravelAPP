import type { Metadata } from 'next'
import Button from '@/components/ui/Button'
import SectionTitle from '@/components/ui/SectionTitle'

export const metadata: Metadata = {
  title: '清邁親子包車服務 | 清微旅行',
  description: '專為親子家庭設計的清邁包車服務。司機導遊專業分工，兒童安全座椅，行程彈性不趕路。每日 NT$ 3,500 起。',
}

const features = [
  {
    icon: '🚐',
    title: '舒適車輛',
    description: '寬敞 SUV 或 Van，空間充足放行李和嬰兒車',
  },
  {
    icon: '👨‍✈️',
    title: '司機 + 導遊分工',
    description: '司機專心開車，導遊專心服務，不是一人包辦',
  },
  {
    icon: '🧒',
    title: '兒童安全座椅',
    description: '提供各年齡適用的安全座椅，事先告知即可準備',
  },
  {
    icon: '🗓️',
    title: '行程彈性',
    description: '不跑固定路線，依孩子狀況隨時調整，不趕路',
  },
  {
    icon: '✈️',
    title: '接送機服務',
    description: '機場接送，讓你一落地就開始輕鬆旅程',
  },
  {
    icon: '💬',
    title: '全程中文',
    description: '從諮詢到結束都用中文，溝通無障礙',
  },
]

const pricingTiers = [
  { duration: '半日（4小時）', price: 'NT$ 2,000 起' },
  { duration: '一日（8小時）', price: 'NT$ 3,500 起' },
  { duration: '機場接送（單程）', price: 'NT$ 800 起' },
]

const faqs = [
  {
    q: '價格包含什麼？',
    a: '包含車輛、司機、油資、過路費。導遊服務另計，依行程複雜度報價。',
  },
  {
    q: '可以帶嬰兒車嗎？',
    a: '可以，我們的車輛空間充足。請事先告知，我們會確保有足夠空間。',
  },
  {
    q: '安全座椅怎麼安排？',
    a: '請告知孩子年齡和體重，我們會準備適合的安全座椅，免費提供。',
  },
  {
    q: '可以客製行程嗎？',
    a: '當然可以，這是我們的特色。告訴我們想去的地方、孩子年齡，我們幫你規劃。',
  },
  {
    q: '怎麼預訂？',
    a: '透過 LINE 聯繫我們，討論需求後會提供報價，確認後付訂金即可。',
  },
]

export default function CarCharterPage() {
  return (
    <div className="py-12 md:py-20">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            清邁親子包車服務
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            司機導遊專業分工，兒童安全座椅準備好，行程彈性不趕路。
            <br />
            讓在地爸媽帶你玩清邁。
          </p>
        </div>
        <div className="flex justify-center gap-4">
          <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
            LINE 免費諮詢
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle title="服務特色" subtitle="專為親子家庭設計" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white p-6 rounded-xl shadow-sm"
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle title="參考價格" subtitle="實際報價依行程內容調整" />
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-gray-900 font-bold">
                    服務項目
                  </th>
                  <th className="px-6 py-4 text-right text-gray-900 font-bold">
                    參考價格
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pricingTiers.map((tier) => (
                  <tr key={tier.duration}>
                    <td className="px-6 py-4 text-gray-700">{tier.duration}</td>
                    <td className="px-6 py-4 text-right font-bold text-primary">
                      {tier.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-4 bg-primary-light text-sm text-gray-700">
              以上為參考價格，實際報價會根據人數、車型、行程內容調整。歡迎 LINE 詢問！
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle title="常見問題" />
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="font-bold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            準備好預訂了嗎？
          </h2>
          <p className="text-gray-600 mb-6">
            告訴我們你的旅行日期和需求，我們會盡快回覆報價
          </p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
            LINE 免費諮詢
          </Button>
        </div>
      </section>
    </div>
  )
}
