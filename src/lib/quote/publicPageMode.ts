export type QuotePublicPageMode = 'quote' | 'package'

export function resolveQuotePublicPageMode(value: unknown): QuotePublicPageMode {
  return value === 'package' ? 'package' : 'quote'
}

export function formatPackageEstimateBasis({
  adults,
  children,
  tripDays,
  tripNights,
  carCount,
  travelerLabel,
}: {
  adults: number
  children: number
  tripDays: number
  tripNights: number
  carCount: number
  travelerLabel?: string
}) {
  const travelerText = travelerLabel?.trim() || `${adults} 大${children > 0 ? ` ${children} 小` : ''}`
  const normalizedCarCount = Math.max(carCount, 1)

  return `以 ${travelerText} / ${normalizedCarCount} 台車 / ${tripDays} 天 ${tripNights} 夜估算`
}
