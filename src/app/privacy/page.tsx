import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '隱私權政策',
  description: '清微旅行的隱私權政策，說明我們如何收集、使用和保護您的個人資料。',
  alternates: {
    canonical: 'https://chiangway-travel.com/privacy',
  },
  openGraph: {
    title: '隱私權政策',
    description: '清微旅行的隱私權政策，說明我們如何收集、使用和保護您的個人資料。',
    url: 'https://chiangway-travel.com/privacy',
  },
  twitter: {
    card: 'summary',
    title: '隱私權政策',
    description: '清微旅行的隱私權政策。',
  },
}

export default function PrivacyPage() {
  return (
    <div className="py-12 md:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
          隱私權政策
        </h1>

        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">
            最後更新日期：2026 年 1 月
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. 資料收集</h2>
            <p className="text-gray-700 mb-4">
              清微旅行（以下簡稱「我們」）在您使用我們的服務時，可能會收集以下資料：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>姓名、電子郵件、電話號碼等聯絡資訊</li>
              <li>旅行日期、人數、特殊需求等預訂資訊</li>
              <li>透過 LINE 或其他通訊軟體的對話紀錄</li>
              <li>網站瀏覽紀錄（透過 cookies）</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. 資料使用目的</h2>
            <p className="text-gray-700 mb-4">
              我們收集的資料將用於：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>處理您的預訂請求並提供服務</li>
              <li>與您溝通行程細節和注意事項</li>
              <li>寄送服務相關通知和確認信</li>
              <li>改善我們的服務品質</li>
              <li>遵守法律要求</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. 資料保護</h2>
            <p className="text-gray-700 mb-4">
              我們採取適當的安全措施保護您的個人資料，包括：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>使用 SSL 加密傳輸資料</li>
              <li>限制員工存取個人資料的權限</li>
              <li>定期審查資料安全措施</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. 資料分享</h2>
            <p className="text-gray-700 mb-4">
              除以下情況外，我們不會將您的個人資料分享給第三方：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>為完成您的預訂而需要與合作司機或導遊分享必要資訊</li>
              <li>法律要求或政府機關合法請求</li>
              <li>經您明確同意</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Cookies</h2>
            <p className="text-gray-700 mb-4">
              我們的網站使用 cookies 來改善您的瀏覽體驗。您可以透過瀏覽器設定停用 cookies，但這可能影響網站的部分功能。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. 您的權利</h2>
            <p className="text-gray-700 mb-4">
              您有權：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>查詢我們持有的您的個人資料</li>
              <li>要求更正不正確的資料</li>
              <li>要求刪除您的個人資料</li>
              <li>撤回您的同意</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. 聯絡我們</h2>
            <p className="text-gray-700">
              如有任何關於隱私權的問題，請透過 LINE 聯繫我們：
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
  )
}
