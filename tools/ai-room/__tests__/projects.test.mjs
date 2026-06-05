import { describe, expect, it } from 'vitest'

import {
  PROJECTS,
  getProjectConfig,
  listProjectKeys,
} from '../projects.mjs'

describe('AI room project mapping', () => {
  it('maps TravelAPP to a private rc session and read-only dc session', () => {
    const travel = getProjectConfig('travel')

    expect(travel.project).toBe('TravelAPP')
    expect(travel.workspace).toBe('C:/Users/eric1/OneDrive/Desktop/TravelAPP')
    expect(travel.activeSession).toBe('rc-travel')
    expect(travel.legacySession).toBe('dc-travel')
    expect(travel.sessions['rc-travel'].owner).toBe('private-room')
    expect(travel.sessions['rc-travel'].privateRoomAccess).toBe('write')
    expect(travel.sessions['dc-travel'].owner).toBe('legacy-dc')
    expect(travel.sessions['dc-travel'].privateRoomAccess).toBe('read')
  })

  it('maps VibeSync to rc-vibesync and marks dc-vibesync as partner-collab read-only', () => {
    const vibesync = getProjectConfig('vibesync')

    expect(vibesync.project).toBe('VibeSync')
    expect(vibesync.workspace).toBe('C:/Users/eric1/OneDrive/Desktop/VibeSync')
    expect(vibesync.activeSession).toBe('rc-vibesync')
    expect(vibesync.legacySession).toBe('dc-vibesync')
    expect(vibesync.sessions['rc-vibesync'].owner).toBe('private-room')
    expect(vibesync.sessions['rc-vibesync'].privateRoomAccess).toBe('write')
    expect(vibesync.sessions['dc-vibesync'].owner).toBe('legacy-dc')
    expect(vibesync.sessions['dc-vibesync'].privateRoomAccess).toBe('read')
    expect(vibesync.sessions['dc-vibesync'].warning).toContain('partner')
  })

  it('exposes only the two supported focus keys for now', () => {
    expect(listProjectKeys()).toEqual(['travel', 'vibesync'])
    expect(Object.isFrozen(PROJECTS)).toBe(true)
  })

  it('rejects unknown focus keys with a clear error', () => {
    expect(() => getProjectConfig('unknown')).toThrow(/Unknown AI room focus/)
  })
})
