import { describe, expect, it } from 'vitest'

import { buildSessionInventory } from '../session-inventory.mjs'

describe('session inventory', () => {
  it('labels active, legacy, missing, and unknown sessions for the current focus', () => {
    const inventory = buildSessionInventory({
      focus: 'travel',
      liveSessions: ['rc-travel', 'dc-vibesync'],
    })

    expect(inventory).toEqual([
      {
        session: 'rc-travel',
        project: 'TravelAPP',
        role: 'active',
        status: 'present',
        privateRoomAccess: 'write',
        warning: undefined,
      },
      {
        session: 'dc-travel',
        project: 'TravelAPP',
        role: 'legacy',
        status: 'missing',
        privateRoomAccess: 'read',
        warning:
          'dc-travel is reserved for legacy/project-channel monitoring; private room writes require explicit unlock.',
      },
      {
        session: 'rc-vibesync',
        project: 'VibeSync',
        role: 'other-project-active',
        status: 'missing',
        privateRoomAccess: 'write',
        warning: undefined,
      },
      {
        session: 'dc-vibesync',
        project: 'VibeSync',
        role: 'other-project-legacy',
        status: 'present',
        privateRoomAccess: 'read',
        warning:
          'dc-vibesync may be monitored or controlled by the legacy partner project channel; private room writes require explicit unlock.',
      },
    ])
  })

  it('includes unknown live sessions without granting private-room write access', () => {
    const inventory = buildSessionInventory({
      focus: 'travel',
      liveSessions: ['rc-travel', 'manual-debug'],
    })

    expect(inventory.at(-1)).toEqual({
      session: 'manual-debug',
      project: 'unknown',
      role: 'unknown',
      status: 'present',
      privateRoomAccess: 'none',
      warning: 'unknown tmux session; private room must not write to it',
    })
  })
})
