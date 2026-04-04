export type PricingCalculatorVariant = 'legacy' | 'formal'

export const PRICING_TOOL_CONFIG = {
  legacy: {
    toolName: 'pricing',
    toolTitle: '報價計算測試v1',
    ticketStorageKey: 'chiangway-pricing-tickets-v1',
    quoteStorageKey: 'chiangway-pricing-quotes',
    draftStorageKey: 'chiangway-pricing-draft-v1',
  },
  formal: {
    toolName: 'pricing-formal',
    toolTitle: '報價計算(正式版)',
    ticketStorageKey: 'chiangway-pricing-tickets-formal-v1',
    quoteStorageKey: 'chiangway-pricing-quotes-formal',
    draftStorageKey: 'chiangway-pricing-draft-formal-v1',
  },
} as const

type TicketLike = {
  rebate: number
  split: boolean
}

type ThaiDressEntry = {
  price: number
  rebate: number
}

type PricingConfigLike = {
  thaiDress: {
    cloth: ThaiDressEntry
    makeup: ThaiDressEntry
    photo: ThaiDressEntry
  }
}

export function normalizeTicketsForVariant<T extends TicketLike>(
  tickets: T[],
  variant: PricingCalculatorVariant
): T[] {
  return tickets.map((ticket) =>
    variant === 'formal'
      ? { ...ticket, rebate: 0, split: false }
      : { ...ticket }
  )
}

export function normalizePricingConfigForVariant<T extends PricingConfigLike>(
  config: T,
  variant: PricingCalculatorVariant
): T {
  const normalized = {
    ...config,
    thaiDress: {
      cloth: {
        ...config.thaiDress.cloth,
        rebate: variant === 'formal' ? 0 : config.thaiDress.cloth.rebate,
      },
      makeup: {
        ...config.thaiDress.makeup,
        rebate: variant === 'formal' ? 0 : config.thaiDress.makeup.rebate,
      },
      photo: {
        ...config.thaiDress.photo,
        rebate: variant === 'formal' ? 0 : config.thaiDress.photo.rebate,
      },
    },
  }

  return normalized as T
}

export function calculateFormalProfitShares(totalProfit: number) {
  const safeProfit = Math.max(0, Math.round(totalProfit))
  const boYu = Math.floor((safeProfit * 70) / 100)
  const lulu = Math.floor((safeProfit * 15) / 100)
  const yanjun = safeProfit - boYu - lulu

  return [
    { label: '柏裕 70%', amount: boYu },
    { label: 'Lulu 15%', amount: lulu },
    { label: '彥君 15%', amount: yanjun },
  ]
}

export function getPricingVariantUi(variant: PricingCalculatorVariant) {
  return {
    showTicketRebateInput: variant === 'legacy',
    showTicketSplitInput: variant === 'legacy',
    showTicketRefundSplitNote: variant === 'legacy',
    showLegacyPartnerProfitRows: variant === 'legacy',
    ticketCostSummaryLabel: variant === 'legacy' ? '門票成本/人' : '門票金額/人',
    showThaiDressCostCopy: variant === 'legacy',
  }
}

export function getPricingStorageKeys(variant: PricingCalculatorVariant) {
  return {
    ticketStorageKey: PRICING_TOOL_CONFIG[variant].ticketStorageKey,
    quoteStorageKey: PRICING_TOOL_CONFIG[variant].quoteStorageKey,
    draftStorageKey: PRICING_TOOL_CONFIG[variant].draftStorageKey,
  }
}
