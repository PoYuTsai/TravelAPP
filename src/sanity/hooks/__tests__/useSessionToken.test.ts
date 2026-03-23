import { afterEach, describe, expect, it, vi } from 'vitest'

import { extractSanityTokenFromAuthState, getStoredSanityToken } from '../useSessionToken'

describe('useSessionToken helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('extracts the token from auth state when present', () => {
    expect(extractSanityTokenFromAuthState({ token: 'studio-token' })).toBe('studio-token')
    expect(
      extractSanityTokenFromAuthState({
        authState: {
          token: 'nested-studio-token',
        },
      })
    ).toBe('nested-studio-token')
    expect(extractSanityTokenFromAuthState({ token: '   ' })).toBeNull()
    expect(extractSanityTokenFromAuthState(null)).toBeNull()
  })

  it('reads the project-scoped studio token from localStorage', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn((key: string) => {
          if (key === '__studio_auth_token_your-project-id') {
            return JSON.stringify({ token: 'scoped-token' })
          }

          return null
        }),
      },
    })

    expect(getStoredSanityToken()).toBe('scoped-token')
  })

  it('falls back to the legacy sanity auth token key', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn((key: string) => {
          if (key === '__sanity_auth_token') {
            return JSON.stringify({ token: 'legacy-token' })
          }

          return null
        }),
      },
    })

    expect(getStoredSanityToken()).toBe('legacy-token')
  })
})
