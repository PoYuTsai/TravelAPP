import { calcPerPersonDay } from './perPersonRates'
import { PAID_CHILD_SEAT_POLICY } from '@/lib/home-public-copy'
import { CHARTER_OVERTIME_POLICY } from './publicPolicy'

export interface CarCharterPublicFeature {
  icon?: string
  title: string
  description: string
}

export interface CarCharterPublicFaq {
  question: string
  answer: string
}

const cityDayFromThb = calcPerPersonDay('T1', 9, false)
const chiangRaiDayFromThb = calcPerPersonDay('T3', 9, false)

/**
 * Public service promises are code-owned so stale Sanity content cannot restore
 * old driver, guide, or child-seat claims.
 */
export const CAR_CHARTER_PUBLIC_COPY = {
  startingPrices: {
    cityDayFromThb,
    chiangRaiDayFromThb,
  },
  metadata: {
    title: '清邁親子包車｜泰國司機、LINE 中文支援、中文導遊選配｜清微旅行',
    description: `清微旅行的清邁親子包車，標準安排為泰國司機，行程先確認並提供 LINE 中文支援；需要隨車中文溝通或導覽時，中文導遊可選配。兒童安全座椅付費加購。清邁市區每人每日 THB ${cityDayFromThb} 起、清萊每人每日 THB ${chiangRaiDayFromThb.toLocaleString('en-US')} 起，依同行人數與區域正式報價。`,
    socialDescription: `清微旅行的清邁親子包車：標準泰國司機、LINE 中文支援，中文導遊可選配，兒童安全座椅付費加購。清邁市區每人每日 THB ${cityDayFromThb} 起。`,
  },
  heroTitle: '清邁親子包車服務',
  heroSubtitle:
    '清微旅行的清邁親子包車，標準安排為泰國司機；行程會先確認，旅途中提供 LINE 中文支援。\n需要隨車中文溝通或導覽時，中文導遊可選配。',
  heroCtaText: 'LINE 聊聊你的行程',
  heroCtaLink: 'https://line.me/R/ti/p/@037nyuwk',
  pricingSectionTitle: '包車價格參考',
  pricingFootnotes: [] as string[],
  features: [
    {
      icon: '🚐',
      title: '標準泰國司機',
      description: '由專業泰國司機專心駕駛；司機通常不以中文服務。',
    },
    {
      icon: '💬',
      title: 'LINE 中文支援',
      description: '出發前確認行程，旅途中可透過 LINE 取得中文協助。',
    },
    {
      icon: '🧭',
      title: '中文導遊選配',
      description: '需要隨車中文溝通、景點導覽或親子照顧時，可另加聘中文導遊。',
    },
    {
      icon: '🧒',
      title: '兒童安全座椅付費加購',
      description: `${PAID_CHILD_SEAT_POLICY}請事先提供孩子年齡與體重。`,
    },
    {
      icon: '🧳',
      title: '親子友善車輛',
      description: '依人數安排轎車或 Van，預留行李、嬰兒車與安全座椅空間。',
    },
    {
      icon: '🗓️',
      title: '彈性客製行程',
      description: '依孩子年齡、興趣與體力安排節奏，不趕路。',
    },
  ] satisfies CarCharterPublicFeature[],
  faq: [
    {
      question: '價格包含什麼？',
      answer:
        '標準方案包含車輛、泰國司機、油資、過路費、停車費與 LINE 中文支援；只有選配中文導遊的方案才包含導遊。景點門票、餐食、超時費與兒童安全座椅另計。',
    },
    {
      question: '司機會說中文嗎？',
      answer:
        '標準安排的泰國司機通常不以中文服務。行程會先確認，旅途中提供 LINE 中文支援；需要隨車中文溝通或導覽時，才安排中文導遊。',
    },
    {
      question: '中文導遊一定要加嗎？',
      answer:
        '不一定，2–18 人皆可選配。2–3 人為轎車方案；3 人加導遊時，一般 5 人座剛好滿座，座位、安全座椅、行李較多或舒適度需求會由調度確認車型。10–18 人安排兩台 Van 時，選配導遊由兩台車共用一位。19 人以上請由 LINE 人工確認。',
    },
    {
      question: '超時怎麼計算？',
      answer: `清邁一日用車 ${CHARTER_OVERTIME_POLICY.chiangMaiHours} 小時、清萊與金三角一日 ${CHARTER_OVERTIME_POLICY.chiangRaiGoldenTriangleHours} 小時；基本用車時間用完後，另有 ${CHARTER_OVERTIME_POLICY.graceMinutes} 分鐘彈性。超過後，超時費為 THB ${CHARTER_OVERTIME_POLICY.feeThbPerHourPerCar}／小時／台，按台計收；中文導遊不另收超時費。`,
    },
    {
      question: '可以帶嬰兒車嗎？',
      answer: '可以。請事先告知嬰兒車與行李數量，我們會依總座位與行李空間確認合適車型。',
    },
    {
      question: '安全座椅怎麼安排？',
      answer: `${PAID_CHILD_SEAT_POLICY}付費加購，請事先提供孩子年齡與體重。`,
    },
    {
      question: '可以客製行程嗎？',
      answer: '可以。告訴我們想去的地方、孩子年齡與旅行節奏，我們會協助規劃適合全家的行程。',
    },
    {
      question: '怎麼預訂？',
      answer: '透過 LINE 提供日期、人數、孩子年齡與想去的地點，確認行程與正式報價後即可付訂金預訂。',
    },
  ] satisfies CarCharterPublicFaq[],
  serviceSchemaDescription:
    '清微旅行提供清邁親子包車；標準安排泰國司機與 LINE 中文支援，中文導遊選配，兒童安全座椅付費加購，行程可依親子需求調整。',
  sectionIds: {
    pricing: 'pricing',
    faq: 'faq',
  },
}
