import { describe, expect, it } from 'vitest'

import nextConfig from '../../../next.config.js'

describe('site Content-Security-Policy', () => {
  it('allows Google Ads conversion requests to ad.doubleclick.net', async () => {
    const headerGroups = await nextConfig.headers?.()
    const siteHeaders = headerGroups?.find((group) => group.source === '/(.*)')
    const csp = siteHeaders?.headers.find(
      (header) => header.key === 'Content-Security-Policy',
    )?.value

    expect(csp).toContain('connect-src')
    expect(csp).toContain('https://ad.doubleclick.net')
  })
})
