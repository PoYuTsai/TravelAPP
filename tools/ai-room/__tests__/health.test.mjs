import { describe, expect, it } from 'vitest'

import { buildHealthReport, normalizeWorkspacePath } from '../health.mjs'

describe('AI room health', () => {
  it('normalizes Windows and WSL workspace paths to the same key', () => {
    expect(
      normalizeWorkspacePath('C:/Users/eric1/OneDrive/Desktop/TravelAPP')
    ).toBe('/mnt/c/users/eric1/onedrive/desktop/travelapp')
    expect(
      normalizeWorkspacePath('/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP')
    ).toBe('/mnt/c/users/eric1/onedrive/desktop/travelapp')
  })

  it('reports tmux_only when the active session exists but desktop bind is not confirmed', () => {
    const report = buildHealthReport({
      focus: 'travel',
      liveSessions: ['rc-travel', 'dc-travel'],
      cwdBySession: {
        'rc-travel': '/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP',
      },
      desktopBindConfirmed: false,
    })

    expect(report.sessionHealth).toBe('tmux_only')
    expect(report.summary).toContain('rc-travel present')
    expect(report.warnings).toContain(
      'desktop Claude Code bind is not confirmed'
    )
    expect(report.warnings).toContain(
      'dc-travel is reserved for legacy/project-channel monitoring; private room writes require explicit unlock.'
    )
  })

  it('reports healthy when active session, cwd, and desktop bind are confirmed', () => {
    const report = buildHealthReport({
      focus: 'travel',
      liveSessions: ['rc-travel'],
      cwdBySession: {
        'rc-travel': 'C:\\Users\\eric1\\OneDrive\\Desktop\\TravelAPP',
      },
      desktopBindConfirmed: true,
    })

    expect(report.sessionHealth).toBe('healthy')
    expect(report.blockers).toEqual([])
  })

  it('reports needs_rebind when the active rc session is missing', () => {
    const report = buildHealthReport({
      focus: 'vibesync',
      liveSessions: ['dc-vibesync'],
      cwdBySession: {},
      desktopBindConfirmed: false,
    })

    expect(report.sessionHealth).toBe('needs_rebind')
    expect(report.blockers).toContain('active session rc-vibesync is missing')
  })

  it('reports cwd mismatch as a blocker', () => {
    const report = buildHealthReport({
      focus: 'travel',
      liveSessions: ['rc-travel'],
      cwdBySession: {
        'rc-travel': '/mnt/c/Users/eric1/OneDrive/Desktop/VibeSync',
      },
      desktopBindConfirmed: true,
    })

    expect(report.sessionHealth).toBe('needs_rebind')
    expect(report.blockers[0]).toContain('cwd mismatch')
  })
})
