/**
 * partner-aliases.test.ts — Eric 2026-06-07.
 *
 * The partner group has known operating partners whose LINE display names differ
 * from how Eric refers to them. The bot must know these are OPERATING PARTNERS
 * (the customer-facing window), NOT customers:
 *   - Lulu  → LINE display name 「宜 如果 乾」
 *   - 彥均  → LINE display name 「Chun」
 */

import { describe, it, expect } from 'vitest'
import {
  resolvePartnerAlias,
  isOperatingPartner,
  PARTNER_ALIASES,
} from '@/lib/line-agent/partner-group/partner-aliases'

describe('partner aliases — operating partners are not customers', () => {
  it('resolves Lulu from the LINE display name 「宜 如果 乾」', () => {
    const r = resolvePartnerAlias('宜 如果 乾')
    expect(r?.canonical).toBe('Lulu')
    expect(r?.isOperatingPartner).toBe(true)
  })

  it('resolves 彥均 from the LINE display name 「Chun」 (case-insensitive)', () => {
    expect(resolvePartnerAlias('Chun')?.canonical).toBe('彥均')
    expect(resolvePartnerAlias('chun')?.canonical).toBe('彥均')
  })

  it('tolerates surrounding whitespace and collapsed inner spaces', () => {
    expect(resolvePartnerAlias('  宜  如果  乾 ')?.canonical).toBe('Lulu')
  })

  it('returns null for an unknown display name (treated as a customer, not a partner)', () => {
    expect(resolvePartnerAlias('王小明')).toBeNull()
    expect(isOperatingPartner('王小明')).toBe(false)
  })

  it('isOperatingPartner is true for a known operating partner', () => {
    expect(isOperatingPartner('Chun')).toBe(true)
  })

  it('PARTNER_ALIASES covers both operating partners', () => {
    const canon = PARTNER_ALIASES.map((p) => p.canonical)
    expect(canon).toContain('Lulu')
    expect(canon).toContain('彥均')
  })
})
