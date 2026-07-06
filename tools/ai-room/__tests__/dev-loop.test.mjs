import { describe, expect, it } from 'vitest'

import {
  createDevLoop,
  HARD_GATE_REASONS,
} from '../dev-loop.mjs'

describe('autonomous dev loop', () => {
  it('creates a non-writing ambient support plan for unmentioned private-room questions', () => {
    const loop = createDevLoop({
      focus: 'travel',
      activeSession: 'rc-travel',
      request: '我覺得這個系統有點複雜，怕失控',
      maxAgentTurns: 2,
    })

    expect(loop.state).toBe('queued')
    expect(loop.maxAgentTurns).toBe(2)
    expect(loop.steps).toEqual([
      {
        actor: 'codex',
        action: 'ambient_support',
        targetSession: null,
        requiresWrite: false,
      },
      {
        actor: 'cc',
        action: 'practical_reassurance',
        targetSession: null,
        requiresWrite: false,
      },
    ])
  })

  it('creates an implement-review-fix loop with bounded turns', () => {
    const loop = createDevLoop({
      focus: 'travel',
      activeSession: 'rc-travel',
      request: '@cc 實作完請 @codex review，小問題自己修',
      maxAgentTurns: 3,
    })

    expect(loop.state).toBe('queued')
    expect(loop.steps).toEqual([
      {
        actor: 'cc',
        action: 'implement',
        targetSession: 'rc-travel',
        requiresWrite: true,
      },
      {
        actor: 'cc',
        action: 'round',
        targetSession: 'rc-travel',
        requiresWrite: true,
      },
      {
        actor: 'codex',
        action: 'review',
        targetSession: null,
        requiresWrite: false,
      },
      {
        actor: 'cc',
        action: 'fix_minor_issues',
        targetSession: 'rc-travel',
        requiresWrite: true,
      },
    ])
    expect(loop.maxAgentTurns).toBe(3)
  })

  it('creates a discussion loop that ends with Codex convergence', () => {
    const loop = createDevLoop({
      focus: 'travel',
      activeSession: 'rc-travel',
      request: '@cc @codex 互相挑問題，最多 2 輪',
      maxAgentTurns: 2,
    })

    expect(loop.steps).toEqual([
      { actor: 'cc', action: 'perspective', targetSession: null, requiresWrite: false },
      { actor: 'codex', action: 'review_perspective', targetSession: null, requiresWrite: false },
      { actor: 'codex', action: 'converge', targetSession: null, requiresWrite: false },
    ])
  })

  it('stops before starting when a hard gate is present', () => {
    const loop = createDevLoop({
      focus: 'travel',
      activeSession: 'rc-travel',
      request: '@cc deploy 到 production',
      maxAgentTurns: 3,
    })

    expect(loop.state).toBe('blocked')
    expect(loop.blockers).toContain(HARD_GATE_REASONS.production)
    expect(loop.steps).toEqual([])
  })

  it('does not allow commit/push without explicit authorization', () => {
    const loop = createDevLoop({
      focus: 'travel',
      activeSession: 'rc-travel',
      request: '@cc 實作後 commit push',
      maxAgentTurns: 3,
      shipMode: 'manual',
    })

    expect(loop.state).toBe('blocked')
    expect(loop.blockers).toContain(HARD_GATE_REASONS.commitPush)
  })

  it('allows commit/push when autopilot_ship is explicitly set', () => {
    const loop = createDevLoop({
      focus: 'travel',
      activeSession: 'rc-travel',
      request: '@cc 實作後 commit push',
      maxAgentTurns: 3,
      shipMode: 'autopilot_ship',
    })

    expect(loop.state).toBe('queued')
    expect(loop.steps.at(-1)).toEqual({
      actor: 'cc',
      action: 'commit_push',
      targetSession: 'rc-travel',
      requiresWrite: true,
    })
  })
})
