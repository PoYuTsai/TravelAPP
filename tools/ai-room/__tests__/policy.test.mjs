import { describe, expect, it } from 'vitest'

import { assessSessionAccess } from '../policy.mjs'

describe('AI room write policy', () => {
  it('allows reads without locks for configured sessions', () => {
    expect(
      assessSessionAccess({
        focus: 'travel',
        session: 'dc-travel',
        operation: 'read',
      })
    ).toEqual({
      allowed: true,
      requiresLock: false,
      lockMode: 'none',
      reason: undefined,
      warning:
        'dc-travel is reserved for legacy/project-channel monitoring; private room writes require explicit unlock.',
    })
  })

  it('allows writes only to the active rc session for the current focus', () => {
    expect(
      assessSessionAccess({
        focus: 'travel',
        session: 'rc-travel',
        operation: 'write',
      })
    ).toEqual({
      allowed: true,
      requiresLock: true,
      lockMode: 'write',
      reason: undefined,
      warning: undefined,
    })
  })

  it('denies writes to dc-travel by default', () => {
    const access = assessSessionAccess({
      focus: 'travel',
      session: 'dc-travel',
      operation: 'write',
    })

    expect(access.allowed).toBe(false)
    expect(access.requiresLock).toBe(false)
    expect(access.lockMode).toBe('none')
    expect(access.reason).toContain('private room writes only to the active rc session')
    expect(access.warning).toContain('dc-travel')
  })

  it('denies writes to dc-vibesync with the partner-channel collision warning', () => {
    const access = assessSessionAccess({
      focus: 'vibesync',
      session: 'dc-vibesync',
      operation: 'write',
    })

    expect(access.allowed).toBe(false)
    expect(access.warning).toContain('legacy partner project channel')
  })

  it('denies writes to another project active rc session when focus differs', () => {
    const access = assessSessionAccess({
      focus: 'travel',
      session: 'rc-vibesync',
      operation: 'write',
    })

    expect(access.allowed).toBe(false)
    expect(access.reason).toContain('does not match current focus')
  })

  it('requires an exclusive lock for active rc rebind', () => {
    expect(
      assessSessionAccess({
        focus: 'travel',
        session: 'rc-travel',
        operation: 'rebind',
      })
    ).toEqual({
      allowed: true,
      requiresLock: true,
      lockMode: 'exclusive',
      reason: undefined,
      warning: 'rebind requires Eric confirmation before kill/new tmux actions',
    })
  })

  it('denies unknown sessions for private-room writes', () => {
    const access = assessSessionAccess({
      focus: 'travel',
      session: 'manual-debug',
      operation: 'write',
    })

    expect(access.allowed).toBe(false)
    expect(access.reason).toContain('Unknown tmux session')
  })
})
