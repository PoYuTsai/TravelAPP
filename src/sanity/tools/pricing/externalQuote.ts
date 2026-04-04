export interface ExternalQuoteBreakdownInput {
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
  mealDays: number
  guideDays: number
  carServiceDays: number
  carCount: number
  selectedTicketCount: number
  hasThaiDress: boolean
}

export interface ExternalQuoteBreakdownItem {
  label: string
  amountTHB: number
  amountTWD: number
  description?: string
}

export interface ExternalQuoteBreakdown {
  items: ExternalQuoteBreakdownItem[]
  included: string[]
  excluded: string[]
  paymentNotes: string[]
  totalTHB: number
  totalTWD: number
}

function toTwd(amountTHB: number, exchangeRate: number) {
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return 0
  return Math.round(amountTHB / exchangeRate)
}

function getActivityDescription(selectedTicketCount: number, hasThaiDress: boolean) {
  if (selectedTicketCount > 0 && hasThaiDress) {
    return `${selectedTicketCount} 項門票活動 + 泰服體驗`
  }

  if (selectedTicketCount > 0) {
    return `${selectedTicketCount} 項門票活動`
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
    })
  }

  if (input.childSeatCost > 0) {
    items.push({
      label: '兒童安全座椅',
      amountTHB: input.childSeatCost,
      amountTWD: toTwd(input.childSeatCost, input.exchangeRate),
    })
  }

  if (input.includeAccommodation && input.accommodationCost > 0) {
    items.push({
      label: '住宿',
      amountTHB: input.accommodationCost,
      amountTWD: toTwd(input.accommodationCost, input.exchangeRate),
      description: `${input.totalNights} 晚`,
    })
  }

  if (input.includeMeals && input.mealCost > 0) {
    items.push({
      label: '餐食',
      amountTHB: input.mealCost,
      amountTWD: toTwd(input.mealCost, input.exchangeRate),
      description: `${input.mealDays} 天`,
    })
  }

  if (activityAmount > 0) {
    items.push({
      label: '門票活動',
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
    })
  }

  const included = items.map((item) => item.label)
  const excluded = [
    !input.includeAccommodation ? '住宿' : null,
    !input.includeMeals ? '餐食' : null,
    activityAmount <= 0 ? '門票活動' : null,
    !input.includeGuide ? '中文導遊' : null,
    !input.includeInsurance ? '旅遊保險' : null,
    '機票',
    '個人消費',
    '司機導遊小費',
  ].filter((item): item is string => Boolean(item))

  const hasPrepaidItems =
    (input.includeAccommodation && input.accommodationCost > 0) ||
    (input.includeMeals && input.mealCost > 0) ||
    activityAmount > 0

  const paymentNotes = hasPrepaidItems
    ? [
        '若本行程含住宿、門票或其他需預訂項目，付款時程將依實際預訂內容另行確認。',
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
