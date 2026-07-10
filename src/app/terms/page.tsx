import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  title: '服務條款',
  description: '清微旅行的服務條款，包含預訂、付款、取消等相關規定。',
  alternates: {
    canonical: 'https://chiangway-travel.com/terms',
  },
  openGraph: {
    title: '服務條款',
    description: '清微旅行的服務條款，包含預訂、付款、取消等相關規定。',
    url: 'https://chiangway-travel.com/terms',
  },
  twitter: {
    card: 'summary_large_image',
    title: '服務條款',
    description: '清微旅行的服務條款。',
  },
}

export default function TermsPage() {
  // Static schema - no user input, safe to use
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: '服務條款',
    description: '清微旅行的服務條款，包含預訂、付款、取消等相關規定。',
    url: 'https://chiangway-travel.com/terms',
    inLanguage: 'zh-TW',
    isPartOf: {
      '@type': 'WebSite',
      '@id': 'https://chiangway-travel.com/#website',
    },
    publisher: {
      '@type': 'Organization',
      '@id': 'https://chiangway-travel.com/#organization',
    },
    dateModified: '2026-07-10',
  }

  return (
    <>
      <Script
        id="terms-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <div className="py-12 md:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
          服務條款
        </h1>

        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">
            最後更新日期：2026 年 7 月
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. 服務說明</h2>
            <p className="text-gray-700 mb-4">
              清微旅行提供清邁地區的包車服務及民宿住宿服務。我們的服務包含：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>親子包車服務（標準泰國司機）</li>
              <li>中文導遊服務（依需求選配）</li>
              <li>機場接送服務</li>
              <li>芳縣民宿住宿</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. 預訂流程</h2>
            <ol className="list-decimal pl-6 text-gray-700 space-y-2">
              <li>透過 LINE 聯繫我們，說明您的需求</li>
              <li>我們提供行程建議和報價</li>
              <li>確認行程後，支付訂金完成預訂</li>
              <li>行程結束後支付尾款</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. 付款方式</h2>
            <p className="text-gray-700 mb-4">
              我們接受以下付款方式：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>銀行轉帳（台灣銀行帳戶）</li>
              <li>現金（泰銖或台幣）</li>
            </ul>
            <p className="text-gray-700 mt-4">
              訂金為總金額的 50%，尾款於行程結束後支付。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. 服務內容</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">包車服務包含：</h3>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>車輛、泰國司機、油資、過路費、停車費與 LINE 中文支援</li>
            </ul>
            <p className="text-gray-700 mb-4">
              標準泰國司機通常不以中文服務；行程會在出發前確認。需要隨車中文溝通或導覽時，可選配中文導遊。中文導遊僅在選配方案中包含。
            </p>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">不包含：</h3>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>景點門票</li>
              <li>餐飲費用</li>
              <li>中文導遊服務（選配方案另計）</li>
              <li>兒童安全座椅：THB 500／日／張，且佔一個座位；每位乘客（含嬰幼兒）各佔一席，安全座椅安裝於該乘客座位，不另加算一人</li>
              <li>小費（建議但非強制）</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. 行程變更</h2>
            <p className="text-gray-700 mb-4">
              我們理解親子旅遊需要彈性，因此：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>行程當天可依孩子狀況調整景點順序</li>
              <li>如需大幅變更行程，請提前一天告知</li>
              <li>標準用車時數為清邁 10 小時；清萊／金三角 12 小時</li>
              <li>超時費為 THB 300／小時／台，中文導遊不另收超時費</li>
              <li>結束時間有 30 分鐘內彈性，超過後依超時時數計費</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. 責任限制</h2>
            <p className="text-gray-700 mb-4">
              我們將盡力提供安全舒適的服務，但以下情況不在我們的責任範圍內：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>因天災、交通管制等不可抗力因素造成的行程延誤</li>
              <li>旅客個人物品遺失或損壞</li>
              <li>旅客自身健康問題</li>
              <li>景點臨時關閉</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. 保險</h2>
            <p className="text-gray-700">
              我們的車輛皆有投保強制險。建議旅客自行購買旅遊平安險以獲得更完整的保障。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. 聯絡我們</h2>
            <p className="text-gray-700">
              如有任何問題，請透過 LINE 聯繫我們：
              <a
                href="https://line.me/R/ti/p/@037nyuwk"
                className="text-primary hover:underline ml-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                @037nyuwk
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
    </>
  )
}
