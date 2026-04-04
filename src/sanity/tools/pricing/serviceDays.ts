function toWholeNumber(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.floor(value)
}

function clampSelectableServiceDays(
  requestedDays: number | undefined,
  tripDays: number,
  fallbackDays: number
) {
  const maxDays = Math.max(0, toWholeNumber(tripDays) ?? 0)
  if (maxDays === 0) return 0

  const fallbackValue = toWholeNumber(fallbackDays)
  const fallback =
    fallbackValue === null || fallbackValue < 1
      ? maxDays
      : Math.min(fallbackValue, maxDays)
  const requested = toWholeNumber(requestedDays)

  if (requested === null || requested < 1) {
    return fallback
  }

  return Math.min(requested, maxDays)
}

export function clampGuideServiceDays(
  requestedDays: number | undefined,
  tripDays: number,
  fallbackDays: number
) {
  return clampSelectableServiceDays(requestedDays, tripDays, fallbackDays)
}

export function clampMealServiceDays(
  requestedDays: number | undefined,
  tripDays: number,
  fallbackDays: number
) {
  return clampSelectableServiceDays(requestedDays, tripDays, fallbackDays)
}

export function clampChildSeatServiceDays(
  requestedDays: number | undefined,
  tripDays: number,
  fallbackDays: number
) {
  return clampSelectableServiceDays(requestedDays, tripDays, fallbackDays)
}
