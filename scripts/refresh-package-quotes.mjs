import { createClient } from '@sanity/client'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const SLUGS = ['k8oeyepp', 'uao33058', 'lyx5aysy']
const APPLY = process.argv.includes('--apply')
const EXCHANGE_RATE = 1

const moneyItem = (label, quantity, unitPriceThb) => ({
  label,
  amountTHB: quantity * unitPriceThb,
  amountTWD: Math.round((quantity * unitPriceThb) / EXCHANGE_RATE),
  description: `${quantity} 位 × ${unitPriceThb.toLocaleString('en-US')}`,
})

const commonExcluded = [
  '餐食',
  '景點門票／活動費',
  '旅遊保險（自由加購 THB 100／人／趟）',
  '0–2 歲嬰幼兒安全座椅（THB 500／日／張）',
  '機票',
  '個人消費與司機導遊小費',
]

const packageConfigs = {
  k8oeyepp: {
    packagePricingId: 'chiang-mai-5d4n',
    adults: 4,
    children: 2,
    infants: 0,
    travelerLabel: '4 大 2 小（3–11 歲）',
    totalTHB: 33_600,
    luggageCarCount: 0,
    includeAccommodation: false,
    hotels: [],
    outboundStay: { enabled: false, perNight: 750, nights: 0, rooms: 0 },
    days: [
      { name: '接機＋清邁市區慢遊', type: 'city' },
      { name: '大象互動＋黏黏瀑布', type: 'suburban' },
      { name: '水上樂園＋夜間動物園', type: 'suburban' },
      { name: '湄林親子活動', type: 'suburban' },
      { name: '單趟送機', type: 'airport' },
    ],
    fallbackCarFees: [
      { day: 'D1', date: '', cost: 2_700, price: 4_000 },
      { day: 'D2', date: '', cost: 3_300, price: 4_600 },
      { day: 'D3', date: '', cost: 3_300, price: 4_000 },
      { day: 'D4', date: '', cost: 3_300, price: 4_300 },
      { day: 'D5', date: '', cost: 500, price: 700 },
    ],
    itineraryText: `Day 1｜接機＋清邁市區慢遊
・機場接機（實際時間依航班調整）
・清邁市區午餐
・古城、寺廟或親子體驗，依抵達時間安排
・飯店入住與晚餐

Day 2｜大象互動＋黏黏瀑布
・大象保護營親子互動
・營區周邊午餐
・黏黏瀑布
・返回清邁市區

Day 3｜水上樂園＋夜間動物園
・清邁大峽谷水上樂園
・園區或周邊午餐
・親子文創景點
・清邁夜間動物園

Day 4｜湄林親子活動
・湄林親子戶外體驗
・湄林午餐
・親子動物或自然景點
・市區採買

Day 5｜單趟送機
・依航班時間安排飯店出發
・單趟送至清邁機場`,
    items: [moneyItem('成人', 4, 6_000), moneyItem('3–11 歲兒童', 2, 4_800)],
    included: [
      '車輛、泰國司機、油費、過路費與停車費',
      '中文導遊（Day 1–4）',
      'Day 1 接機＋市區旅遊',
      'Day 5 單趟送機',
      'LINE 中文支援',
    ],
    excluded: [
      '客人住宿',
      ...commonExcluded,
      '接送機行李車（8–9 人或 15–18 人固定 THB 500／台／趟；本試算 6 人不適用）',
    ],
  },
  uao33058: {
    packagePricingId: 'chiang-rai-2d1n',
    adults: 3,
    children: 0,
    infants: 0,
    travelerLabel: '3 位成人',
    totalTHB: 19_800,
    luggageCarCount: 0,
    includeAccommodation: false,
    hotels: [],
    outboundStay: { enabled: true, perNight: 750, nights: 1, rooms: 2 },
    days: [
      { name: '清邁→清萊市區', type: 'chiangrai' },
      { name: '清萊市區→清邁', type: 'chiangrai' },
    ],
    fallbackCarFees: [
      { day: 'D1', date: '', cost: 3_300, price: 5_300 },
      { day: 'D2', date: '', cost: 3_300, price: 5_300 },
    ],
    itineraryText: `Day 1｜清邁出發・清萊市區
・清邁飯店出發
・途中休息站
・清萊特色咖啡廳或午餐
・藍廟與清萊市區景點
・送至客人自行預訂的清萊飯店

Day 2｜清萊景點・返回清邁
・客人飯店出發
・黑屋博物館
・清萊午餐
・白廟
・返回清邁飯店`,
    items: [moneyItem('成人', 3, 6_600)],
    included: [
      '兩天清萊包車',
      '泰國司機、油費、過路費與停車費',
      '中文導遊（兩天）',
      '司機與導遊清萊外宿一晚',
      'LINE 中文支援',
    ],
    excluded: ['客人住宿', ...commonExcluded],
  },
  lyx5aysy: {
    packagePricingId: 'northern-thailand-6d5n',
    adults: 7,
    children: 1,
    infants: 0,
    travelerLabel: '7 大 1 小（3–11 歲）',
    totalTHB: 56_950,
    luggageCarCount: 1,
    includeAccommodation: true,
    hotels: [
      {
        id: 1,
        name: '芳縣自家民宿（雙床／大床依需求與房況）',
        nights: 1,
        startNight: 1,
        includeInQuote: true,
        hasDeposit: false,
        depositPerRoom: 0,
        rooms: {
          double: [],
          twin: [
            {
              name: '雙床／大床（依需求與房況）',
              quantity: 4,
              price: 1_500,
              hasExtraBed: false,
            },
          ],
          triple: [],
          family: [],
        },
      },
    ],
    outboundStay: { enabled: true, perNight: 750, nights: 1, rooms: 2 },
    days: [
      { name: '接機→清道→芳縣', type: 'chiangrai' },
      { name: '芳縣→金三角', type: 'goldentriangle' },
      { name: '清萊→清邁', type: 'chiangrai' },
      { name: '茵他儂國家公園', type: 'suburban' },
      { name: '南邦一日', type: 'suburban' },
      { name: '單趟送機', type: 'airport' },
    ],
    fallbackCarFees: [
      { day: 'D1', date: '', cost: 4_000, price: 4_800 },
      { day: 'D2', date: '', cost: 4_500, price: 6_600 },
      { day: 'D3', date: '', cost: 3_800, price: 4_800 },
      { day: 'D4', date: '', cost: 3_500, price: 4_800 },
      { day: 'D5', date: '', cost: 3_500, price: 4_800 },
      { day: 'D6', date: '', cost: 500, price: 700 },
    ],
    itineraryText: `Day 1｜接機・清道・芳縣
・清邁機場接機（實際時間依航班調整）
・清道午餐或沿途休息
・清道親子景點
・前往芳縣
・住宿：芳縣自家民宿（雙床／大床依需求與房況）

Day 2｜芳縣・金三角・清萊
・芳縣出發
・茶園或沿途景點
・美塞／清盛周邊
・金三角與湄公河景觀
・前往客人自行預訂的清萊飯店

Day 3｜清萊・返回清邁
・客人清萊飯店出發
・清萊代表景點
・途中午餐與休息
・返回清邁飯店

Day 4｜茵他儂國家公園
・茵他儂主峰與雙塔
・山區社區與午餐
・瀑布或親子自然景點
・返回清邁

Day 5｜南邦一日
・清邁飯店出發
・南邦馬車或老城體驗
・南邦午餐
・南邦代表寺廟與在地景點
・返回清邁

Day 6｜單趟送機
・依航班時間安排飯店出發
・單趟送至清邁機場`,
    items: [
      moneyItem('成人', 7, 6_400),
      moneyItem('3–11 歲兒童', 1, 5_150),
      {
        label: '芳縣民宿（第一晚）',
        amountTHB: 6_000,
        amountTWD: Math.round(6_000 / EXCHANGE_RATE),
        description: '4 間 × THB 1,500',
      },
      {
        label: '接送機行李車',
        amountTHB: 1_000,
        amountTWD: Math.round(1_000 / EXCHANGE_RATE),
        description: '接機＋送機共 2 趟 × THB 500',
      },
    ],
    included: [
      'Day 1–5 完整包車',
      '泰國司機、油費、過路費與停車費',
      '中文導遊（Day 1–5）',
      'Day 6 單趟送機',
      '接機與送機行李車（各 1 趟）',
      '芳縣自家民宿（第一晚，基本兩人一房）',
      '司機與導遊清萊外宿一晚',
      'LINE 中文支援',
    ],
    excluded: [
      '其餘客人住宿（4 晚，自行預訂）',
      ...commonExcluded,
    ],
  },
}

function buildUpdatedPayload(rawPayload, config) {
  const saved = JSON.parse(rawPayload)
  const data = saved.data ?? saved
  const people = config.adults + config.children + config.infants

  Object.assign(data, {
    people,
    adults: config.adults,
    children: config.children,
    infants: config.infants,
    travelerLabel: config.travelerLabel,
    itineraryText: config.itineraryText,
    exchangeRate: EXCHANGE_RATE,
    includeAccommodation: config.includeAccommodation,
    includeMeals: false,
    includeInsurance: false,
    includeGuide: true,
    luggageCar: config.luggageCarCount > 0,
    luggageCarCount: config.luggageCarCount,
    childSeatCount: 0,
    babySeatCount: 0,
    includeTickets: false,
    publicPageMode: 'package',
    packagePricingId: config.packagePricingId,
    hotels: config.hotels,
    outboundStayEnabled: config.outboundStay.enabled,
    outboundStayPerNight: config.outboundStay.perNight,
    outboundStayNights: config.outboundStay.nights,
    outboundStayRooms: config.outboundStay.rooms,
    parsedItinerary: [],
    parseResult: null,
    parseWarnings: [],
    isParseConfirmed: false,
    savedParsedTickets: [],
  })

  const sourceCarFees =
    Array.isArray(data.carFees) && data.carFees.length === config.days.length
      ? data.carFees
      : config.fallbackCarFees

  if (!Array.isArray(sourceCarFees) || sourceCarFees.length !== config.days.length) {
    throw new Error(`Unable to recover carFees: expected ${config.days.length}`)
  }

  data.carFees = sourceCarFees.map((day, index) => ({
    ...day,
    name: config.days[index].name,
    type: config.days[index].type,
  }))

  data._quoteSnapshot = {
    pricingModel: 'perPerson',
    externalQuote: {
      items: config.items,
      included: config.included,
      excluded: config.excluded,
      paymentNotes: ['本頁為套餐參考試算，實際內容與總價以 LINE 正式報價為準。'],
      totalTHB: config.totalTHB,
      totalTWD: Math.round(config.totalTHB / EXCHANGE_RATE),
    },
    collectDeposit: false,
    hotelsWithDeposit: [],
    totalDeposit: 0,
    carCount: people >= 10 ? 2 : 1,
    travelerLabel: config.travelerLabel,
  }
  data.packageCopy = {
    included: [...config.included],
    excluded: [...config.excluded],
    paymentNotes: ['正式報價依旅行日期與確認內容為準，請於 LINE 確認後保留名額。'],
  }

  if (saved.data) {
    saved.data = data
    saved.updatedAt = new Date().toISOString()
  }

  return JSON.stringify(saved)
}

function summarize(payload) {
  const saved = JSON.parse(payload)
  const data = saved.data ?? saved
  return {
    packagePricingId: data.packagePricingId,
    travelerLabel: data.travelerLabel,
    totalTHB: data._quoteSnapshot?.externalQuote?.totalTHB,
    pricingModel: data._quoteSnapshot?.pricingModel,
    includeInsurance: data.includeInsurance,
    luggageCarCount: data.luggageCarCount,
    carTypes: data.carFees?.map((day) => day.type),
    included: data._quoteSnapshot?.externalQuote?.included,
    excluded: data._quoteSnapshot?.externalQuote?.excluded,
  }
}

async function main() {
  if (!process.env.SANITY_API_TOKEN) {
    throw new Error('SANITY_API_TOKEN is required')
  }

  const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'xefjjue7',
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2024-01-01',
    useCdn: false,
    token: process.env.SANITY_API_TOKEN,
  })

  const docs = await client.fetch(
    '*[_type == $type && publicSlug.current in $slugs]{_id,_rev,name,publicSlug,payload}',
    { type: 'pricingExample', slugs: SLUGS },
  )

  if (docs.length !== SLUGS.length) {
    throw new Error(`Expected ${SLUGS.length} package quotes, found ${docs.length}`)
  }

  const updates = docs.map((doc) => {
    const slug = doc.publicSlug.current
    const config = packageConfigs[slug]
    if (!config) throw new Error(`Missing config for ${slug}`)
    const payload = buildUpdatedPayload(doc.payload, config)
    const summary = summarize(payload)
    if (summary.totalTHB !== config.totalTHB || summary.pricingModel !== 'perPerson') {
      throw new Error(`Generated snapshot failed validation for ${slug}`)
    }
    return { ...doc, slug, originalPayload: doc.payload, payload, summary }
  })

  for (const update of updates.sort((a, b) => a.slug.localeCompare(b.slug))) {
    console.log(`\n${update.slug} | ${update.name}`)
    console.log(JSON.stringify(update.summary, null, 2))
  }

  if (!APPLY) {
    console.log('\nDRY RUN ONLY — no Sanity documents were changed.')
    return
  }

  const backupDir = resolve(process.cwd(), 'artifacts', 'quote-package-refresh')
  await mkdir(backupDir, { recursive: true })
  const backupPath = resolve(backupDir, `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  await writeFile(
    backupPath,
    JSON.stringify(
      updates.map(({ _id, _rev, name, slug, originalPayload }) => ({
        _id,
        _rev,
        name,
        slug,
        payload: originalPayload,
      })),
      null,
      2,
    ),
    'utf8',
  )

  let transaction = client.transaction()
  for (const update of updates) {
    transaction = transaction.patch(update._id, (patch) =>
      patch.ifRevisionId(update._rev).set({ payload: update.payload }),
    )
  }
  await transaction.commit()

  const refreshed = await client.fetch(
    '*[_type == $type && publicSlug.current in $slugs]{publicSlug,payload}',
    { type: 'pricingExample', slugs: SLUGS },
  )
  for (const doc of refreshed) {
    const slug = doc.publicSlug.current
    const summary = summarize(doc.payload)
    if (
      summary.totalTHB !== packageConfigs[slug].totalTHB ||
      summary.pricingModel !== 'perPerson' ||
      summary.packagePricingId !== packageConfigs[slug].packagePricingId ||
      summary.includeInsurance !== false ||
      summary.luggageCarCount !== packageConfigs[slug].luggageCarCount
    ) {
      throw new Error(`Post-write verification failed for ${slug}`)
    }
  }

  console.log(`\nAPPLY COMPLETE — backup: ${backupPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
