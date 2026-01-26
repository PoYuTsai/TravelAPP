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

          {/* 預訂須知 - 重要提醒放最前面 */}
          <section className="mb-8 not-prose">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">預訂須知</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">💰 訂金制度</h3>
                <p className="text-gray-700">確認行程與報價後，需支付 <strong>50% 訂金</strong> 完成預訂。收到訂金後，我們會向司機/導遊下單安排。</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">📅 日期確認後不可更改</h3>
                <p className="text-gray-700">支付訂金後，用車日期即確定，<strong>無法更改日期</strong>。因為我們已向司機/導遊確認並排定檔期，更改會影響他們的其他預約。如需取消，請參考下方取消政策。</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">🚗 連續用車要求</h3>
                <p className="text-gray-700">包車服務需 <strong>連續天數</strong> 使用，不接受「跳天」預訂。</p>
                <p className="text-gray-600 text-sm mt-1">例如：可預訂 1/10-1/12 連續三天；但不接受 1/10 包車、1/11 休息、1/12 再包車的方式。</p>
                <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                  <p className="text-amber-800 text-sm">
                    <strong>旺季期間（2月春節、4月潑水節、11月水燈節、12-1月跨年）</strong>為司機/導遊最繁忙的檔期，一律不接受跳天預訂。淡季月份如有特殊需求，請先與我們確認。
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-8 not-prose">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">包車服務取消政策</h2>
            <p className="text-gray-600 mb-4 text-sm">
              以下為標準取消政策，退款比例以總金額計算。特殊情況請與我們聯繫討論。
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">取消時間</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">退款比例</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">範例（訂單 10,000 元）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">14 天前取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-green-600 font-semibold">全額退款（100%）</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-600">退 5,000 元（訂金全退）</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">7-13 天前取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-yellow-600 font-semibold">退款 50%</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-600">退 5,000 元（訂金全退）</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">4-6 天前取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-orange-600 font-semibold">退款 30%</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-600">退 3,000 元</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">3 天內取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-red-600 font-semibold">不予退款</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-600">退 0 元</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">當天取消或未到</td>
                    <td className="border border-gray-300 px-4 py-2 text-red-600 font-semibold">不予退款</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-600">退 0 元</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              * 範例假設訂單總金額 10,000 元，已付 50% 訂金（5,000 元）
            </p>
          </section>

          <section className="mb-8 not-prose">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">民宿住宿取消政策</h2>
            <p className="text-gray-600 mb-4 text-sm">
              民宿訂房同樣收取 50% 訂金，退款比例以總金額計算。
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">取消時間</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">退款比例</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">範例（訂單 6,000 元）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">30 天前取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-green-600 font-semibold">全額退款（100%）</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-600">退 3,000 元（訂金全退）</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">14-29 天前取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-yellow-600 font-semibold">退款 50%</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-600">退 3,000 元（訂金全退）</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">7-13 天前取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-orange-600 font-semibold">退款 30%</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-600">退 1,800 元</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">7 天內取消</td>
                    <td className="border border-gray-300 px-4 py-2 text-red-600 font-semibold">不予退款</td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-600">退 0 元</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              * 範例假設訂單總金額 6,000 元，已付 50% 訂金（3,000 元）
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">特殊情況</h2>
            <p className="text-gray-700 mb-4">
              以下情況我們會彈性處理：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>航班取消或延誤：</strong>提供航空公司證明，可全額退款或改期</li>
              <li><strong>突發疾病：</strong>提供醫療證明，可協商退款或改期</li>
              <li><strong>天災等不可抗力：</strong>可全額退款或改期</li>
            </ul>
          </section>

          <section className="mb-8 not-prose">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">不予退費情況</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <p className="text-gray-700 mb-4">
                以下情況屬旅客自身責任，恕無法退費：
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-2">
                <li>
                  <strong>未填寫 TDAC（泰國入境卡）：</strong>
                  入境泰國前需完成線上申報，未填寫可能導致無法順利入境
                </li>
                <li>
                  <strong>攜帶現金不足：</strong>
                  泰國海關可能抽查旅客是否攜帶等值 20,000 泰銖（約台幣 18,000 元）的現金或旅行支票，不足者可能被拒絕入境
                </li>
              </ul>
              <p className="text-gray-500 text-sm mt-4">
                以上情況導致無法入境，訂金將不予退還。建議出發前確認相關入境規定。
              </p>
            </div>
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

          <section className="mb-8 not-prose">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">改期政策</h2>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-gray-700">
                <strong>原則上，支付訂金後日期即確定，不接受改期。</strong>
              </p>
              <p className="text-gray-600 mt-2 text-sm">
                若遇不可抗力因素（航班取消、突發疾病等），請提供證明文件，我們會協助處理。特殊情況請直接與我們聯繫討論。
              </p>
            </div>
          </section>

          {/* 純包車服務說明 */}
          <section className="mb-8 not-prose">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">純包車服務說明</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <p className="text-gray-700 mb-4">
                如果您只預訂包車（不含導遊），請了解以下服務方式：
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">📝 行程安排</h3>
                  <p className="text-gray-700">
                    我們會事先幫您規劃好行程，並將景點清單貼在 LINE 群組的記事本，方便隨時查看。
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">⏰ 彈性時間，沒有壓力</h3>
                  <p className="text-gray-700">
                    純包車服務 <strong>不設定固定停留時間</strong>，您可以依自己的節奏遊玩。逛累了想休息、孩子想多玩一會，都沒問題。
                  </p>
                  <p className="text-gray-600 text-sm mt-1">
                    若您希望有人幫忙控制時間節奏、介紹景點，建議加訂導遊服務。
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">💬 即時溝通</h3>
                  <p className="text-gray-700">
                    逛完一個景點，請在 LINE 群組通知一聲，司機會在原地等候或開過來接您。我們全程透過群組保持聯繫，不用擔心找不到車。
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
