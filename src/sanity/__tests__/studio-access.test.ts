import { describe, expect, it } from 'vitest'

import { getStudioToolTitle, getVisibleStudioToolNames, isRestrictedStudioEmail } from '@/sanity/studio-access'

describe('studio access helper', () => {
  it('treats the two collaborator emails as restricted users', () => {
    expect(isRestrictedStudioEmail('lyc32580@gmail.com')).toBe(true)
    expect(isRestrictedStudioEmail('moon12sun20@gmail.com')).toBe(true)
    expect(isRestrictedStudioEmail('MOON12SUN20@GMAIL.COM')).toBe(true)
    expect(isRestrictedStudioEmail('eric19921204@gmail.com')).toBe(false)
  })

  it('shows only structure and the formal pricing tool to restricted users', () => {
    expect(getVisibleStudioToolNames('lyc32580@gmail.com')).toEqual(['structure', 'pricing-formal'])
    expect(getVisibleStudioToolNames('moon12sun20@gmail.com')).toEqual(['structure', 'pricing-formal'])
  })

  it('keeps the full tool list for unrestricted users', () => {
    expect(getVisibleStudioToolNames('eric19921204@gmail.com')).toEqual([
      'structure',
      'dashboard',
      'accounting',
      'pricing',
      'pricing-formal',
    ])
  })

  it('returns the requested studio titles', () => {
    expect(getStudioToolTitle('structure')).toBe('Structure')
    expect(getStudioToolTitle('dashboard')).toBe('Dashboard 測試1')
    expect(getStudioToolTitle('accounting')).toBe('Calculate 測試2')
    expect(getStudioToolTitle('pricing')).toBe('報價計算測試v1')
    expect(getStudioToolTitle('pricing-formal')).toBe('報價計算(正式版)')
  })
})
