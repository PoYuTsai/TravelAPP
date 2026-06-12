import { describe, it, expect } from 'vitest'
import { parseApprovalIntentJson } from '../distill/approval-intent'

describe('parseApprovalIntentJson — 零信任', () => {
  it('approve：行號＋信心', () => {
    expect(
      parseApprovalIntentJson('{"action":"approve","indices":[1,3],"confidence":"high"}')
    ).toEqual({ action: 'approve', indices: [1, 3], confidence: 'high' })
  })

  it('approve_all / modify / not_approval', () => {
    expect(parseApprovalIntentJson('{"action":"approve_all","confidence":"low"}')).toEqual({
      action: 'approve_all',
      confidence: 'low',
    })
    expect(
      parseApprovalIntentJson(
        '{"action":"modify","index":2,"newAnswer":"含保險","confidence":"high"}'
      )
    ).toEqual({ action: 'modify', index: 2, newAnswer: '含保險', confidence: 'high' })
    expect(parseApprovalIntentJson('{"action":"not_approval"}')).toEqual({
      action: 'not_approval',
    })
  })

  it('剝 code fence（模型不聽話的常態）', () => {
    expect(
      parseApprovalIntentJson('```json\n{"action":"approve_all","confidence":"high"}\n```')
    ).toEqual({ action: 'approve_all', confidence: 'high' })
  })

  it('垃圾輸入一律 null：非 JSON、enum 外、缺欄位、空 indices、非正整數、modify 空答案', () => {
    expect(parseApprovalIntentJson('我覺得可以收')).toBeNull()
    expect(parseApprovalIntentJson('{"action":"yolo"}')).toBeNull()
    expect(parseApprovalIntentJson('{"action":"approve","confidence":"high"}')).toBeNull()
    expect(
      parseApprovalIntentJson('{"action":"approve","indices":[],"confidence":"high"}')
    ).toBeNull()
    expect(
      parseApprovalIntentJson('{"action":"approve","indices":[0,1.5],"confidence":"high"}')
    ).toBeNull()
    expect(
      parseApprovalIntentJson('{"action":"modify","index":2,"newAnswer":"  ","confidence":"high"}')
    ).toBeNull()
    expect(
      parseApprovalIntentJson('{"action":"approve","indices":[1],"confidence":"maybe"}')
    ).toBeNull()
  })

  it('indices 去重、保序', () => {
    expect(
      parseApprovalIntentJson('{"action":"approve","indices":[3,1,3],"confidence":"high"}')
    ).toEqual({ action: 'approve', indices: [3, 1], confidence: 'high' })
  })
})
