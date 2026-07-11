import { describe, expect, it } from 'vitest'

import {
  buildPublishedPackageSnapshot,
  formatPackageTravelerLabel,
  getPublishedPackageId,
  getPublishedPackageStructureIssue,
} from '@/sanity/tools/pricing/packageQuotePricing'

describe('published package quote pricing', () => {
  it('keeps the approved Chiang Mai 5D4N mixed-family price when only the exchange rate changes', () => {
    const snapshot = buildPublishedPackageSnapshot({
      packageId: 'chiang-mai-5d4n',
      adults: 4,
      children: 2,
      infants: 0,
      exchangeRate: 1,
      included: ['中文導遊'],
      excluded: ['門票'],
      paymentNotes: ['以正式報價為準'],
    })

    expect(snapshot.externalQuote.totalTHB).toBe(33_600)
    expect(snapshot.externalQuote.totalTWD).toBe(33_600)
    expect(snapshot.externalQuote.items.map((item) => [item.label, item.amountTHB])).toEqual([
      ['成人', 24_000],
      ['3–11 歲', 9_600],
    ])
  })

  it('uses the approved Chiang Rai 2D1N table for a three-adult quote', () => {
    const snapshot = buildPublishedPackageSnapshot({
      packageId: 'chiang-rai-2d1n',
      adults: 3,
      children: 0,
      infants: 0,
      exchangeRate: 1.1,
    })

    expect(snapshot.externalQuote.totalTHB).toBe(19_800)
    expect(snapshot.externalQuote.items[0]).toMatchObject({
      label: '成人',
      amountTHB: 19_800,
      description: '3 人 × THB 6,600',
    })
  })

  it('adds Fang accommodation after the northern Thailand package per-person table', () => {
    const snapshot = buildPublishedPackageSnapshot({
      packageId: 'northern-thailand-6d5n',
      adults: 7,
      children: 1,
      infants: 0,
      exchangeRate: 1.1,
    })

    expect(snapshot.externalQuote.totalTHB).toBe(55_950)
    expect(snapshot.externalQuote.items.at(-1)).toMatchObject({
      label: '芳縣住宿（第一晚）',
      amountTHB: 6_000,
      description: '4 房 × THB 1,500',
    })
  })

  it('adds only explicit optional extras on top of a fixed package', () => {
    const snapshot = buildPublishedPackageSnapshot({
      packageId: 'chiang-mai-5d4n',
      adults: 4,
      children: 2,
      infants: 0,
      exchangeRate: 1.1,
      optionalItems: [
        { label: '旅遊保險', amountTHB: 600, description: '6 人' },
        { label: '嬰幼兒安全座椅', amountTHB: 2_500, description: '1 張 × 5 天' },
      ],
    })

    expect(snapshot.externalQuote.totalTHB).toBe(36_700)
    expect(snapshot.externalQuote.items.slice(-2).map((item) => item.label)).toEqual([
      '旅遊保險',
      '嬰幼兒安全座椅',
    ])
  })

  it('rejects occupancies outside the approved 2–18 person tables', () => {
    expect(() => buildPublishedPackageSnapshot({
      packageId: 'chiang-mai-5d4n',
      adults: 19,
      children: 0,
      infants: 0,
      exchangeRate: 1.1,
    })).toThrow('2–18')
  })

  it('identifies package profiles from either the persisted id or legacy public slug', () => {
    expect(getPublishedPackageId('chiang-mai-5d4n', undefined)).toBe('chiang-mai-5d4n')
    expect(getPublishedPackageId(undefined, 'uao33058')).toBe('chiang-rai-2d1n')
    expect(getPublishedPackageId(undefined, 'not-a-package')).toBeNull()
  })

  it('keeps the public traveler label in sync with the edited family counts', () => {
    expect(formatPackageTravelerLabel(3, 0, 0)).toBe('3 位成人')
    expect(formatPackageTravelerLabel(4, 2, 1)).toBe(
      '4 大＋2 小（3–11 歲）＋1 嬰（0–2 歲）'
    )
  })

  it('blocks price-structure changes while allowing names and dates to change', () => {
    const original = {
      includeGuide: true,
      includeAccommodation: false,
      includeMeals: false,
      outboundStayEnabled: false,
      outboundStayPerNight: 750,
      outboundStayNights: 0,
      outboundStayRooms: 0,
      carFees: [
        { day: 'D1', date: '', name: '接機＋市區', type: 'city', cost: 2_700, price: 4_000 },
      ],
    }
    const copyOnlyChange = {
      ...original,
      carFees: [
        { ...original.carFees[0], date: '7/20', name: '接機＋古城散步' },
      ],
    }
    const tierChange = {
      ...original,
      carFees: [
        { ...original.carFees[0], type: 'chiangrai' },
      ],
    }

    expect(getPublishedPackageStructureIssue(original, copyOnlyChange)).toBeNull()
    expect(getPublishedPackageStructureIssue(original, tierChange)).toContain('車型／路線級距')
    expect(getPublishedPackageStructureIssue(original, {
      ...copyOnlyChange,
      outboundStayEnabled: true,
      outboundStayNights: 1,
      outboundStayRooms: 2,
    })).toContain('司導外宿')
  })
})
