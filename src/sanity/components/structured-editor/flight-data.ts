// src/sanity/components/structured-editor/flight-data.ts

export interface FlightOption {
  value: string
  label: string
  type: 'morning' | 'afternoon' | 'evening' | 'midday' | 'redeye' | 'custom'
  hint: string
}

export const ARRIVAL_FLIGHTS: FlightOption[] = [
  {
    value: 'CI851',
    label: '華航 CI851 (07:30-10:20)',
    type: 'morning',
    hint: '☀️ 早班機：可安排完整首日行程',
  },
  {
    value: 'BR257',
    label: '長榮 BR257 (07:25-10:25)',
    type: 'morning',
    hint: '☀️ 早班機：可安排完整首日行程',
  },
  {
    value: 'JX751',
    label: '星宇 JX751 (13:20-16:20)',
    type: 'afternoon',
    hint: '🌤️ 午班機：首日可安排晚餐+夜間活動',
  },
  {
    value: 'FD243',
    label: '亞航 FD243 (18:55-21:45)',
    type: 'evening',
    hint: '🌙 晚班機：首日僅接機+入住',
  },
  {
    value: 'custom',
    label: '其他（自訂）',
    type: 'custom',
    hint: '',
  },
]

export const DEPARTURE_FLIGHTS: FlightOption[] = [
  {
    value: 'CI852',
    label: '華航 CI852 (11:20-16:00)',
    type: 'midday',
    hint: '✈️ 建議 9:00 前出發送機',
  },
  {
    value: 'BR258',
    label: '長榮 BR258 (11:35-16:35)',
    type: 'midday',
    hint: '✈️ 建議 9:00 前出發送機',
  },
  {
    value: 'JX752',
    label: '星宇 JX752 (17:20-22:10)',
    type: 'afternoon',
    hint: '✈️ 可安排午餐後送機',
  },
  {
    value: 'FD242',
    label: '亞航 FD242 (01:40-06:35)',
    type: 'redeye',
    hint: '🌙 紅眼班機：可安排完整末日+晚餐',
  },
  {
    value: 'custom',
    label: '其他（自訂）',
    type: 'custom',
    hint: '',
  },
]

export const VEHICLE_TYPES = [
  { value: 'sedan', label: '4人座小車' },
  { value: 'suv', label: '7人座休旅車' },
  { value: 'van', label: '10人座大車（麵包車）' },
  { value: 'custom', label: '其他' },
]

export function getFlightHint(flights: FlightOption[], value: string): string {
  const flight = flights.find((f) => f.value === value)
  return flight?.hint || ''
}
