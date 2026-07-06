import { describe, expect, it } from 'vitest'

import { routeRoomIntent } from '../intent-router.mjs'

describe('AI room intent router', () => {
  it('routes unmentioned private-room chatter to ambient support with no tmux write', () => {
    expect(routeRoomIntent('我有點怕這個系統越做越複雜')).toEqual({
      responder: 'ambient',
      intent: 'ambient_chat',
      body: '我有點怕這個系統越做越複雜',
      startsLoop: false,
      maxAgentTurns: 2,
      requiresWrite: false,
    })
  })

  it('routes @codex questions to Codex only', () => {
    expect(routeRoomIntent('@codex 你先判斷這個架構')).toEqual({
      responder: 'codex',
      intent: 'plan',
      body: '你先判斷這個架構',
      startsLoop: false,
    })
  })

  it('routes @cc implementation requests to CC only', () => {
    expect(routeRoomIntent('@cc 實作這個 plan')).toEqual({
      responder: 'cc',
      intent: 'implement',
      body: '實作這個 plan',
      startsLoop: false,
    })
  })

  it('routes dual mentions to a bounded discussion loop', () => {
    expect(routeRoomIntent('@cc @codex 一起討論，最多 3 輪')).toEqual({
      responder: 'loop',
      intent: 'discuss',
      body: '一起討論，最多 3 輪',
      startsLoop: true,
      maxAgentTurns: 3,
    })
  })

  it('detects implement-then-review handoff requests', () => {
    expect(
      routeRoomIntent('@cc 實作完請 @codex review，小問題自己修')
    ).toEqual({
      responder: 'loop',
      intent: 'implement_review_fix',
      body: '實作完請 review，小問題自己修',
      startsLoop: true,
      maxAgentTurns: 3,
    })
  })

  it('caps requested loop turns at five', () => {
    expect(routeRoomIntent('@cc @codex 討論最多 20 輪')).toMatchObject({
      responder: 'loop',
      maxAgentTurns: 5,
    })
  })
})
