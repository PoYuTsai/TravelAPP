import type { Metadata } from 'next'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'
import ContactForm from '@/components/ContactForm'
import ContactPageSchema from '@/components/schema/ContactPageSchema'
import { FAQSection } from '@/components/cms'

export const metadata: Metadata = {
  title: '聯繫我們',
  description: '透過 LINE 或社群媒體聯繫清微旅行，免費諮詢清邁親子旅遊行程。',
  alternates: {
    canonical: 'https://chiangway-travel.com/contact',
  },
  openGraph: {
    title: '聯繫我們',
    description: '透過 LINE 或社群媒體聯繫清微旅行，免費諮詢清邁親子旅遊行程。',
    url: 'https://chiangway-travel.com/contact',
    images: [{ url: '/images/og-image.png', width: 1200, height: 630, alt: '清微旅行 - 聯繫我們' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '聯繫我們',
    description: '透過 LINE 或社群媒體聯繫清微旅行，免費諮詢清邁親子旅遊行程。',
    images: ['/images/og-image.png'],
  },
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

const faqItems = [
  {
    question: '需要提前多久預約？',
    answer: '建議出發前 1-2 週預約，旺季（11-2月）建議提前更久。',
  },
  {
    question: '可以客製化行程嗎？',
    answer: '當然可以！我們會根據您的需求量身規劃行程。',
  },
  {
    question: '費用如何計算？',
    answer: '根據行程內容、人數、天數報價，歡迎 LINE 詢問。',
  },
]

export default function ContactPage() {
  return (
    <>
      <ContactPageSchema faqItems={faqItems} />
      <div className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="聯繫我們"
          subtitle="有任何問題都歡迎詢問，我們很樂意為您服務"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* 左側：聯絡表單 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">線上諮詢表單</h3>
            <ContactForm />
          </div>

          {/* 右側：其他聯繫方式 */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">其他聯繫方式</h3>
              <div className="space-y-4">
                {contactMethods.map((method) => (
                  <a
                    key={method.title}
                    href={method.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow flex items-start gap-4 block"
                  >
                    <div className="text-3xl">{method.icon}</div>
                    <div>
                      <h4 className="font-bold text-gray-900">{method.title}</h4>
                      <p className="text-gray-600 text-sm">{method.description}</p>
                      <span className="text-primary font-medium text-sm">{method.linkText}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* 常見問題 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">常見問題</h3>
              <FAQSection items={faqItems} />
              <div className="mt-4">
                <Button href="https://line.me/R/ti/p/@037nyuwk" external size="sm" variant="secondary">
                  更多問題？LINE 我們
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
