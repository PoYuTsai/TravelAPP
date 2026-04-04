export const PRICING_MOBILE_BREAKPOINT = 768

export function getPricingResponsiveLayout(viewportWidth: number) {
  const isCompact = viewportWidth <= PRICING_MOBILE_BREAKPOINT

  return {
    isCompact,
    containerPadding: isCompact ? 12 : 20,
    sectionPadding: isCompact ? 14 : 20,
    carFeeGridTemplateColumns: isCompact
      ? 'repeat(2, minmax(0, 1fr))'
      : '50px 60px minmax(180px, 1fr) 80px 80px 30px',
    internalTableMinWidth: isCompact ? 560 : 0,
  }
}
