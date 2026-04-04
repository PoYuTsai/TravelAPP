export const PRICING_MOBILE_BREAKPOINT = 768

export function getPricingResponsiveLayout(viewportWidth: number) {
  const isCompact = viewportWidth <= PRICING_MOBILE_BREAKPOINT
  const carFeeGridTemplateColumns = isCompact
    ? 'repeat(2, minmax(0, 1fr))'
    : '50px 60px minmax(180px, 1fr) 90px 90px 80px 30px'
  const serviceToggleGridColumns = isCompact
    ? 'repeat(2, minmax(0, 1fr))'
    : 'repeat(5, max-content)'
  const savedQuoteCardDirection = isCompact ? 'column' : 'row'

  return {
    isCompact,
    containerPadding: isCompact ? 12 : 20,
    sectionPadding: isCompact ? 14 : 20,
    carFeeGridTemplateColumns,
    internalTableMinWidth: isCompact ? 560 : 0,
    serviceToggleGridColumns,
    savedQuoteCardDirection,
  } as const
}
