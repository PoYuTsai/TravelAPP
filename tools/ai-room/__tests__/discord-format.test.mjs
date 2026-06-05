import { describe, expect, it } from 'vitest'

import {
  formatDiscordActionResult,
  formatDiscordHealth,
  formatDiscordInventory,
} from '../discord-format.mjs'

describe('Discord AI room formatting', () => {
  it('labels session inventory for Discord without full logs', () => {
    const text = formatDiscordInventory({
      focus: 'travel',
      inventory: [
        {
          session: 'rc-travel',
          project: 'TravelAPP',
          role: 'active',
          status: 'present',
          privateRoomAccess: 'write',
        },
        {
          session: 'dc-vibesync',
          project: 'VibeSync',
          role: 'other-project-legacy',
          status: 'present',
          privateRoomAccess: 'read',
          warning: 'legacy partner project channel warning',
        },
      ],
    })

    expect(text).toContain('[Room/focus] travel')
    expect(text).toContain('OK rc-travel | TravelAPP | active | write')
    expect(text).toContain('warning: legacy partner project channel warning')
  })

  it('formats health with blockers and warnings', () => {
    const text = formatDiscordHealth({
      sessionHealth: 'tmux_only',
      summary: 'rc-travel present for TravelAPP',
      blockers: [],
      warnings: ['desktop bind not confirmed'],
    })

    expect(text).toContain('[Room/health] tmux_only')
    expect(text).toContain('rc-travel present for TravelAPP')
    expect(text).toContain('warning: desktop bind not confirmed')
  })

  it('formats lifecycle action results with actor/session labels', () => {
    const text = formatDiscordActionResult({
      label: 'CC/rc-travel',
      result: {
        action: 'round',
        session: 'rc-travel',
        prompt: '/round',
        lockMode: 'write',
      },
    })

    expect(text).toContain('[CC/rc-travel] round')
    expect(text).toContain('prompt: /round')
    expect(text).toContain('lock: write')
  })
})
