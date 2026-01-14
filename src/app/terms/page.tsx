import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '服務條款 | 清微旅行',
  description: '清微旅行的服務條款，包含預訂、付款、取消等相關規定。',
}

export default function TermsPage() {
  return (
    <div className="py-12 md:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
          服務條款
        </h1>

        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">
            最後更新日期：2026 年 1 月
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. 服務說明</h2>
            <p className="text-gray-700 mb-4">
              清微旅行提供清邁地區的包車服務及民宿住宿服務。我們的服務包含：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>親子包車服務（含司機、車輛）</li>
              <li>中文導遊服務（依需求另計）</li>
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
              <li>LINE Pay（依當時匯率換算）</li>
            </ul>
            <p className="text-gray-700 mt-4">
              訂金為總金額的 30%，尾款於行程結束後支付。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. 服務內容</h2>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">包車服務包含：</h3>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>車輛使用</li>
              <li>專屬司機</li>
              <li>油資</li>
              <li>過路費</li>
              <li>兒童安全座椅（需事先告知）</li>
            </ul>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">不包含：</h3>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>景點門票</li>
              <li>餐飲費用</li>
              <li>導遊服務（另計）</li>
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
              <li>超時服務將依實際時數加收費用</li>
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
  )
}
