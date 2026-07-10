export const PUBLIC_PRICE_RANGE = 'THB 750–3,500／人／日'

export const STANDARD_SERVICE_POLICY =
  '標準服務由泰國司機駕駛，通常不以中文服務；行程事先確認並提供 LINE 中文支援。需要隨車中文溝通或導覽時，中文導遊依需求選配。'

export const PAID_CHILD_SEAT_POLICY =
  '兒童安全座椅為 THB 500／日／張；每位乘客（含嬰幼兒）各佔一席，安全座椅安裝於該乘客座位，不另加算一人。'

export const SITEWIDE_METADATA_DESCRIPTION =
  '清微旅行是台灣爸爸 Eric 與泰國媽媽 Min 經營的清邁親子包車。標準泰國司機、行程事先確認與 LINE 中文支援，中文導遊選配，兒童安全座椅付費加購。'

export const HOME_PUBLIC_COPY = {
  hero: {
    title: '爸媽開的清邁親子包車',
    subtitle: '台灣爸爸 Eric × 泰國媽媽 Min，陪你把親子行程先安排好',
    description: `${STANDARD_SERVICE_POLICY}${PAID_CHILD_SEAT_POLICY}`,
    primaryCta: { text: 'LINE 聊聊你的清邁計畫', link: 'https://line.me/R/ti/p/@037nyuwk' },
    secondaryCta: { text: '看行程案例', link: '/tours' },
  },
  whoWeAre: {
    title: '台泰家庭在地協助，服務內容先說清楚',
    subtitle: '台灣爸爸 Eric × 泰國媽媽 Min',
    description: '我們先依家庭人數與行程配車；標準安排泰國司機，中文導遊依需求選配。',
    trustPoints: [
      { text: '標準泰國司機通常不以中文服務' },
      { text: '行程事先確認，旅途中提供 LINE 中文支援' },
      { text: '需要隨車中文溝通或導覽時，中文導遊依需求選配' },
    ],
  },
  cta: {
    title: '先把你們家的清邁行程聊清楚',
    description: '告訴我們日期、人數與想去的地區，我們會先確認行程，安排標準泰國司機與 LINE 中文支援；需要時再選配中文導遊。',
    primaryCta: { text: 'LINE 聊聊行程', link: 'https://line.me/R/ti/p/@037nyuwk' },
    secondaryCta: { text: '瀏覽服務內容', link: '/services/car-charter' },
  },
  footerDescription:
    '爸媽開的清邁親子包車。標準服務安排泰國司機，行程事先確認並提供 LINE 中文支援；中文導遊依需求選配。',
  testimonialDisclaimer:
    '評價反映各次實際安排；人力配置依方案而異。標準服務為泰國司機，中文導遊依方案選配。',
}
