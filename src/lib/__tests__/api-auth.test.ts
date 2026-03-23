import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_DASHBOARD_ALLOWED_EMAILS = process.env.DASHBOARD_ALLOWED_EMAILS

describe('api-auth dashboard allowlist', () => {
  afterEach(() => {
    if (typeof ORIGINAL_DASHBOARD_ALLOWED_EMAILS === 'string') {
      process.env.DASHBOARD_ALLOWED_EMAILS = ORIGINAL_DASHBOARD_ALLOWED_EMAILS
    } else {
      delete process.env.DASHBOARD_ALLOWED_EMAILS
    }
    vi.resetModules()
  })

  it('always allows eric primary email for dashboard access', async () => {
    delete process.env.DASHBOARD_ALLOWED_EMAILS
    vi.resetModules()

    const { isDashboardEmailAllowed } = await import('@/lib/api-auth')

    expect(isDashboardEmailAllowed('eric19921204@gmail.com')).toBe(true)
    expect(isDashboardEmailAllowed('ERIC19921204@GMAIL.COM')).toBe(true)
  })
})
