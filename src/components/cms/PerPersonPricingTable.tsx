import {
  AIRPORT_TRANSFER_FEES,
  CHILD_SEAT_FEE_PER_DAY,
  INSURANCE_FEE_PER_PERSON,
  LUGGAGE_VAN_FEE,
  calcPerPersonDay,
  type Tier,
} from '@/lib/pricing/perPersonRates'

/**
 * 公開版人頭計價價目表（framework 文件第 6 節公開版）。
 * 價格一律由 perPersonRates 引擎推導，單一事實來源，不另存數字。
 * 規格：docs/plans/2026-07-10-per-person-pricing-framework.md
 */

/** 超時費（不含項，按台實收）THB/小時/台 */
const OVERTIME_FEE_PER_HOUR_PER_CAR = 300

const TIER_COLUMNS: Array<{ tier: Tier; label: string }> = [
  { tier: 'T1', label: '清邁市區' },
  { tier: 'T2', label: '清邁近郊' },
  { tier: 'T3', label: '清萊' },
  { tier: 'T4', label: '金三角' },
]

interface RateTableSpec {
  icon: string
  title: string
  subtitle: string
  groupSizes: number[]
  withGuide: boolean
}

const RATE_TABLES: RateTableSpec[] = [
  {
    icon: '🚗',
    title: '轎車＋司機',
    subtitle: '2–3 人，不配導遊',
    groupSizes: [2, 3],
    withGuide: false,
  },
  {
    icon: '🚐',
    title: 'Van＋司機',
    subtitle: '4–7 人，中文導遊選配',
    groupSizes: [4, 5, 6, 7],
    withGuide: false,
  },
  {
    icon: '🚐',
    title: 'Van＋司機＋中文導遊',
    subtitle: '4–9 人（8 人以上依泰國法規必配持證導遊）',
    groupSizes: [4, 5, 6, 7, 8, 9],
    withGuide: true,
  },
]

const SEAT_RULES = [
  { people: '2–3 人', rule: '轎車＋司機，不配導遊' },
  { people: '4–7 人', rule: 'Van＋司機，中文導遊可選配' },
  { people: '8–9 人', rule: 'Van＋司機＋必配持證中文導遊（泰國法規）' },
  { people: '10 人以上', rule: '兩台車，各自依人數計價' },
]

const CHILD_RULES = [
  { age: '12 歲以上', price: '全價' },
  { age: '3–11 歲', price: '8 折' },
  { age: '0–2 歲', price: '半價' },
]

function thb(amount: number): string {
  return amount.toLocaleString('en-US')
}

interface PerPersonPricingTableProps {
  footnotes?: string[]
}

export default function PerPersonPricingTable({ footnotes }: PerPersonPricingTableProps) {
  return (
    <div className="space-y-10">
      {/* 每人每日價三張表 */}
      <div>
        <p className="text-sm text-gray-500 mb-4 text-center">
          單位：THB／人／日，以同行總人數（含嬰兒）查表
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {RATE_TABLES.map((table) => (
            <div
              key={table.title + table.subtitle}
              className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
            >
              <div className="bg-gray-50 p-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{table.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{table.title}</h3>
                    <p className="text-sm text-gray-500">{table.subtitle}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-2 text-left font-medium whitespace-nowrap">人數</th>
                      {TIER_COLUMNS.map(({ tier, label }) => (
                        <th key={tier} className="py-2 px-1 text-right font-medium whitespace-nowrap">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.groupSizes.map((size) => (
                      <tr key={size} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-2 text-gray-700 whitespace-nowrap">{size} 人</td>
                        {TIER_COLUMNS.map(({ tier }) => (
                          <td
                            key={tier}
                            className="py-2 px-1 text-right font-semibold text-gray-900 whitespace-nowrap"
                          >
                            {thb(calcPerPersonDay(tier, size, table.withGuide))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 座位與人力規則 */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">車型與人力怎麼配</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SEAT_RULES.map((item) => (
            <div key={item.people} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="font-bold text-gray-900 mb-1">{item.people}</p>
              <p className="text-sm text-gray-600">{item.rule}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-3 text-center">
          司機與導遊是分開的專業角色：司機專心開車，中文導遊專心照顧一家人。
        </p>
      </div>

      {/* 小孩收費 */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">小孩怎麼算</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {CHILD_RULES.map((item) => (
            <div key={item.age} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-sm text-gray-500 mb-1">{item.age}</p>
              <p className="text-xl font-bold text-gray-900">{item.price}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-3 text-center">
          嬰兒也需要一個座位（安全座椅），人數級距以總座位數計。
        </p>
      </div>

      {/* 加購與不含項 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">加購項目（實收）</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between gap-4">
              <span className="text-gray-700">旅遊保險（自由加購，投保時嬰兒也投保）</span>
              <span className="font-semibold text-gray-900 whitespace-nowrap">
                THB {thb(INSURANCE_FEE_PER_PERSON)}／人／趟
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-gray-700">兒童安全座椅</span>
              <span className="font-semibold text-gray-900 whitespace-nowrap">
                THB {thb(CHILD_SEAT_FEE_PER_DAY)}／日／張
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-gray-700">接送機（單趟，無排行程日）</span>
              <span className="font-semibold text-gray-900 whitespace-nowrap">
                轎車 {thb(AIRPORT_TRANSFER_FEES.sedan)}／Van {thb(AIRPORT_TRANSFER_FEES.van)}
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-gray-700">接送機日 8 人以上加派行李車（攤入每人價）</span>
              <span className="font-semibold text-gray-900 whitespace-nowrap">
                THB {thb(LUGGAGE_VAN_FEE)}／趟
              </span>
            </li>
          </ul>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">費用不含</h3>
          <ul className="space-y-3 text-sm text-gray-700">
            <li>
              超時費：清邁一日 10 小時、清萊／金三角一日 12 小時，超過後 THB{' '}
              {thb(OVERTIME_FEE_PER_HOUR_PER_CAR)}／小時／台，按台實收
            </li>
            <li>景點門票、餐食（可代訂另計）</li>
          </ul>
          <p className="text-sm text-gray-500 mt-4">
            每人價已包含：車資、油費、過路費、停車費、司機，配導遊方案含中文導遊，以及全程中文客服。
          </p>
        </div>
      </div>

      {/* 誠實註記 */}
      <div className="text-sm text-gray-500 space-y-1 max-w-4xl mx-auto">
        <p>* 金額為每人每日參考價（泰銖 THB），連續包車 3 日以上另有長包優惠，實際以正式報價為準。</p>
        <p>* 清萊、金三角多日行程如需司機導遊過夜，住宿成本會攤入每人價中一併報價。</p>
        {footnotes?.map((note, index) => <p key={index}>* {note}</p>)}
      </div>
    </div>
  )
}
