export interface ExternalQuotePerPersonItem {
  label: string
  quantity: number
  unitPriceThb: number
  subtotalThb: number
}

export interface ExternalQuoteBreakdownInput {
  /** 'perPerson'：items 走售價結構（大人/兒童/嬰兒＋接送機），不出現成本拆項 */
  pricingModel?: 'perPerson'
  perPersonItems?: ExternalQuotePerPersonItem[]
  /** 純接送日按車收合計（THB） */
  transferFee?: number
  transferTrips?: number
  includeAccommodation: boolean
  includeMeals: boolean
  includeGuide: boolean
  includeInsurance: boolean
  accommodationCost: number
  mealCost: number
  carPriceTotal: number
  guidePrice: number
  luggageCost: number
  childSeatCost: number
  ticketPrice: number
  thaiDressPrice: number
  insuranceCost: number
  totalPrice: number
  exchangeRate: number
  totalNights: number
  accommodationRoomCount?: number
  selfBookedAccommodationNights?: number
  mealDays: number
  guideDays: number
  carServiceDays: number
  carCount: number
  childSeatDays: number
  totalChildSeatCount: number
  selectedTicketCount: number
  hasThaiDress: boolean
  travelerCount?: number
}

export interface ExternalQuoteBreakdownItem {
  label: string
  amountTHB: number
  amountTWD: number
  description?: string
  /** 現場付（代收代付，當日跟團費一起收）：前台明細標「現場付」徽章，金額照列 */
  payOnSite?: boolean
}

export interface ExternalQuoteBreakdown {
  items: ExternalQuoteBreakdownItem[]
  included: string[]
  excluded: string[]
  paymentNotes: string[]
  totalTHB: number
  totalTWD: number
}

export const ACTIVITY_BOOKING_LABEL = '票券 / 活動 / 代訂'
export const COMPACT_ACTIVITY_BOOKING_LABEL = '票券/活動/代訂'

function toTwd(amountTHB: number, exchangeRate: number) {
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return 0
  return Math.round(amountTHB / exchangeRate)
}

function getActivityDescription(selectedTicketCount: number, hasThaiDress: boolean) {
  if (selectedTicketCount > 0 && hasThaiDress) {
    return `${selectedTicketCount} 項${ACTIVITY_BOOKING_LABEL} + 泰服體驗`
  }

  if (selectedTicketCount > 0) {
    return `${selectedTicketCount} 項${ACTIVITY_BOOKING_LABEL}`
  }

  if (hasThaiDress) {
    return '泰服體驗'
  }

  return undefined
}

export function buildExternalQuoteBreakdown(
  input: ExternalQuoteBreakdownInput
): ExternalQuoteBreakdown {
  const items: ExternalQuoteBreakdownItem[] = []
  const activityAmount = input.ticketPrice + input.thaiDressPrice
  const isPerPerson = input.pricingModel === 'perPerson'
  const perPersonLabels = new Set<string>()

  if (isPerPerson) {
    // 售價結構：團費按人頭列（車＋導遊＋機場行李已攤入每人價）
    for (const item of input.perPersonItems ?? []) {
      if (item.subtotalThb <= 0) continue
      perPersonLabels.add(item.label)
      items.push({
        label: item.label,
        amountTHB: item.subtotalThb,
        amountTWD: toTwd(item.subtotalThb, input.exchangeRate),
        description: `${item.quantity} 位 × ${item.unitPriceThb.toLocaleString()}`,
      })
    }
    if ((input.transferFee ?? 0) > 0) {
      items.push({
        label: '接送機',
        amountTHB: input.transferFee!,
        amountTWD: toTwd(input.transferFee!, input.exchangeRate),
        description: `${input.transferTrips ?? 1} 趟（按車計）`,
      })
    }
  } else {
    if (input.carPriceTotal > 0) {
      items.push({
        label: '包車費用',
        amountTHB: input.carPriceTotal,
        amountTWD: toTwd(input.carPriceTotal, input.exchangeRate),
        description: `${input.carServiceDays} 天 / ${input.carCount} 台`,
      })
    }

    if (input.includeGuide && input.guidePrice > 0) {
      items.push({
        label: '中文導遊',
        amountTHB: input.guidePrice,
        amountTWD: toTwd(input.guidePrice, input.exchangeRate),
        description: `${input.guideDays} 天`,
      })
    }

    if (input.luggageCost > 0) {
      items.push({
        label: '行李加大車',
        amountTHB: input.luggageCost,
        amountTWD: toTwd(input.luggageCost, input.exchangeRate),
        description: '行李車放置行李',
      })
    }
  }

  if (input.childSeatCost > 0) {
    items.push({
      label: '兒童安全座椅',
      amountTHB: input.childSeatCost,
      amountTWD: toTwd(input.childSeatCost, input.exchangeRate),
      description: `${input.totalChildSeatCount} 張 / ${input.childSeatDays} 天`,
    })
  }

  if (input.includeAccommodation && input.accommodationCost > 0) {
    const roomDescription =
      input.accommodationRoomCount && input.accommodationRoomCount > 0
        ? `，共 ${input.accommodationRoomCount} 間房`
        : ''

    items.push({
      label: '住宿',
      amountTHB: input.accommodationCost,
      amountTWD: toTwd(input.accommodationCost, input.exchangeRate),
      description: `${input.totalNights} 晚住宿${roomDescription}`,
    })
  }

  if (input.includeMeals && input.mealCost > 0) {
    items.push({
      label: '餐食',
      amountTHB: input.mealCost,
      amountTWD: toTwd(input.mealCost, input.exchangeRate),
      description: `${input.mealDays} 天（每日預設午餐＋晚餐）`,
    })
  }

  if (activityAmount > 0) {
    items.push({
      label: ACTIVITY_BOOKING_LABEL,
      amountTHB: activityAmount,
      amountTWD: toTwd(activityAmount, input.exchangeRate),
      description: getActivityDescription(input.selectedTicketCount, input.hasThaiDress),
    })
  }

  if (input.includeInsurance && input.insuranceCost > 0) {
    items.push({
      label: '旅遊保險',
      amountTHB: input.insuranceCost,
      amountTWD: toTwd(input.insuranceCost, input.exchangeRate),
      description:
        input.travelerCount && input.travelerCount > 0
          ? `共 ${input.travelerCount} 位旅客`
          : undefined,
    })
  }

  // perPerson：included 是服務清單（人頭計價的大人/兒童/接送機不是「包含項目」）
  const included = isPerPerson
    ? [
        '車資、油費、過路費、停車費',
        '專業司機',
        ...(input.includeGuide ? ['中文導遊'] : []),
        '貼心中文客服',
        ...items
          .filter((item) => !perPersonLabels.has(item.label) && item.label !== '接送機')
          .map((item) => item.label),
      ]
    : items.map((item) => item.label)
  const selfBookedAccommodationNights = Math.max(0, input.selfBookedAccommodationNights ?? 0)
  const excluded = [
    !input.includeAccommodation ? '住宿' : null,
    input.includeAccommodation && selfBookedAccommodationNights > 0
      ? `其餘住宿（${selfBookedAccommodationNights}晚，客人自理）`
      : null,
    !input.includeMeals ? '餐食' : null,
    activityAmount <= 0 ? ACTIVITY_BOOKING_LABEL : null,
    !input.includeGuide ? '中文導遊' : null,
    !input.includeInsurance ? '旅遊保險' : null,
    '機票',
    '個人消費',
    '司機導遊小費',
    // 超時費按台實收（清邁 10hr、清萊/金三角 12hr 後），不進包含清單
    isPerPerson ? '超時費（THB 300/小時/台）' : null,
  ].filter((item): item is string => Boolean(item))

  const hasPrepaidItems =
    (input.includeAccommodation && input.accommodationCost > 0) ||
    (input.includeMeals && input.mealCost > 0) ||
    activityAmount > 0

  const paymentNotes = hasPrepaidItems
    ? [
        '若本行程含住宿、票券、活動或代訂項目，付款時程將依實際預訂內容另行確認。',
        '實際付款節點與金額，請以報價單或雙方確認訊息為準。',
      ]
    : ['本行程付款方式可依雙方確認後安排。']

  return {
    items,
    included,
    excluded,
    paymentNotes,
    totalTHB: input.totalPrice,
    totalTWD: toTwd(input.totalPrice, input.exchangeRate),
  }
}
