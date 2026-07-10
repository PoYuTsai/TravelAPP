import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const nextConfig = require('../../../next.config.js')

describe('public-site Content Security Policy', () => {
  it('allows the Google Ads collection host used by the live tag', async () => {
    const rules = await nextConfig.headers()
    const globalRule = rules.find((rule: { source: string }) => rule.source === '/(.*)')
    const csp = globalRule?.headers.find(
      (header: { key: string }) => header.key === 'Content-Security-Policy',
    )?.value

    expect(csp).toContain('https://ad.doubleclick.net')
  })
})
