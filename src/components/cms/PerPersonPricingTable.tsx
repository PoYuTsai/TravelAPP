import {
  Baby,
  Car,
  Clock3,
  Languages,
  MessageCircleMore,
  Plane,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import {
  AIRPORT_TRANSFER_FEES,
  CHILD_SEAT_FEE_PER_DAY,
  INSURANCE_FEE_PER_PERSON,
  LUGGAGE_VAN_FEE,
  calcPerPersonDay,
  type Tier,
} from '@/lib/pricing/perPersonRates'

/** 超時費（不含項，按台實收）THB／小時／台 */
const OVERTIME_FEE_PER_HOUR_PER_CAR = 300

const TIER_COLUMNS: Array<{ tier: Tier; label: string }> = [
  { tier: 'T1', label: '清邁市區' },
  { tier: 'T2', label: '清邁近郊' },
  { tier: 'T3', label: '清萊' },
  { tier: 'T4', label: '金三角' },
]

interface RateTableSpec {
  title: string
  subtitle: string
  withGuide: boolean
  icon: LucideIcon
  accent: string
  iconBackground: string
}

const RATE_TABLES: RateTableSpec[] = [
  {
    title: '泰國司機方案',
    subtitle: '適合已排好景點、需要彈性用車',
    withGuide: false,
    icon: Car,
    accent: 'border-emerald-700',
    iconBackground: 'bg-emerald-50 text-emerald-800',
  },
  {
    title: '中文導遊方案',
    subtitle: '適合第一次來、需要現場溝通與導覽',
    withGuide: true,
    icon: Languages,
    accent: 'border-amber-600',
    iconBackground: 'bg-amber-50 text-amber-800',
  },
]

function thb(amount: number): string {
  return amount.toLocaleString('en-US')
}

function RateTable({ spec }: { spec: RateTableSpec }) {
  const Icon = spec.icon

  return (
    <article className={`overflow-hidden rounded-2xl border border-gray-200 border-t-4 ${spec.accent} bg-white shadow-sm`}>
      <header className="border-b border-gray-100 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${spec.iconBackground}`}>
            <Icon aria-hidden="true" className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-950">{spec.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{spec.subtitle}</p>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
          2–3 人安排轎車；4–9 人安排 Van
        </p>
      </header>

      <div className="overflow-x-auto px-3 pb-4 pt-2 sm:px-5">
        <table className="w-full min-w-[540px] text-sm">
          <caption className="sr-only">
            {spec.title}每人每日參考價，單位為泰銖
          </caption>
          <thead>
            <tr className="border-b border-gray-200 text-gray-600">
              <th scope="col" className="px-2 py-3 text-left font-semibold">總佔位</th>
              {TIER_COLUMNS.map(({ tier, label }) => (
                <th key={tier} scope="col" className="px-2 py-3 text-right font-semibold whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }, (_, index) => index + 2).map((size) => (
              <tr key={size} className="border-b border-gray-100 last:border-0 even:bg-gray-50/70">
                <th scope="row" className="px-2 py-3 text-left font-semibold text-gray-800 whitespace-nowrap">
                  {size} 人
                </th>
                {TIER_COLUMNS.map(({ tier }) => (
                  <td key={tier} className="px-2 py-3 text-right font-bold tabular-nums text-gray-950 whitespace-nowrap">
                    {thb(calcPerPersonDay(tier, size, spec.withGuide))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

interface PerPersonPricingTableProps {
  footnotes?: string[]
}

export default function PerPersonPricingTable({ footnotes }: PerPersonPricingTableProps) {
  const publicFootnotes = footnotes?.filter((note) => !/依法|必配/.test(note))

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 sm:p-7">
        <h3 className="text-xl font-bold text-gray-950">先看懂兩種包車方式</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="flex gap-3">
            <Car aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" />
            <p className="text-sm leading-relaxed text-gray-700">
              標準方案包含車輛、泰國司機、油費、過路費、停車費與 LINE 中文支援。
            </p>
          </div>
          <div className="flex gap-3">
            <Languages aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" />
            <p className="text-sm leading-relaxed text-gray-700">
              需要隨車中文溝通、行程節奏協助或景點導覽時，可選擇中文導遊方案。
            </p>
          </div>
        </div>
        <div className="mt-5 border-t border-amber-200 pt-4 text-sm leading-relaxed text-gray-700">
          <p>
            價格依旅行日期、總佔位人數、每天路線與是否選配中文導遊計算，統一以泰銖 THB 正式報價。
          </p>
          <p className="mt-2 font-semibold text-gray-900">成人、兒童與嬰幼兒都需要計入座位。</p>
        </div>
      </section>

      <section aria-labelledby="daily-rate-title">
        <div className="mb-5 text-center">
          <h3 id="daily-rate-title" className="text-xl font-bold text-gray-950">成人同行參考價</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            單位：THB／人／日；依同行總佔位查同一列
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {RATE_TABLES.map((spec) => <RateTable key={spec.title} spec={spec} />)}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-700">
            <strong className="block text-gray-950">2–3 人也可以</strong>
            2–3 人也可選配中文導遊，長途或行李較多時會評估升級 Van。
          </p>
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-700">
            <strong className="block text-gray-950">8 人以上</strong>
            8 人（含）以上建議安排中文導遊，方便現場溝通與團體節奏。
          </p>
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-700">
            <strong className="block text-gray-950">10 人以上</strong>
            10 人以上請直接詢問整團報價，我們會依車輛與行李數量安排。
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <UsersRound aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-sky-800" />
          <div>
            <h3 className="text-lg font-bold text-gray-950">有小朋友不用自己折算</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">
              告訴我們幾大幾小與每位孩子的年齡，我們會依實際座位與行程直接提供全家總價。
              對外報價不需要家長自己拆成人、兒童或嬰兒費用。
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-950">
            <ShieldCheck aria-hidden="true" className="h-5 w-5 text-emerald-700" />
            加購項目
          </h3>
          <ul className="mt-4 space-y-4 text-sm">
            <li className="flex items-start justify-between gap-4">
              <span className="leading-relaxed text-gray-700">旅遊保險（自由加購，投保時嬰兒也投保）</span>
              <span className="shrink-0 font-semibold text-gray-950">THB {thb(INSURANCE_FEE_PER_PERSON)}／人／趟</span>
            </li>
            <li className="flex items-start justify-between gap-4">
              <span className="flex items-start gap-2 leading-relaxed text-gray-700">
                <Baby aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                0–2 歲嬰幼兒安全座椅
              </span>
              <span className="shrink-0 font-semibold text-gray-950">THB {thb(CHILD_SEAT_FEE_PER_DAY)}／日／張</span>
            </li>
            <li className="flex items-start justify-between gap-4">
              <span className="flex items-start gap-2 leading-relaxed text-gray-700">
                <Plane aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                純接送機單趟
              </span>
              <span className="shrink-0 text-right font-semibold text-gray-950">
                轎車 {thb(AIRPORT_TRANSFER_FEES.sedan)}／Van {thb(AIRPORT_TRANSFER_FEES.van)}
              </span>
            </li>
            <li className="flex items-start justify-between gap-4">
              <span className="leading-relaxed text-gray-700">
                接送機每台載客達 7 位，需先確認大件行李與嬰兒車數量
              </span>
              <span className="shrink-0 text-right font-semibold text-gray-950">
                確認需要後<br />THB {thb(LUGGAGE_VAN_FEE)}／台／趟
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-950">
            <Clock3 aria-hidden="true" className="h-5 w-5 text-amber-700" />
            用車時間與費用不含
          </h3>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-gray-700">
            <li>清邁市區／近郊：10 小時；清萊／金三角：12 小時。</li>
            <li>
              基本時數結束後另有 30 分鐘彈性；超過後 THB {thb(OVERTIME_FEE_PER_HOUR_PER_CAR)}／小時／台，中文導遊不另收超時費。
            </li>
            <li>景點門票與餐食另計；安排中文導遊時，可由導遊協助現場處理。</li>
          </ul>
          <p className="mt-4 border-t border-gray-100 pt-4 text-sm leading-relaxed text-gray-600">
            每人價已包含車輛、泰國司機、油費、過路費、停車費與 LINE 中文支援；中文導遊方案另含中文導遊服務。
          </p>
        </div>
      </section>

      <section className="rounded-2xl bg-gray-950 p-6 text-white sm:p-7">
        <div className="flex items-start gap-3">
          <MessageCircleMore aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" />
          <div>
            <h3 className="text-lg font-bold">想直接詢價，請傳給我們</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-200">
              旅行日期＋幾大幾小與年齡＋想去的地方＋中文導遊需要／不需要／想比較＋安全座椅、大件行李與嬰兒車數量。
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-1 text-sm leading-relaxed text-gray-600">
        <p>* 上方為全成人同行的每人每日參考價；有小朋友時以正式全家總價為準。</p>
        <p>* 連續包車 3 日以上另有長包優惠；清萊、金三角多日行程如需司導過夜，會一併列入正式報價。</p>
        {publicFootnotes?.map((note, index) => <p key={index}>* {note}</p>)}
      </div>
    </div>
  )
}
