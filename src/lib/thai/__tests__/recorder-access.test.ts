import { describe, expect, it } from 'vitest'
import { canUseThaiRecorder } from '../recorder-access'

describe('canUseThaiRecorder', () => {
  it('allows the recorder while developing locally', () => {
    expect(canUseThaiRecorder({ nodeEnv: 'development' })).toBe(true)
  })

  it('hides and blocks the recorder in production by default', () => {
    expect(canUseThaiRecorder({ nodeEnv: 'production' })).toBe(false)
  })

  it('can be explicitly enabled in production for a controlled internal deploy', () => {
    expect(canUseThaiRecorder({ nodeEnv: 'production', recorderEnabled: 'true' })).toBe(true)
  })
})
