import type { Metadata } from 'next'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'

export const metadata: Metadata = {
  title: '聯繫我們',
  description: '透過 LINE 或社群媒體聯繫清微旅行，免費諮詢清邁親子旅遊行程。',
}

const contactMethods = [
  {
    icon: '💬',
    title: 'LINE 官方帳號',
    description: '最快速的聯繫方式，通常 24 小時內回覆',
    link: 'https://line.me/R/ti/p/@037nyuwk',
    linkText: '加入好友',
  },
  {
    icon: '📸',
    title: 'Instagram',
    description: '追蹤我們的清邁日常與旅遊分享',
    link: 'https://www.instagram.com/chiangway_travel',
    linkText: '@chiangway_travel',
  },
  {
    icon: '📘',
    title: 'Facebook',
    description: '最新行程資訊與旅遊優惠',
    link: 'https://www.facebook.com/profile.php?id=61569067776768',
    linkText: '清微旅行',
  },
  {
    icon: '🎵',
    title: 'TikTok',
    description: '清邁短影音，發現更多玩法',
    link: 'https://www.tiktok.com/@chiangway_travel',
    linkText: '@chiangway_travel',
  },
]

export default function ContactPage() {
  return (
    <div className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="聯繫我們"
          subtitle="有任何問題都歡迎詢問，我們很樂意為您服務"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {contactMethods.map((method) => (
            <a
              key={method.title}
              href={method.link}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow flex items-start gap-4"
            >
              <div className="text-4xl">{method.icon}</div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{method.title}</h3>
                <p className="text-gray-600 text-sm mb-2">{method.description}</p>
                <span className="text-primary font-medium">{method.linkText}</span>
              </div>
            </a>
          ))}
        </div>

        <div className="bg-primary-light rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">常見問題</h3>
          <div className="text-left max-w-2xl mx-auto space-y-4 mb-6">
            <div>
              <h4 className="font-bold text-gray-900">Q: 需要提前多久預約？</h4>
              <p className="text-gray-600">建議出發前 1-2 週預約，旺季（11-2月）建議提前更久。</p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Q: 可以客製化行程嗎？</h4>
              <p className="text-gray-600">當然可以！我們會根據您的需求量身規劃行程。</p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Q: 費用如何計算？</h4>
              <p className="text-gray-600">根據行程內容、人數、天數報價，歡迎 LINE 詢問。</p>
            </div>
          </div>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
            還有問題？LINE 我們
          </Button>
        </div>
      </div>
    </div>
  )
}
