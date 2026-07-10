import {
  AIRPORT_TRANSFER_FEES,
  CHILD_SEAT_FEE_PER_DAY,
  INSURANCE_FEE_PER_PERSON,
  LUGGAGE_VAN_FEE,
  calcPerPersonDay,
  type Tier,
} from '@/lib/pricing/perPersonRates'
import { CHARTER_OVERTIME_POLICY } from '@/lib/pricing/publicPolicy'
import { CHILD_SEAT_OCCUPANCY_POLICY } from '@/lib/home-public-copy'
import { CarFront, Languages, type LucideIcon } from 'lucide-react'

/**
 * 公開版人頭計價價目表（framework 文件第 6 節公開版）。
 * 價格一律由 perPersonRates 引擎推導，單一事實來源，不另存數字。
 * 規格：docs/plans/2026-07-10-per-person-pricing-framework.md
 */

const TIER_COLUMNS: Array<{ tier: Tier; label: string }> = [
  { tier: 'T1', label: '清邁市區' },
  { tier: 'T2', label: '清邁近郊' },
  { tier: 'T3', label: '清萊' },
  { tier: 'T4', label: '金三角' },
]

interface PricingPlanSpec {
  id: 'driver' | 'guided'
  icon: LucideIcon
  title: string
  description: string
  recommendation?: string
  withGuide: boolean
}

const PRICING_PLANS: PricingPlanSpec[] = [
  {
    id: 'driver',
    icon: CarFront,
    title: '方案 A｜泰國司機包車',
    description: '泰國司機專心安全駕駛，旅途中由 LINE 中文客服協助。',
    withGuide: false,
  },
  {
    id: 'guided',
    icon: Languages,
    title: '方案 B｜泰國司機＋中文導遊同行',
    description: '司機與中文導遊分工，協助景點導覽、現場溝通與行程節奏。',
    recommendation: '親子家庭、8 人（含）以上推薦',
    withGuide: true,
  },
]

const PUBLIC_GROUP_SIZES = [2, 3, 4, 5, 6, 7, 8, 9]

const SEAT_RULES = [
  { people: '2–3 人', rule: '轎車＋泰國司機；中文導遊可選配。3 人加導遊時，一般 5 人座剛好滿座；座位、安全座椅、行李較多或舒適度需求會由調度確認車型' },
  { people: '4–9 人', rule: '一台 Van＋泰國司機；中文導遊可選配' },
  { people: '10–18 人', rule: 'Van×2（兩台 Van）＋泰國司機；請用 LINE 取得整團報價；如選配中文導遊，兩台車共用一位' },
  { people: '19 人以上', rule: '人工報價，確認車輛與服務安排' },
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
      {/* 每人每日價：兩套完整公開方案 */}
      <div>
        <div className="mb-6 text-center">
          <p className="text-lg font-bold text-gray-900">全成人同行參考</p>
          <p className="mt-1 text-base font-semibold text-amber-700">
            以下金額皆為 THB／人／日
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            標準安排為泰國司機；需要隨車中文溝通或導覽，可加聘中文導遊。
          </p>
        </div>
        <div className="space-y-6">
          {PRICING_PLANS.map((plan) => {
            const PlanIcon = plan.icon
            const guided = plan.id === 'guided'

            return (
            <article
              key={plan.id}
              data-pricing-plan={plan.id}
              className={`overflow-hidden rounded-3xl border bg-white shadow-lg ${guided ? 'border-amber-300' : 'border-slate-200'}`}
            >
              <div className={`border-b px-5 py-6 sm:px-7 ${guided ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${guided ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white'}`} aria-hidden="true">
                      <PlanIcon className="h-6 w-6" strokeWidth={2} />
                    </span>
                    <div>
                      <h3 className="text-xl font-bold text-gray-950">{plan.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-gray-700">{plan.description}</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900">
                        2–3 人使用轎車｜4–9 人使用 Van
                      </p>
                    </div>
                  </div>
                  {plan.recommendation && (
                    <span className="w-fit shrink-0 rounded-full bg-amber-500 px-3 py-1.5 text-sm font-bold text-white">
                      {plan.recommendation}
                    </span>
                  )}
                </div>
                {guided && (
                  <p className="mt-4 rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 text-sm leading-relaxed text-gray-800">
                    8 人（含）以上同行，建議安排中文導遊，協助現場溝通、景點導覽與行程節奏，讓多人同行更順暢。
                  </p>
                )}
              </div>
              <p className="px-5 pt-4 text-xs font-semibold text-slate-600 sm:hidden">
                左右滑動查看全部地區價格 →
              </p>
              <div className="overflow-x-auto px-4 pb-5 pt-2 sm:px-7 sm:py-5">
                <table className="w-full min-w-[640px] text-sm">
                  <caption className="sr-only">{plan.title}每人每日價格</caption>
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200">
                      <th scope="col" className="py-2 pr-3 text-left font-medium whitespace-nowrap">人數</th>
                      <th scope="col" className="py-2 pr-3 text-left font-medium whitespace-nowrap">車型</th>
                      {TIER_COLUMNS.map(({ tier, label }) => (
                        <th scope="col" key={tier} className="py-2 px-2 text-right font-medium whitespace-nowrap">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PUBLIC_GROUP_SIZES.map((size) => (
                      <tr key={size} className={`border-b border-gray-100 last:border-0 ${size === 4 ? 'border-t-2 border-t-slate-200' : ''}`}>
                        <td className="py-3 pr-3 font-medium text-gray-800 whitespace-nowrap">{size} 人</td>
                        <td className="py-3 pr-3 text-gray-700 whitespace-nowrap">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {size <= 3 ? '轎車' : 'Van'}
                          </span>
                        </td>
                        {TIER_COLUMNS.map(({ tier }) => (
                          <td
                            key={tier}
                            className="py-3 px-2 text-right font-semibold text-gray-950 whitespace-nowrap"
                          >
                            {thb(calcPerPersonDay(tier, size, plan.withGuide))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
            )
          })}
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
          司機與導遊是分開的專業角色；2–18 人皆可依需求選配中文導遊，8 人（含）以上同行建議安排。
        </p>
      </div>

      {/* 親子家庭改看整團總價，不要求爸媽拆算兒童單價 */}
      <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 px-6 py-7 text-center shadow-sm sm:px-8">
        <h3 className="text-xl font-bold text-gray-900">有小朋友？不用自己拆帳</h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-gray-700 sm:text-base">
          嬰幼兒皆佔位，我們會依成人與孩子的年齡組合套用親子優惠，直接提供全家包車總價；
          不需要替大人與小孩分開計算每人要付多少。
        </p>
        <p className="mt-4 font-semibold text-gray-900">
          LINE 詢價請告訴我們：成人幾位＋小孩年齡＋是否需要安全座椅
        </p>
        <p className="mt-2 text-sm text-gray-600">
          兒童安全座椅另加 THB {thb(CHILD_SEAT_FEE_PER_DAY)}／日／張。
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
              <span className="text-gray-700">{CHILD_SEAT_OCCUPANCY_POLICY}</span>
              <span className="font-semibold text-gray-900 whitespace-nowrap">
                THB {thb(CHILD_SEAT_FEE_PER_DAY)}／日／張
              </span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-gray-700">接送機（單趟，無排行程日）</span>
              <span className="font-semibold text-gray-900 whitespace-nowrap">
                轎車 THB {thb(AIRPORT_TRANSFER_FEES.sedan)}／Van THB {thb(AIRPORT_TRANSFER_FEES.van)}
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
              超時費：清邁一日 {CHARTER_OVERTIME_POLICY.chiangMaiHours} 小時、清萊／金三角一日 {CHARTER_OVERTIME_POLICY.chiangRaiGoldenTriangleHours} 小時；基本用車時間用完後，另有 {CHARTER_OVERTIME_POLICY.graceMinutes} 分鐘彈性；
              超過後 THB {thb(CHARTER_OVERTIME_POLICY.feeThbPerHourPerCar)}／小時／台，按台實收，導遊不另收超時費
            </li>
            <li>景點門票、餐食（可代訂另計）</li>
          </ul>
          <p className="text-sm text-gray-500 mt-4">
            每人價已包含：車輛、泰國司機、油費、過路費、停車費與 LINE 中文支援；選配導遊方案另含中文導遊。
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
