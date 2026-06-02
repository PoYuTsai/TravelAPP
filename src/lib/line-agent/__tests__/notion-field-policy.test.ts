/**
 * notion-field-policy.test.ts
 *
 * Locks the masking boundary for the Notion read adapter. The whole point of
 * this module is that sensitive fields (cost / profit-share / customer name /
 * private full text) can NEVER reach a partner — and operator_only is only a
 * little more open (truncated internal notes + tags + a price bucket), still
 * never raw cost/profit.
 *
 * Whitelist default: any UNKNOWN property is treated as private + never.
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeField,
  classifyField,
  isVisibleTo,
  filterProperties,
  toQuoteTier,
} from '../notion/field-policy'

describe('normalizeField (alias → canonical)', () => {
  it('maps date aliases to canonical "dates"', () => {
    expect(normalizeField('日期')).toBe('dates')
    expect(normalizeField('出發日期')).toBe('dates')
    expect(normalizeField('旅遊日期')).toBe('dates')
  })

  it('accepts a canonical name as-is', () => {
    expect(normalizeField('dates')).toBe('dates')
    expect(normalizeField('cost')).toBe('cost')
  })

  it('returns null for an unknown property', () => {
    expect(normalizeField('客人姓名')).toBeNull()
    expect(normalizeField('某個不存在的欄位')).toBeNull()
  })
})

describe('classifyField', () => {
  it('classifies cost / profit-share as private + never (no audience)', () => {
    for (const name of ['成本', '分潤']) {
      const entry = classifyField(name)
      expect(entry.sensitivity).toBe('private')
      expect(entry.audience).toBe('never')
      expect(isVisibleTo(name, 'partner_group')).toBe(false)
      expect(isVisibleTo(name, 'operator_only')).toBe(false)
    }
  })

  it('classifies 日期 as read_only and visible to partner', () => {
    const entry = classifyField('日期')
    expect(entry.sensitivity).toBe('read_only')
    expect(isVisibleTo('日期', 'partner_group')).toBe(true)
    expect(isVisibleTo('日期', 'operator_only')).toBe(true)
  })

  it('treats an UNKNOWN field as private + never (whitelist default)', () => {
    const entry = classifyField('客人姓名')
    expect(entry.sensitivity).toBe('private')
    expect(entry.audience).toBe('never')
    expect(isVisibleTo('客人姓名', 'partner_group')).toBe(false)
    expect(isVisibleTo('客人姓名', 'operator_only')).toBe(false)
  })

  it('classifies internal notes/tags as operator_only', () => {
    expect(isVisibleTo('內部備註', 'partner_group')).toBe(false)
    expect(isVisibleTo('內部備註', 'operator_only')).toBe(true)
    expect(isVisibleTo('內部標籤', 'partner_group')).toBe(false)
    expect(isVisibleTo('內部標籤', 'operator_only')).toBe(true)
  })
})

describe('filterProperties — partner_group', () => {
  const raw = {
    日期: '4/12-4/16',
    城市區域: '清邁',
    報價總額: 38000,
    內部備註: '客人很在意安全座椅',
    內部標籤: ['親子'],
    成本: 22000,
    分潤: 8000,
    客人姓名: '王先生',
  }

  it('omits cost / profit / name / internal notes / internal tags', () => {
    const { visible, omitted } = filterProperties(raw, 'partner_group')
    // canonical-keyed visible must not carry sensitive keys
    expect('cost' in visible).toBe(false)
    expect('profitShare' in visible).toBe(false)
    expect('internalNotes' in visible).toBe(false)
    expect('internalTags' in visible).toBe(false)
    // omitted reports the RAW property names for transparency
    expect(omitted).toEqual(
      expect.arrayContaining(['成本', '分潤', '客人姓名', '內部備註', '內部標籤'])
    )
  })

  it('keeps shareable fields and buckets the quote total (no exact amount)', () => {
    const { visible } = filterProperties(raw, 'partner_group')
    expect(visible.dates).toBe('4/12-4/16')
    expect(visible.cityArea).toBe('清邁')
    // exact amount must NOT survive — only a bucket
    expect(visible.quoteTotal).toBe('30k-50k')
    expect(visible.quoteTotal).not.toBe(38000)
  })
})

describe('filterProperties — operator_only', () => {
  const longNote = '分'.repeat(200)
  const raw = {
    城市區域: '清邁',
    報價總額: 38000,
    內部備註: longNote,
    內部標籤: ['親子', '高分潤'],
    成本: 22000,
    分潤: 8000,
  }

  it('includes internal tags and a truncated internal note (<=120 chars)', () => {
    const { visible } = filterProperties(raw, 'operator_only')
    expect(visible.internalTags).toEqual(['親子', '高分潤'])
    expect(typeof visible.internalNotes).toBe('string')
    expect((visible.internalNotes as string).length).toBeLessThanOrEqual(120)
  })

  it('still omits raw cost / profit-share', () => {
    const { visible, omitted } = filterProperties(raw, 'operator_only')
    expect('cost' in visible).toBe(false)
    expect('profitShare' in visible).toBe(false)
    expect(omitted).toEqual(expect.arrayContaining(['成本', '分潤']))
  })
})

describe('toQuoteTier (per 10k THB buckets)', () => {
  it('buckets amounts correctly', () => {
    expect(toQuoteTier(15000)).toBe('10k-20k')
    expect(toQuoteTier(50000)).toBe('50k+')
    expect(toQuoteTier(9999)).toBe('<10k')
    expect(toQuoteTier(38000)).toBe('30k-50k')
    expect(toQuoteTier(25000)).toBe('20k-30k')
  })

  it('returns "unknown" for missing values', () => {
    expect(toQuoteTier(undefined)).toBe('unknown')
    expect(toQuoteTier(null)).toBe('unknown')
  })
})
