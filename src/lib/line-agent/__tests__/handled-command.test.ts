/**
 * handled-command.test.ts — `@bot done <caseId>` ack（design 2026-06-10 §3 刀1）.
 *
 * 鎖住：
 *   - parser：done 必須是獨立 token＋caseId；一般聊天永不誤觸
 *   - handler：store.put + audit；查無 case 回固定訊息不 throw
 *   - router：夥伴群 tagged「done <caseId>」→ action mark_handled、ack 文字；
 *     OA 客人訊息永遠進不了這條路（B3 先攔）
 *   - send gate：mark_handled 的 ack 允許送回夥伴群
 */

import { describe, expect, it } from 'vitest'
import { parseCaseDoneCommand, markCaseHandled } from '../cases/handled-command'
import { MemoryStore } from '../storage/memory-store'
import { createInitialCase } from '../cases/case-state'
import { routeCommand } from '../commands/router'
import { safeDefaultLlmClassifier } from '../commands/intent'
import { shouldReplyToPartnerGroup } from '../line/partner-reply-gate'
import type { NormalizedLineEvent } from '../line/event-normalizer'

const NOW = '2026-06-11T10:00:00.000Z'

async function seededStore(caseId = 'CW-0611-001') {
  const store = new MemoryStore()
  await store.put(
    createInitialCase({
      caseId,
      lineUserId: 'U-customer',
      customerDisplayName: '王小姐',
      now: '2026-06-11T05:00:00.000Z',
    })
  )
  return store
}

describe('parseCaseDoneCommand', () => {
  it('matches "done <caseId>"（前面帶 @bot 文字也吃得到）', () => {
    expect(parseCaseDoneCommand('done CW-0611-001')).toBe('CW-0611-001')
    expect(parseCaseDoneCommand('@bot done CW-0611-001')).toBe('CW-0611-001')
    expect(parseCaseDoneCommand('@bot done CW-0611-001 謝謝')).toBe('CW-0611-001')
  })

  it('never matches casual chat / done 無 caseId / 內嵌字', () => {
    expect(parseCaseDoneCommand('今天行程都 done 了嗎')).toBeNull()
    expect(parseCaseDoneCommand('done')).toBeNull()
    expect(parseCaseDoneCommand('welldone CW-0611-001')).toBeNull()
    expect(parseCaseDoneCommand('')).toBeNull()
  })
})

describe('markCaseHandled', () => {
  it('寫入 handledAt/handledBy ＋ audit，回 ack 文字', async () => {
    const store = await seededStore()
    const result = await markCaseHandled({
      store,
      caseId: 'CW-0611-001',
      actor: 'U-partner',
      now: NOW,
    })
    expect(result.ok).toBe(true)
    expect(result.replyText).toContain('CW-0611-001')
    expect(result.replyText).toContain('已處理')

    const stored = await store.get('CW-0611-001')
    expect(stored?.handledAt).toBe(NOW)
    expect(stored?.handledBy).toBe('U-partner')
    const audit = await store.getAudit('CW-0611-001')
    expect(audit.some((e) => e.eventType === 'case_handled')).toBe(true)
  })

  it('查無 case → ok=false 固定訊息，不 throw、不寫入', async () => {
    const store = new MemoryStore()
    const result = await markCaseHandled({
      store,
      caseId: 'CW-9999-999',
      actor: 'U-partner',
      now: NOW,
    })
    expect(result.ok).toBe(false)
    expect(result.replyText).toContain('找不到 case CW-9999-999')
  })
})

describe('routeCommand — 夥伴群 done 路徑', () => {
  function groupEvent(text: string): NormalizedLineEvent {
    return {
      kind: 'group_text',
      sourceChannel: 'line_partner_group',
      lineUserId: 'U-partner',
      messageId: 'msg-done-1',
      timestamp: Date.parse(NOW),
      text,
      mentionsBot: true,
      replyToken: 'rt-1',
    } as NormalizedLineEvent
  }

  it('tagged「done <caseId>」→ mark_handled，store 已更新，ack 過 send gate', async () => {
    const store = await seededStore()
    const event = groupEvent('@bot done CW-0611-001')
    const decision = await routeCommand({ event, store, llmClassifier: safeDefaultLlmClassifier })

    expect(decision.action).toBe('mark_handled')
    expect(decision.handlerResult?.outboundText).toContain('CW-0611-001')
    expect(decision.handlerResult?.meta?.handled).toBe(true)

    const stored = await store.get('CW-0611-001')
    expect(stored?.handledAt).toBe(NOW)
    expect(stored?.handledBy).toBe('U-partner')

    // ack 回覆允許送回夥伴群（operator 側，永不觸及 OA 客人）
    expect(shouldReplyToPartnerGroup(event, decision, true)).toBe(true)
  })

  it('查無 caseId → mark_handled + 找不到訊息（status error），仍可回群告知', async () => {
    const store = new MemoryStore()
    const event = groupEvent('@bot done CW-0000-000')
    const decision = await routeCommand({ event, store, llmClassifier: safeDefaultLlmClassifier })
    expect(decision.action).toBe('mark_handled')
    expect(decision.handlerResult?.status).toBe('error')
    expect(decision.handlerResult?.outboundText).toContain('找不到 case')
  })

  it('未 tag 的「done」聊天 → 不進 done 路徑（casual chat 照舊 silent）', async () => {
    const store = await seededStore()
    const event = {
      ...groupEvent('done CW-0611-001'),
      mentionsBot: false,
    } as NormalizedLineEvent
    const decision = await routeCommand({ event, store, llmClassifier: safeDefaultLlmClassifier })
    expect(decision.action).toBe('silent')
    const stored = await store.get('CW-0611-001')
    expect(stored?.handledAt).toBeUndefined()
  })

  it('OA 客人訊息含 done 字樣 → 走 B3 case 持久化，永不 mark_handled', async () => {
    const store = await seededStore()
    const event = {
      kind: 'oa_text',
      sourceChannel: 'line_oa',
      lineUserId: 'U-customer',
      messageId: 'msg-oa-1',
      timestamp: Date.parse(NOW),
      text: 'done CW-0611-001',
      mentionsBot: false,
    } as NormalizedLineEvent
    const decision = await routeCommand({ event, store, llmClassifier: safeDefaultLlmClassifier })
    expect(decision.action).not.toBe('mark_handled')
    const stored = await store.get('CW-0611-001')
    expect(stored?.handledAt).toBeUndefined()
  })
})
