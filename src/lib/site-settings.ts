import {
  HOME_PUBLIC_COPY,
  PUBLIC_PRICE_RANGE,
  SITEWIDE_METADATA_DESCRIPTION,
} from '@/lib/home-public-copy'

export type TestimonialSource = 'facebook' | 'google'
export type TrustMetric = 'families' | 'reviews' | 'brand'

export interface HomeFaqItem {
  question: string
  answer: string
}

export interface SiteTestimonial {
  name: string
  location?: string
  kids?: string
  content: string
  highlight: string
  source?: TestimonialSource
}

export interface SiteTrustCard {
  metric: TrustMetric
  title: string
  description: string
  href: string
  external?: boolean
  valueOverride?: string
}

export interface SiteTrustSection {
  eyebrow: string
  title: string
  description: string
  cards: SiteTrustCard[]
}

export interface SiteFooterSettings {
  description: string
  addressText: string
  addressUrl: string
  taiwanPhone: string
  taiwanPhoneLabel: string
  thailandPhone: string
  thailandPhoneLabel: string
}

export interface SiteAuthorProfile {
  eyebrow: string
  imageAlt: string
  name: string
  description: string
  serviceLabel: string
  serviceValue: string
  summary: string
  primaryCtaText: string
  secondaryCtaText: string
}

export interface SiteSettings {
  businessName: string
  description: string
  telephone: string
  email: string
  priceRange: string
  areaServed: string
  socialLinks: {
    line: string
    facebook: string
    instagram: string
    tiktok: string
  }
  aggregateRating: {
    ratingValue: number
    reviewCount: number
  }
  footer: SiteFooterSettings
  authorProfile: SiteAuthorProfile
  trustSection: SiteTrustSection
  homeFaq: HomeFaqItem[]
  homeTestimonials: SiteTestimonial[]
}

export type SiteSettingsInput = Partial<SiteSettings> | null | undefined

export const siteSettingsQuery = `*[_type == "siteSettings"][0]{
  businessName,
  telephone,
  email,
  areaServed,
  socialLinks,
  aggregateRating,
  footer{
    addressText,
    addressUrl,
    taiwanPhone,
    taiwanPhoneLabel,
    thailandPhone,
    thailandPhoneLabel
  },
  authorProfile{
    eyebrow,
    imageAlt,
    name,
    summary,
    primaryCtaText,
    secondaryCtaText
  },
  trustSection{
    eyebrow,
    title,
    description,
    cards[]{
      metric,
      title,
      description,
      href,
      external,
      valueOverride
    }
  },
  homeTestimonials[]{
    name,
    location,
    kids,
    content,
    highlight,
    source
  }
}`

export const defaultSiteSettings: SiteSettings = {
  businessName: '清微旅行 Chiangway Travel',
  description: SITEWIDE_METADATA_DESCRIPTION,
  telephone: '+66-63-790-0666',
  email: 'eric19921204@gmail.com',
  priceRange: PUBLIC_PRICE_RANGE,
  areaServed: 'Chiang Mai',
  socialLinks: {
    line: 'https://line.me/R/ti/p/@037nyuwk',
    facebook: 'https://www.facebook.com/profile.php?id=61569067776768',
    instagram: 'https://www.instagram.com/chiangway_travel',
    tiktok: 'https://www.tiktok.com/@chiangway_travel',
  },
  aggregateRating: {
    ratingValue: 5,
    reviewCount: 110,
  },
  footer: {
    description: HOME_PUBLIC_COPY.footerDescription,
    addressText: '444, Wiang, Fang District, Chiang Mai 50110',
    addressUrl: 'https://share.google/p6anNFwTvi9Sc7JAt',
    taiwanPhone: '+886 987-591-322',
    taiwanPhoneLabel: '台灣',
    thailandPhone: '+66 63-790-0666',
    thailandPhoneLabel: '泰國',
  },
  authorProfile: {
    eyebrow: 'About Chiangway',
    imageAlt: 'Eric 與 Min，清微旅行在地家庭團隊',
    name: 'Eric & Min',
    description: '清微旅行由台灣爸爸 Eric 與泰國媽媽 Min 在地經營；標準泰國司機與 LINE 中文支援，中文導遊依需求選配。',
    serviceLabel: '服務方式',
    serviceValue: '標準泰國司機｜中文導遊選配',
    summary: '文章內容會從親子旅行、交通、景點與在地生活角度出發，幫你把清邁自由行需要的資訊先整理順。',
    primaryCtaText: 'LINE 詢問清邁行程',
    secondaryCtaText: '看行程案例',
  },
  trustSection: {
    eyebrow: '先看可被驗證的信任感',
    title: '不用先相信廣告文案',
    description: '先看公開評價、真實家庭出發紀錄，以及我們是怎麼把這趟旅程顧好的。',
    cards: [
      {
        metric: 'families',
        title: '真實行程案例',
        description: '不是展示漂亮文案而已，而是真的有家庭實際出發、留下旅程紀錄。',
        href: '/tours',
      },
      {
        metric: 'reviews',
        title: 'Google 公開評價',
        description: '先看公開平台上的真實回饋，再決定這樣的服務方式適不適合你們家。',
        href: 'https://maps.app.goo.gl/8MbRV4PPBggwj2pF6',
        external: true,
      },
      {
        metric: 'brand',
        title: '在地台泰家庭',
        description: '不是轉單業者，而是住在清邁、理解親子節奏的家庭自己接手服務。',
        href: '/homestay',
        valueOverride: 'Eric + Min',
      },
    ],
  },
  homeFaq: [
    {
      question: '清微旅行的包車服務在哪裡接送？需要自行前往集合點嗎？',
      answer: '清微旅行提供飯店門口接送服務，不需要自行前往集合點，詳細接送地點可透過 LINE 免費諮詢確認。',
    },
    {
      question: '標準包車怎麼安排司機、中文支援與導遊？',
      answer: '標準服務安排泰國司機，通常不以中文服務；行程事先確認並提供 LINE 中文支援。需要隨車中文溝通或導覽時，可依需求選配中文導遊，司機與導遊是不同的專業角色。',
    },
    {
      question: '清邁一日親子包車的費用是多少？如何預訂？',
      answer: '目前公開包車價格依總佔位人數與行程區域計算；每位乘客（含嬰幼兒）各佔一席。每人每日 THB 750–3,500；車輛、泰國司機、油資、過路費、停車費與 LINE 中文支援已含，正式報價依行程與人數確認。',
    },
    {
      question: '清微旅行有提供兒童汽車座椅嗎？',
      answer: '有，可付費加購兒童安全座椅，費用為 THB 500／日／張，且佔一個座位。每位乘客（含嬰幼兒）各佔一席；安全座椅安裝於該乘客座位，不另加算一人，但需納入車內座位配置。請提前告知兒童年齡與體重。',
    },
    {
      question: '第一次帶孩子去清邁，清微旅行推薦哪些景點或行程？',
      answer: '清微推薦的親子 TOP 景點包括：夜間動物園、大象互動體驗、豬豬農場、水上樂園、3D 美術館等，分為動物互動、戶外放電、室內雨備三類，可參考官網旅遊攻略，或直接 LINE 諮詢客製行程。',
    },
    {
      question: '清微旅行是否有提供多天行程？可以包幾天？',
      answer: '可以，清微旅行提供多天包車行程，例如 6 天 5 夜清邁親子經典遊或 7 天 6 夜泰北深度遊（含金三角、芳縣民宿）。天數和行程均可客製討論。',
    },
    {
      question: '清微旅行和一般旅行社或當地包車相比，有什麼優勢？',
      answer: '清微最大優勢是「在地家庭身分」：台泰家庭本身住在清邁，可透過 LINE 提供中文支援並協助事先安排親子節奏。標準安排泰國司機；需要隨車中文溝通或導覽時，再依需求選配中文導遊。',
    },
    {
      question: '如何與清微旅行聯繫？行前諮詢需要費用嗎？',
      answer: '完全免費。直接點選官網的「LINE 免費諮詢」按鈕加入 LINE 即可，與 Eric 討論行程安排、詢問景點建議，餐廳訂位也可代勞，確認後再付款預訂。',
    },
  ],
  homeTestimonials: [
    {
      name: '魏文陽',
      location: '台灣',
      content: '第一次安排清邁自由行～行程排好後發現有幾天行程較遠需要包車上網找到微清旅行～包車含油12小時價格算偏高一點點，但有問題詢問老闆阿裕都能即時回覆親切，很快就敲定時間預約，安排去清萊的導遊郭姐也很熱情介紹當地文化景點，想要朝聖的餐廳訂位也可幫忙預訂，因為是自己安排的行程第一次造訪有些景點時間沒抓好較可惜停留時間不夠，基本上都蠻彈性的可以討論，老闆也會有建議的方向想法，有機會再次深度造訪清邁！！',
      highlight: '即時回覆，彈性討論',
      source: 'google',
    },
    {
      name: 'Lu Lu',
      location: '台灣',
      content: '可以提供中文溝通、服務貼心，更棒的是有提供汽車座椅，這個服務在清邁少有。',
      highlight: '有提供汽車座椅',
      source: 'google',
    },
    {
      name: 'Tsai Wei Wei',
      location: '台灣',
      content: '這次清邁郊區有包車三天，都開車大概一小時可到，第一天司機大哥人很好，雖然語言不通但很努力用翻譯跟我們溝通，開車也很小心謹慎。二、三天是開朗活潑會講中文的J導遊小姐帶我們遊玩，除了事前規劃的行程，中間有想去哪，J導遊都會給我們建議和安排，也很自由的帶我們去。這趟清邁旅遊真的是很美好😊',
      highlight: '導遊開朗活潑，行程自由',
      source: 'google',
    },
    {
      name: '王薪驊',
      location: '台灣',
      content: '地陪跟司機人都超好的，親力親為，也超有耐心，真心推薦！',
      highlight: '親力親為，超有耐心',
      source: 'facebook',
    },
    {
      name: 'Feather Chin',
      location: '台灣',
      content: '值得推薦的包車旅遊～地陪親力親為～很貼心和很棒～如果下次朋友要來玩一定會推薦你們家的包車行程。',
      highlight: '值得推薦，很貼心',
      source: 'facebook',
    },
    {
      name: 'Vicky Lin',
      location: '台灣',
      content: '從行前的討論安排，都很細心，都能中文溝通完全不用擔心，還有中文解說的導遊，很盡責喔！全程陪伴走完解說不會到點了就把大家放生，超nice，推推～',
      highlight: '中文溝通完全不用擔心',
      source: 'facebook',
    },
  ],
}

export function extractLineHandle(lineUrl: string) {
  const match = lineUrl.match(/\/(@[^/?]+)/)
  return match?.[1] || '@037nyuwk'
}

export function buildLineOaMessageBaseUrl(lineUrl: string) {
  return `https://line.me/R/oaMessage/${extractLineHandle(lineUrl)}/?`
}

export function buildFacebookReviewsUrl(facebookUrl: string) {
  if (!facebookUrl) {
    return 'https://www.facebook.com/profile.php?id=61569067776768&sk=reviews'
  }

  if (facebookUrl.includes('sk=reviews')) {
    return facebookUrl
  }

  return `${facebookUrl}${facebookUrl.includes('?') ? '&' : '?'}sk=reviews`
}

const VALID_TRUST_METRICS: TrustMetric[] = ['families', 'reviews', 'brand']

function isValidTrustMetric(metric: string | undefined): metric is TrustMetric {
  return Boolean(metric && VALID_TRUST_METRICS.includes(metric as TrustMetric))
}

function normalizeTestimonials(items: SiteTestimonial[] | undefined) {
  if (!items?.length) {
    return defaultSiteSettings.homeTestimonials
  }

  const normalized = items.filter(
    (item): item is SiteTestimonial =>
      Boolean(item?.name?.trim()) &&
      Boolean(item?.content?.trim()) &&
      Boolean(item?.highlight?.trim())
  )

  return normalized.length > 0 ? normalized : defaultSiteSettings.homeTestimonials
}

function mergeFooterSettings(input: SiteFooterSettings | undefined): SiteFooterSettings {
  return {
    description: defaultSiteSettings.footer.description,
    addressText: input?.addressText?.trim() || defaultSiteSettings.footer.addressText,
    addressUrl: input?.addressUrl?.trim() || defaultSiteSettings.footer.addressUrl,
    taiwanPhone: input?.taiwanPhone?.trim() || defaultSiteSettings.footer.taiwanPhone,
    taiwanPhoneLabel:
      input?.taiwanPhoneLabel?.trim() || defaultSiteSettings.footer.taiwanPhoneLabel,
    thailandPhone: input?.thailandPhone?.trim() || defaultSiteSettings.footer.thailandPhone,
    thailandPhoneLabel:
      input?.thailandPhoneLabel?.trim() || defaultSiteSettings.footer.thailandPhoneLabel,
  }
}

function mergeAuthorProfile(input: SiteAuthorProfile | undefined): SiteAuthorProfile {
  return {
    eyebrow: input?.eyebrow?.trim() || defaultSiteSettings.authorProfile.eyebrow,
    imageAlt: input?.imageAlt?.trim() || defaultSiteSettings.authorProfile.imageAlt,
    name: input?.name?.trim() || defaultSiteSettings.authorProfile.name,
    description: defaultSiteSettings.authorProfile.description,
    serviceLabel: defaultSiteSettings.authorProfile.serviceLabel,
    serviceValue: defaultSiteSettings.authorProfile.serviceValue,
    summary: input?.summary?.trim() || defaultSiteSettings.authorProfile.summary,
    primaryCtaText:
      input?.primaryCtaText?.trim() || defaultSiteSettings.authorProfile.primaryCtaText,
    secondaryCtaText:
      input?.secondaryCtaText?.trim() || defaultSiteSettings.authorProfile.secondaryCtaText,
  }
}

function normalizeTrustCards(items: SiteTrustCard[] | undefined) {
  if (!items?.length) {
    return defaultSiteSettings.trustSection.cards
  }

  const normalized = items
    .filter(
      (item): item is SiteTrustCard =>
        isValidTrustMetric(item?.metric) &&
        Boolean(item?.title?.trim()) &&
        Boolean(item?.description?.trim()) &&
        Boolean(item?.href?.trim())
    )
    .map((item) => ({
      metric: item.metric,
      title: item.title.trim(),
      description: item.description.trim(),
      href: item.href.trim(),
      external: Boolean(item.external),
      valueOverride: item.valueOverride?.trim() || undefined,
    }))

  return normalized.length > 0 ? normalized : defaultSiteSettings.trustSection.cards
}

export function mergeSiteSettings(input: SiteSettingsInput): SiteSettings {
  return {
    businessName: input?.businessName?.trim() || defaultSiteSettings.businessName,
    description: defaultSiteSettings.description,
    telephone: input?.telephone?.trim() || defaultSiteSettings.telephone,
    email: input?.email?.trim() || defaultSiteSettings.email,
    priceRange: defaultSiteSettings.priceRange,
    areaServed: input?.areaServed?.trim() || defaultSiteSettings.areaServed,
    socialLinks: {
      line: input?.socialLinks?.line?.trim() || defaultSiteSettings.socialLinks.line,
      facebook: input?.socialLinks?.facebook?.trim() || defaultSiteSettings.socialLinks.facebook,
      instagram: input?.socialLinks?.instagram?.trim() || defaultSiteSettings.socialLinks.instagram,
      tiktok: input?.socialLinks?.tiktok?.trim() || defaultSiteSettings.socialLinks.tiktok,
    },
    aggregateRating: {
      ratingValue: input?.aggregateRating?.ratingValue || defaultSiteSettings.aggregateRating.ratingValue,
      reviewCount: input?.aggregateRating?.reviewCount || defaultSiteSettings.aggregateRating.reviewCount,
    },
    footer: mergeFooterSettings(input?.footer),
    authorProfile: mergeAuthorProfile(input?.authorProfile),
    trustSection: {
      eyebrow: input?.trustSection?.eyebrow?.trim() || defaultSiteSettings.trustSection.eyebrow,
      title: input?.trustSection?.title?.trim() || defaultSiteSettings.trustSection.title,
      description:
        input?.trustSection?.description?.trim() || defaultSiteSettings.trustSection.description,
      cards: normalizeTrustCards(input?.trustSection?.cards),
    },
    homeFaq: defaultSiteSettings.homeFaq,
    homeTestimonials: normalizeTestimonials(input?.homeTestimonials),
  }
}
