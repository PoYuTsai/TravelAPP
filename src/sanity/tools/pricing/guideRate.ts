export interface GuidePerDayRate {
  cost: number
  price: number
}

function normalizeNonNegativeNumber(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, value)
}

export function normalizeGuidePerDayRate(
  rate: Partial<GuidePerDayRate> | undefined,
  fallback: GuidePerDayRate
): GuidePerDayRate {
  return {
    cost: normalizeNonNegativeNumber(rate?.cost, fallback.cost),
    price: normalizeNonNegativeNumber(rate?.price, fallback.price),
  }
}
