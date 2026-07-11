export interface PackageAnchor {
  name: string
  pricePerPerson: number
  href: `/quote/${string}`
  summary: string
}

export const PACKAGE_ANCHORS: PackageAnchor[] = [
  {
    name: '清邁親子 5 天 4 夜經典',
    pricePerPerson: 6000,
    href: '/quote/k8oeyepp',
    summary: '接機旅遊、三天近郊行程與最後送機',
  },
  {
    name: '清萊 2 天自由行',
    pricePerPerson: 3750,
    href: '/quote/uao33058',
    summary: '兩天清萊包車、中文導遊與司導外宿',
  },
  {
    name: '泰北 6 天 5 夜親子深度遊',
    pricePerPerson: 9200,
    href: '/quote/lyx5aysy',
    summary: '芳縣、金三角、清萊與首晚芳縣住宿',
  },
]
