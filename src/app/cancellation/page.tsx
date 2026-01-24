import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '取消與退款政策 | 清微旅行',
  description: '清微旅行的取消與退款政策，包含取消時程、退款比例等說明。',
  alternates: {
    canonical: 'https://chiangway-travel.com/cancellation',
  },
  openGraph: {
    title: '取消與退款政策 | 清微旅行',
    description: '清微旅行的取消與退款政策，包含取消時程、退款比例等說明。',
    url: 'https://chiangway-travel.com/cancellation',
  },
  twitter: {
    card: 'summary',
    title: '取消與退款政策 | 清微旅行',
    description: '清微旅行的取消與退款政策。',
  },
}

export default function CancellationPage() {
  return (
    <div className="py-12 md:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
          取消與退款政策
        </h1>

        <div className="prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">
            最後更新日期：2026 年 1 月
          </p>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <p className="text-yellow-800">
              我們理解旅行計畫可能會變動，以下是我們的取消與退款政策。如有特殊情況，請直接與我們聯繫討論。
            </p>
          </div>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">包車服務取消政策</h2>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">取消時間</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">退款比例</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">7 天前取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-green-600 font-semibold">全額退款（100%）</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">3-6 天前取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-yellow-600 font-semibold">退款 50%</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">1-2 天前取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-orange-600 font-semibold">退款 30%</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">當天取消或未到</td>
                    <td className="border border-gray-300 px-4 py-2 text-red-600 font-semibold">不予退款</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">民宿住宿取消政策</h2>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">取消時間</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">退款比例</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">14 天前取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-green-600 font-semibold">全額退款（100%）</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">7-13 天前取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-yellow-600 font-semibold">退款 50%</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">3-6 天前取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-orange-600 font-semibold">退款 30%</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">2 天內取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-red-600 font-semibold">不予退款</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">特殊情況</h2>
            <p className="text-gray-700 mb-4">
              以下情況我們會彈性處理：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>航班取消或延誤：</strong>提供航空公司證明，可全額退款或改期</li>
              <li><strong>簽證問題：</strong>提供相關證明，可協商退款比例</li>
              <li><strong>突發疾病：</strong>提供醫療證明，可協商退款或改期</li>
              <li><strong>天災等不可抗力：</strong>可全額退款或改期</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">我方取消</h2>
            <p className="text-gray-700 mb-4">
              如因我方因素無法提供服務（如車輛故障、司機臨時無法出勤等），我們將：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>優先安排替代車輛或司機</li>
              <li>如無法安排替代方案，全額退款</li>
              <li>視情況提供額外補償</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">退款方式</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>退款將以原付款方式退回</li>
              <li>確認退款後，請告訴我們您的帳戶資訊，我們會儘快將款項退回給您</li>
              <li>跨國轉帳手續費由雙方各負擔一半</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">如何取消預訂</h2>
            <p className="text-gray-700 mb-4">
              請透過 LINE 聯繫我們進行取消：
            </p>
            <ol className="list-decimal pl-6 text-gray-700 space-y-2">
              <li>告知您的預訂資訊（姓名、日期）</li>
              <li>說明取消原因</li>
              <li>我們會確認退款金額並處理</li>
            </ol>
            <p className="text-gray-700 mt-4">
              LINE 聯繫：
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

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">改期政策</h2>
            <p className="text-gray-700">
              如需改期而非取消，只要新日期在 3 個月內且我們有空檔，可免費改期一次。超過一次或超過 3 個月，視為取消重新預訂。
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
