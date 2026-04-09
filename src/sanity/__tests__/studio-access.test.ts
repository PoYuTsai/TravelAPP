import { describe, expect, it } from 'vitest'

import {
  canAccessStudioTool,
  getStudioToolTitle,
  getVisibleStudioToolNames,
  hasFullStudioAccess,
  isRestrictedStudioEmail,
} from '@/sanity/studio-access'

describe('studio access helper', () => {
  it('treats the two collaborator emails as restricted users', () => {
    expect(isRestrictedStudioEmail('lyc32580@gmail.com')).toBe(true)
    expect(isRestrictedStudioEmail('moon12sun20@yahoo.com.tw')).toBe(true)
    expect(isRestrictedStudioEmail('MOON12SUN20@YAHOO.COM.TW')).toBe(true)
    expect(isRestrictedStudioEmail('moon12sun20@gmail.com')).toBe(false)
    expect(isRestrictedStudioEmail('eric19921204@gmail.com')).toBe(false)
  })

  it('grants full access only to the owner allowlist', () => {
    expect(hasFullStudioAccess('eric19921204@gmail.com')).toBe(true)
    expect(hasFullStudioAccess('lyc32580@gmail.com')).toBe(false)
    expect(hasFullStudioAccess('moon12sun20@yahoo.com.tw')).toBe(false)
    expect(hasFullStudioAccess('someone-else@example.com')).toBe(false)
    expect(hasFullStudioAccess(undefined)).toBe(false)
  })

  it('shows only structure and the formal pricing tool to restricted users and unknown users', () => {
    expect(getVisibleStudioToolNames('lyc32580@gmail.com')).toEqual(['structure', 'pricing-formal'])
    expect(getVisibleStudioToolNames('moon12sun20@yahoo.com.tw')).toEqual(['structure', 'pricing-formal'])
    expect(getVisibleStudioToolNames('someone-else@example.com')).toEqual(['structure', 'pricing-formal'])
    expect(getVisibleStudioToolNames(undefined)).toEqual(['structure', 'pricing-formal'])
  })

  it('keeps the full tool list only for full-access users', () => {
    expect(getVisibleStudioToolNames('eric19921204@gmail.com')).toEqual([
      'structure',
      'dashboard',
      'accounting',
      'pricing',
      'pricing-formal',
    ])
  })

  it('can evaluate direct tool access for hard-gated tools', () => {
    expect(canAccessStudioTool('dashboard', 'eric19921204@gmail.com')).toBe(true)
    expect(canAccessStudioTool('accounting', 'eric19921204@gmail.com')).toBe(true)
    expect(canAccessStudioTool('pricing', 'eric19921204@gmail.com')).toBe(true)
    expect(canAccessStudioTool('pricing-formal', 'eric19921204@gmail.com')).toBe(true)

    expect(canAccessStudioTool('dashboard', 'lyc32580@gmail.com')).toBe(false)
    expect(canAccessStudioTool('accounting', 'moon12sun20@yahoo.com.tw')).toBe(false)
    expect(canAccessStudioTool('pricing', 'someone-else@example.com')).toBe(false)
    expect(canAccessStudioTool('structure', 'someone-else@example.com')).toBe(true)
    expect(canAccessStudioTool('pricing-formal', 'someone-else@example.com')).toBe(true)
  })

  it('returns the requested studio titles', () => {
    expect(getStudioToolTitle('structure')).toBe('Structure')
    expect(getStudioToolTitle('dashboard')).toBe('Dashboard 測試1')
    expect(getStudioToolTitle('accounting')).toBe('Calculate 測試2')
    expect(getStudioToolTitle('pricing')).toBe('報價計算測試v1')
    expect(getStudioToolTitle('pricing-formal')).toBe('報價計算(正式版)')
  })
})
