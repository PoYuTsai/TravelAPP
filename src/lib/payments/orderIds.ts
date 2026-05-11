function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function buildMerchantTradeNo(
  now = new Date(),
  suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
) {
  const stamp = [
    String(now.getUTCFullYear()).slice(-2),
    pad2(now.getUTCMonth() + 1),
    pad2(now.getUTCDate()),
    pad2(now.getUTCHours()),
    pad2(now.getUTCMinutes()),
    pad2(now.getUTCSeconds()),
  ].join('')

  return `CW${stamp}${suffix}`.slice(0, 20)
}

export function buildOrderNo(
  now = new Date(),
  suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
) {
  const stamp = [
    now.getUTCFullYear(),
    pad2(now.getUTCMonth() + 1),
    pad2(now.getUTCDate()),
  ].join('')

  return `CW-${stamp}-${suffix}`
}
