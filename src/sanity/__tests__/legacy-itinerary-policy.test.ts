import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  buildLegacyOtherQuotationItems,
  legacyAirportTransferFee,
  resolveLegacyDailyQuotationItems,
} from '../components/structured-editor/StructuredQuotationTable'
import { validateEditor } from '../components/structured-editor/ValidationStatus'
import {
  alignLegacyBasicInfoFleet,
  documentToEditorState,
} from '../components/structured-editor/types'
import {
  LEGACY_ITINERARY_DEFAULT_NOTES,
  alignLegacyTravelNotes,
  alignLegacyIncludesExcludes,
  resolveLegacyPublicFleet,
} from '../actions/syncFromTextAction'
import itinerarySchema from '../schemas/itinerary'
import type { BasicInfo, OtherQuotationItem } from '../components/structured-editor/types'

function makeBasicInfo(overrides: Partial<BasicInfo> = {}): BasicInfo {
  return {
    clientName: '測試家庭',
    startDate: '2026-08-01',
    endDate: '2026-08-02',
    arrivalFlight: { preset: '', custom: '' },
    departureFlight: { preset: '', custom: '' },
    adults: 2,
    children: 1,
    infants: 0,
    childrenAges: '3歲',
    guideService: { required: false, quantity: 1, days: 2 },
    childSeat: { required: false, quantity: 0, days: 0 },
    extraVehicle: { required: false, quantity: 0, days: 0 },
    vehicleCount: 1,
    vehicleType: 'sedan',
    luggageNote: '',
    ...overrides,
  }
}

function findField(name: string) {
  return (itinerarySchema.fields as any[]).find((field) => field.name === name)
}

describe('active legacy itinerary pricing policy', () => {
  it('is still registered as an itinerary document action', () => {
    const config = readFileSync(new URL('../../../sanity.config.ts', import.meta.url), 'utf8')

    expect(config).toContain("import { syncFromTextAction } from './src/sanity/actions/syncFromTextAction'")
    expect(config).toMatch(/context\.schemaType === 'itinerary'[\s\S]*syncFromTextAction/)
  })

  it('keeps Quick Start neutral until guide or insurance is explicitly selected', () => {
    const source = readFileSync(
      new URL('../components/QuickStartInput.tsx', import.meta.url),
      'utf8',
    )

    expect(source).toContain('司機: 泰國司機')
    expect(source).toContain('導遊: 未選配')
    expect(source).not.toContain('中英泰導遊 1位')
    expect(source).not.toMatch(/^導遊 2500\*6天$/m)
    expect(source).not.toMatch(/^保險 500$/m)
  })

  it('does not add guide or insurance unless each option is selected', () => {
    expect(buildLegacyOtherQuotationItems(makeBasicInfo(), [])).toEqual([])
  })

  it('uses canonical fixed add-on prices without double-counting a child seat as a traveler', () => {
    const selectedInsurance: OtherQuotationItem = {
      type: 'insurance',
      description: '泰國旅遊保險',
      unitPrice: 1,
      quantity: 99,
      days: 99,
      subtotal: 1,
    }
    const items = buildLegacyOtherQuotationItems(
      makeBasicInfo({
        guideService: { required: true, quantity: 1, days: 2 },
        childSeat: { required: true, quantity: 1, days: 2 },
      }),
      [selectedInsurance],
    )

    expect(items.find((item) => item.type === 'guide')).toMatchObject({
      unitPrice: 2_500,
      quantity: 1,
      days: 2,
      subtotal: 5_000,
    })
    expect(items.find((item) => item.type === 'childSeat')).toMatchObject({
      unitPrice: 500,
      quantity: 1,
      days: 2,
      subtotal: 1_000,
    })
    expect(items.find((item) => item.type === 'insurance')).toMatchObject({
      unitPrice: 100,
      quantity: 3,
      days: 1,
      subtotal: 300,
    })
  })

  it.each([
    [2, 'sedan', 1, false],
    [3, 'sedan', 1, false],
    [4, 'van', 1, false],
    [9, 'van', 1, false],
    [10, 'van', 2, false],
    [18, 'van', 2, false],
    [19, 'van', 3, true],
  ] as const)(
    'resolves %i occupied seats to %s x%i (manual=%s)',
    (occupiedSeats, vehicle, carCount, manualQuoteRequired) => {
      expect(resolveLegacyPublicFleet(occupiedSeats)).toMatchObject({
        vehicle,
        carCount,
        manualQuoteRequired,
      })
    },
  )

  it('defaults new legacy editor state to a Thai-driver sedan with no guide', () => {
    const state = documentToEditorState({ adults: 2, children: 0, days: [] })

    expect(state.basicInfo.guideService.required).toBe(false)
    expect(state.basicInfo.vehicleType).toBe('sedan')
    expect(state.basicInfo.vehicleCount).toBe(1)
  })

  it('normalizes serialized SUV and one-Van values to the public 10–18 guest fleet', () => {
    const state = documentToEditorState({
      adults: 10,
      children: 0,
      days: [],
      vehicleType: 'suv',
      vehicleCount: 1,
    })

    expect(state.basicInfo.vehicleType).toBe('van')
    expect(state.basicInfo.vehicleCount).toBe(2)
  })

  it('counts serialized infantCount in fleet and insurance occupancy', () => {
    const state = documentToEditorState({
      adults: 3,
      children: 0,
      infantCount: 1,
      days: [],
    })
    expect(state.basicInfo.infants).toBe(1)
    expect(state.basicInfo.vehicleType).toBe('van')

    const insurance: OtherQuotationItem = {
      type: 'insurance',
      description: '旅遊保險（選配）',
      unitPrice: 100,
      quantity: 1,
      days: 1,
      subtotal: 100,
    }
    const items = buildLegacyOtherQuotationItems(state.basicInfo, [insurance])
    expect(items.find((item) => item.type === 'insurance')?.quantity).toBe(4)
  })

  it('does not treat the old automatically-added insurance row as a new opt-in', () => {
    const legacy = documentToEditorState({
      adults: 2,
      children: 0,
      quotationItems: [
        {
          description: '泰國旅遊保險',
          unitPrice: 100,
          quantity: 2,
        },
      ],
    })
    expect(legacy.quotation.otherItems.some((item) => item.type === 'insurance')).toBe(false)

    const selected = documentToEditorState({
      adults: 2,
      children: 0,
      quotationItems: [
        {
          description: '旅遊保險（選配）',
          unitPrice: 100,
          quantity: 2,
        },
      ],
    })
    expect(selected.quotation.otherItems.some((item) => item.type === 'insurance')).toBe(true)
  })

  it('re-resolves the visible fleet immediately when occupancy changes', () => {
    const tenGuests = alignLegacyBasicInfoFleet(
      makeBasicInfo({
        adults: 10,
        children: 0,
        infants: 0,
        vehicleType: 'sedan',
        vehicleCount: 1,
      }),
    )

    expect(tenGuests.vehicleType).toBe('van')
    expect(tenGuests.vehicleCount).toBe(2)
  })

  it('uses the canonical one-way airport fee for each public vehicle', () => {
    expect(legacyAirportTransferFee('sedan')).toBe(500)
    expect(legacyAirportTransferFee('van')).toBe(700)
  })

  it('uses the same derived daily rows for a newly selected date range', () => {
    const items = resolveLegacyDailyQuotationItems(
      makeBasicInfo({
        startDate: '2026-08-01',
        endDate: '2026-08-03',
        adults: 2,
        children: 0,
      }),
      [],
    )

    expect(items).toHaveLength(3)
    expect(items.map((item) => item.date)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ])
    expect(items.at(-1)).toMatchObject({ description: '送機', price: 500 })
  })

  it('re-normalizes a pure airport drop-off row when legacy price or fleet changes', () => {
    const sedan = makeBasicInfo({
      endDate: '2026-08-03',
      adults: 2,
      children: 0,
      infants: 0,
    })
    const oldRows = resolveLegacyDailyQuotationItems(sedan, [
      { date: '2026-08-01', weekday: '六', description: '接機+市區', price: 3700 },
      { date: '2026-08-02', weekday: '日', description: '', price: 4000 },
      { date: '2026-08-03', weekday: '一', description: '送機', price: 700 },
    ])
    expect(oldRows.at(-1)?.price).toBe(500)

    const vanRows = resolveLegacyDailyQuotationItems(
      { ...sedan, adults: 4, vehicleType: 'van', vehicleCount: 1 },
      oldRows,
    )
    expect(vanRows.at(-1)?.price).toBe(700)
  })

  it('rejects one-person and 19-plus automatic quotes before synchronization', () => {
    const onePerson = makeBasicInfo({ adults: 1, children: 0, infants: 0 })
    const nineteenPeople = makeBasicInfo({ adults: 19, children: 0, infants: 0 })

    expect(validateEditor(onePerson, []).isValid).toBe(false)
    expect(validateEditor(onePerson, []).errors.join(' ')).toMatch(/至少.*2|人工/)
    expect(validateEditor(nineteenPeople, []).isValid).toBe(false)
    expect(validateEditor(nineteenPeople, []).errors.join(' ')).toMatch(/19.*人工/)
  })

  it('round-trips legacy out-of-town room nights without collapsing them to one night', () => {
    const state = documentToEditorState({
      adults: 4,
      children: 0,
      guideService: { required: true, quantity: 1, days: 3 },
      quotationItems: [
        {
          description: '外地住宿補貼',
          unitPrice: 750,
          quantity: 6,
        },
      ],
    })
    const stay = state.quotation.otherItems.find((item) => item.type === 'outOfTownStay')

    expect(stay).toMatchObject({ quantity: 2, days: 3, subtotal: 4_500 })
    expect(buildLegacyOtherQuotationItems(state.basicInfo, state.quotation.otherItems))
      .toContainEqual(expect.objectContaining({ type: 'outOfTownStay', quantity: 2, days: 3, subtotal: 4_500 }))
  })

  it('keeps optional guide and insurance out of inclusions unless selected', () => {
    const raw = {
      priceIncludes: '- 7人座休旅車\n- 中文導遊服務\n- 泰國旅遊保險\n- 油費',
      priceExcludes: '- 門票',
    }

    const standard = alignLegacyIncludesExcludes(raw, {
      withGuide: false,
      withInsurance: false,
    })
    expect(standard.priceIncludes).toContain('泰國司機包車服務')
    expect(standard.priceIncludes).toContain('油費')
    expect(standard.priceIncludes).not.toMatch(/7人座|休旅|導遊|保險/)
    expect(standard.priceExcludes).toContain('中文導遊服務（未選配）')
    expect(standard.priceExcludes).toContain('旅遊保險（未選配）')

    const selected = alignLegacyIncludesExcludes(raw, {
      withGuide: true,
      withInsurance: true,
    })
    expect(selected.priceIncludes).toContain('中文導遊服務（選配）')
    expect(selected.priceIncludes).toContain('旅遊保險（選配）')
  })

  it('uses the full canonical overtime and add-on policy in generated notes', () => {
    expect(LEGACY_ITINERARY_DEFAULT_NOTES).toContain('標準服務為泰國司機；中文導遊為選配')
    expect(LEGACY_ITINERARY_DEFAULT_NOTES).toContain('清邁 10 小時；清萊／金三角 12 小時')
    expect(LEGACY_ITINERARY_DEFAULT_NOTES).toContain('30 分鐘彈性')
    expect(LEGACY_ITINERARY_DEFAULT_NOTES).toContain('THB 300／小時／車')
    expect(LEGACY_ITINERARY_DEFAULT_NOTES).toContain('中文導遊不另計超時費')
    expect(LEGACY_ITINERARY_DEFAULT_NOTES).toContain('THB 500／日／張')
    expect(LEGACY_ITINERARY_DEFAULT_NOTES).toContain('安裝於該孩童的乘客座位，不另加算一位')
    expect(LEGACY_ITINERARY_DEFAULT_NOTES).toContain('旅遊保險為選配：THB 100／人／趟')
    expect(LEGACY_ITINERARY_DEFAULT_NOTES).not.toMatch(/200\s*\/\s*hr|保險.*包含/)
  })

  it('strips stale currency, SUV, insurance, guide, and overtime claims from saved notes', () => {
    const aligned = alignLegacyTravelNotes(
      `包含: 7人座休旅車、泰國旅遊保險\n用車時間: 清邁10小時; 清萊12小時，司機200/hr\n總價 NT$20,000\n導遊會全程照顧大家`,
      { withGuide: false, withInsurance: false },
    )

    expect(aligned).not.toMatch(/7\s*人座|休旅|SUV|NT\$|200\s*\/\s*hr|導遊會全程/)
    expect(aligned).toContain('THB 300／小時／車')
    expect(aligned).toContain('本次旅遊保險：未選配')
  })

  it('normalizes notes idempotently and always restores canonical included costs', () => {
    const options = { withGuide: false, withInsurance: false }
    const once = alignLegacyTravelNotes(
      '包含: 7人座包車（含油、過路費）\n\n不包含: 門票',
      options,
    )
    const twice = alignLegacyTravelNotes(once, options)

    expect(twice).toBe(once)
    expect(twice.match(/本次旅遊保險：未選配/g)).toHaveLength(1)
    expect(twice).not.toMatch(/7\s*人座|休旅|SUV/i)
    for (const included of ['泰國司機包車服務', '油費', '過路費', '停車費', 'LINE 中文支援']) {
      expect(twice).toContain(included)
    }

    const lists = alignLegacyIncludesExcludes(
      { priceIncludes: '- 7人座包車（含油、過路費）', priceExcludes: '- 門票' },
      options,
    )
    for (const included of ['泰國司機包車服務', '油費', '過路費', '停車費', 'LINE 中文支援']) {
      expect(lists.priceIncludes).toContain(included)
    }
  })

  it('removes arbitrary stale fixed rates before appending canonical policy', () => {
    const aligned = alignLegacyTravelNotes(
      [
        '包含: 油費、停車費',
        '',
        '導遊費 THB 2,000／日',
        '保險費 THB 80／人',
        '兒童安全座椅費 THB 200／張',
        '超時費 THB 200／小時',
        '中文導遊 THB 2,000／日',
        '旅遊保險 80 泰銖／人',
        '安全座椅 200／天',
        '第一天交給導遊 20000 泰銖作為餐費代付預算',
        '中文導遊每日 09:00 到飯店大廳集合',
        '旅遊保險每人需提供護照 1 份',
        '兒童座椅每天準備 1 張',
      ].join('\n'),
      { withGuide: true, withInsurance: false },
    )

    expect(aligned).not.toMatch(/THB (?:2,000|80|200)/)
    expect(aligned).not.toMatch(/(?:旅遊保險 80 泰銖|安全座椅 200／天)/)
    expect(aligned).toContain('第一天交給導遊 20000 泰銖作為餐費代付預算')
    expect(aligned).toContain('中文導遊每日 09:00 到飯店大廳集合')
    expect(aligned).toContain('旅遊保險每人需提供護照 1 份')
    expect(aligned).toContain('兒童座椅每天準備 1 張')
    expect(aligned).toContain('中文導遊選配價為 THB 2,500／日')
    expect(aligned).toContain('旅遊保險為選配：THB 100／人／趟')
    expect(aligned).toContain('兒童安全座椅為 THB 500／日／張')
    expect(aligned).toContain('THB 300／小時／車')
  })

  it('keeps the itinerary schema on THB and retires public SUV and legacy daily-price fields', () => {
    const guideRequired = findField('guideService').fields.find(
      (field: any) => field.name === 'required',
    )
    expect(guideRequired.initialValue).toBe(false)

    const vehicleTypes = findField('vehicleType').options.list
    expect(vehicleTypes.map((option: any) => option.value)).toEqual(['sedan', 'van'])
    expect(vehicleTypes.map((option: any) => option.title).join(' ')).toMatch(/2.?3.*4.?9.*10.?18/)

    const dayFields = findField('days').of[0].fields
    for (const name of ['carPrice', 'guidePrice']) {
      const legacyField = dayFields.find((field: any) => field.name === name)
      expect(legacyField.hidden).toBe(true)
      expect(legacyField.readOnly).toBe(true)
    }

    const schemaSource = readFileSync(new URL('../schemas/itinerary.ts', import.meta.url), 'utf8')
    const tableSource = readFileSync(
      new URL('../components/structured-editor/StructuredQuotationTable.tsx', import.meta.url),
      'utf8',
    )
    const actionSource = readFileSync(new URL('../actions/syncFromTextAction.tsx', import.meta.url), 'utf8')
    expect(`${schemaSource}\n${tableSource}\n${actionSource}`).not.toMatch(
      /NT\$|7人座休旅車|200\s*\/\s*hr|childSeat:\s*200/,
    )
  })
})
