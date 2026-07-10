import type { ManualQuoteReason } from '@/lib/pricing/perPersonRates'
import { dayTypeToTier } from './perPersonAdapter'

export type CustomerQuoteGate =
  | { blocked: false; message: null }
  | { blocked: true; message: string }

const MANUAL_QUOTE_MESSAGES: Record<ManualQuoteReason, string> = {
  'guided-sedan-requires-vehicle-confirmation':
    '2–3 人加中文導遊需確認車型，請先人工確認後再對客出單。',
  'group-size-requires-manual-quote':
    '19 人以上需人工報價，請確認車輛與服務安排後再對客出單。',
  'guide-sell-price-unset':
    '導遊售價尚未設定，請先完成人工報價後再對客出單。',
  'guide-capacity-requires-manual-quote':
    '此團體的導遊配置需人工確認，請完成人工報價後再對客出單。',
}

export function resolveCustomerQuoteGate(quote: {
  manualQuoteRequired: boolean
  manualQuoteReason: ManualQuoteReason | null
}): CustomerQuoteGate {
  if (!quote.manualQuoteRequired) return { blocked: false, message: null }

  return {
    blocked: true,
    message: quote.manualQuoteReason
      ? MANUAL_QUOTE_MESSAGES[quote.manualQuoteReason]
      : '此行程需人工確認後才能對客出單。',
  }
}

export function getGuideControlPolicy(occupiedSeats: number): {
  disabled: boolean
  note: string | null
} {
  return {
    disabled: false,
    note:
      occupiedSeats >= 2 && occupiedSeats <= 3
        ? '（加導遊需確認車型）'
        : null,
  }
}

export function countGuideServiceDays(
  days: ReadonlyArray<{ type: string }>,
): number {
  return days.filter((day) => dayTypeToTier(day.type) !== 'transfer').length
}

export function getLockedGuideServiceDays(
  withGuide: boolean,
  days: ReadonlyArray<{ type: string }>,
): number {
  return withGuide ? countGuideServiceDays(days) : 0
}
