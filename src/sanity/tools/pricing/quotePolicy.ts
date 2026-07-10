import {
  dayTypeToTier,
  type PerPersonManualQuoteReason,
} from './perPersonAdapter'
import { CHARTER_OVERTIME_POLICY } from '@/lib/pricing/publicPolicy'

export type CustomerQuoteGate =
  | { blocked: false; message: null }
  | { blocked: true; message: string }

export interface CharterOvertimePolicyCopy {
  serviceHours: string
  grace: string
  fee: string
  excludedLabel: string
}

const MANUAL_QUOTE_MESSAGES: Record<PerPersonManualQuoteReason, string> = {
  'minimum-group-size-required':
    '至少 2 位旅客才能使用自動報價，請人工確認後再對客出單。',
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
  manualQuoteReason: PerPersonManualQuoteReason | null
}): CustomerQuoteGate {
  if (!quote.manualQuoteRequired) return { blocked: false, message: null }

  return {
    blocked: true,
    message: quote.manualQuoteReason
      ? MANUAL_QUOTE_MESSAGES[quote.manualQuoteReason]
      : '此行程需人工確認後才能對客出單。',
  }
}

export function getGuideControlPolicy(_occupiedSeats: number): {
  disabled: boolean
  note: string | null
} {
  return {
    disabled: false,
    note: null,
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

export function resolveGuideService(
  withGuide: boolean,
  days: ReadonlyArray<{ type: string }>,
): { days: number; active: boolean } {
  const guideDays = getLockedGuideServiceDays(withGuide, days)
  return {
    days: guideDays,
    active: guideDays > 0,
  }
}

export function getCharterOvertimePolicyCopy(
  carCount: number,
): CharterOvertimePolicyCopy {
  const policy = CHARTER_OVERTIME_POLICY
  return {
    serviceHours: `清邁行程：每日 ${policy.chiangMaiHours} 小時；清萊／金三角行程：每日 ${policy.chiangRaiGoldenTriangleHours} 小時`,
    grace: `基本用車時間用完後，另有 ${policy.graceMinutes} 分鐘彈性`,
    fee: `超過後按 THB ${policy.feeThbPerHourPerCar}／小時／台計收（${carCount} 台車按台計）；中文導遊不另收超時費`,
    excludedLabel: `超時費（${policy.graceMinutes} 分鐘彈性後，THB ${policy.feeThbPerHourPerCar}／小時／台；中文導遊不另收）`,
  }
}
