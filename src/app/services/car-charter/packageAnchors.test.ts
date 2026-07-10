import { describe, expect, it } from 'vitest'

import { PACKAGE_ANCHORS } from './packageAnchors'

describe('car-charter package anchors', () => {
  it('links the three public package cards to their existing showcase pages', () => {
    expect(PACKAGE_ANCHORS.map((pkg) => pkg.href)).toEqual([
      '/quote/k8oeyepp',
      '/quote/uao33058',
      '/quote/lyx5aysy',
    ])
  })

  it('uses the approved six-adult reference prices after package recalculation', () => {
    expect(PACKAGE_ANCHORS.map((pkg) => [pkg.name, pkg.pricePerPerson])).toEqual([
      ['清邁親子 5 天 4 夜經典', 6000],
      ['清萊 2 天自由行', 3750],
      ['泰北 6 天 5 夜親子深度遊', 9200],
    ])
  })
})
