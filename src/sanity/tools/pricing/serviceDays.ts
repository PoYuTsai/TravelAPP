function toWholeNumber(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.floor(value)
}

export function clampGuideServiceDays(
  requestedDays: number | undefined,
  tripDays: number,
  fallbackDays: number
) {
  const maxDays = Math.max(0, toWholeNumber(tripDays) ?? 0)
  if (maxDays === 0) return 0

  const fallback = Math.min(
    Math.max(toWholeNumber(fallbackDays) ?? 1, 1),
    maxDays
  )
  const requested = toWholeNumber(requestedDays)

  if (requested === null) {
    return fallback
  }

  return Math.min(Math.max(requested, 1), maxDays)
}

export function getChildSeatChargeDays(tripDays: number) {
  return Math.max(0, toWholeNumber(tripDays) ?? 0)
}
