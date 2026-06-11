/**
 * distill-router.test.ts — 沉澱刀2 router 接線（B1 distill seam 攔截）.
 *
 * 鎖住：
 *   - B1 ＋ seam 注入 ＋「沉澱」指令 → action distill、handlerResult 來自 seam.run
 *   - B1 ＋ 批准語句 → seam.approve；approve 回 null → 落回 responder
 *   - 零行為改變守門：seam 未注入（閘關）→「沉澱」一路走 responder，與 ship 前相同
 *   - 順序：B5 dev 拒絕 > done 指令 > distill > responder；B2 silent 不變
 *   - seam 裸 throw → router 收斂成 distill + status error 固定文案（最後防線）
 *   - send gate：distill 的清單/ack 允許送回夥伴群；空 outboundText 不送
 */

import { describe, expect, it, vi } from 'vitest'
import { routeCommand, type RouterInput } from '../commands/router'
import { safeDefaultLlmClassifier } from '../commands/intent'
import { shouldReplyToPartnerGroup } from '../line/partner-reply-gate'
import { MemoryStore } from '../storage/memory-store'
import { createInitialCase } from '../cases/case-state'
import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { HandlerResult } from '../commands/handlers'
import type { PartnerGroupResponder } from '../partner-group/responder'

const NOW = '2026-06-11T10:00:00.000Z'
const GROUP_ID = 'G-partner-1'

function groupEvent(
  text: string,
  overrides: Partial<NormalizedLineEvent> = {}
): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U-partner',
    messageId: 'msg-distill-1',
    timestamp: Date.parse(NOW),
    text,
    mentionsBot: true,
    replyToken: 'rt-1',
    groupId: GROUP_ID,
    ...overrides,
  } as NormalizedLineEvent
}

const RUN_RESULT: HandlerResult = {
  handler: 'runDistillation',
  status: 'stub_ok',
  outboundText: '這批訊息整理出 2 條候選',
  meta: { candidateCount: 2 },
}

const APPROVE_RESULT: HandlerResult = {
  handler: 'applyDistillApproval',
  status: 'stub_ok',
  outboundText: '已收錄 1️⃣ 3️⃣，其餘略過',
  meta: { approvedIds: [1, 3] },
}

/** Fake seam — 記錄呼叫；router 只管協議，不管 seam 內部解析。 */
function fakeDistillSeam(opts: {
  run?: (groupId: string) => Promise<HandlerResult>
  approve?: (groupId: string, text: string) => Promise<HandlerResult | null>
} = {}) {
  const run = vi.fn(opts.run ?? (async () => RUN_RESULT))
  const approve = vi.fn(opts.approve ?? (async () => null))
  return { run, approve }
}

/** Fake responder — 記錄是否落回 responder 路徑。 */
function fakeResponder() {
  const respond = vi.fn(async () => ({ text: 'responder 回覆' }))
  return { respond } as PartnerGroupResponder & { respond: ReturnType<typeof vi.fn> }
}

function baseInput(
  event: NormalizedLineEvent,
  extra: Partial<RouterInput> = {}
): RouterInput {
  return { event, llmClassifier: safeDefaultLlmClassifier, ...extra }
}

describe('routeCommand — 沉澱刀2 B1 distill 攔截', () => {
  it('「@bot 沉澱」＋ seam 注入 → action distill，run 收到正確 groupId', async () => {
    const distill = fakeDistillSeam()
    const decision = await routeCommand(
      baseInput(groupEvent('@bot 沉澱'), { distill })
    )

    expect(decision.action).toBe('distill')
    expect(decision.handlerResult).toBe(RUN_RESULT)
    expect(distill.run).toHaveBeenCalledTimes(1)
    expect(distill.run).toHaveBeenCalledWith(GROUP_ID)
    expect(distill.approve).not.toHaveBeenCalled()
  })

  it('「@bot 1 3 要」批准語句 → approve(groupId, text) → action distill', async () => {
    const distill = fakeDistillSeam({ approve: async () => APPROVE_RESULT })
    const decision = await routeCommand(
      baseInput(groupEvent('@bot 1 3 要'), { distill })
    )

    expect(decision.action).toBe('distill')
    expect(decision.handlerResult).toBe(APPROVE_RESULT)
    expect(distill.approve).toHaveBeenCalledTimes(1)
    expect(distill.approve).toHaveBeenCalledWith(GROUP_ID, '@bot 1 3 要')
    expect(distill.run).not.toHaveBeenCalled()
  })

  it('approve 回 null（不是批准語句/無 pending）→ 落回 responder', async () => {
    const distill = fakeDistillSeam({ approve: async () => null })
    const responder = fakeResponder()
    const decision = await routeCommand(
      baseInput(groupEvent('@bot 今天行程怎麼排'), {
        distill,
        partnerGroupResponder: responder,
      })
    )

    expect(decision.action).toBe('respond')
    expect(distill.approve).toHaveBeenCalledTimes(1)
    expect(responder.respond).toHaveBeenCalledTimes(1)
  })

  it('零行為改變守門：seam 未注入（閘關）→「@bot 沉澱」一路走 responder', async () => {
    const responder = fakeResponder()
    const decision = await routeCommand(
      baseInput(groupEvent('@bot 沉澱'), { partnerGroupResponder: responder })
    )

    expect(decision.action).toBe('respond')
    expect(responder.respond).toHaveBeenCalledTimes(1)
  })

  it('非 botDirected 的「沉澱」→ B2 silent 不變，seam 零呼叫', async () => {
    const distill = fakeDistillSeam()
    const decision = await routeCommand(
      baseInput(groupEvent('沉澱', { mentionsBot: false }), { distill })
    )

    expect(decision.action).toBe('silent')
    expect(distill.run).not.toHaveBeenCalled()
    expect(distill.approve).not.toHaveBeenCalled()
  })

  it('B5 dev action 拒絕優先於 distill：「@bot deploy 沉澱」→ denied', async () => {
    const distill = fakeDistillSeam()
    const decision = await routeCommand(
      baseInput(groupEvent('@bot deploy 沉澱'), { distill })
    )

    expect(decision.action).toBe('denied')
    expect(decision.denied).toBe(true)
    expect(distill.run).not.toHaveBeenCalled()
    expect(distill.approve).not.toHaveBeenCalled()
  })

  it('done 指令優先於 distill：「@bot done <caseId>」照走 mark_handled，seam 零呼叫', async () => {
    const store = new MemoryStore()
    await store.put(
      createInitialCase({
        caseId: 'CW-0601-001',
        lineUserId: 'U-customer',
        customerDisplayName: '王小姐',
        now: '2026-06-11T05:00:00.000Z',
      })
    )
    const distill = fakeDistillSeam()
    const decision = await routeCommand(
      baseInput(groupEvent('@bot done CW-0601-001'), { distill, store })
    )

    expect(decision.action).toBe('mark_handled')
    expect(distill.run).not.toHaveBeenCalled()
    expect(distill.approve).not.toHaveBeenCalled()
  })

  it('event.groupId 缺 → distill 攔截跳過，落回 responder，seam 零呼叫', async () => {
    const distill = fakeDistillSeam()
    const responder = fakeResponder()
    const decision = await routeCommand(
      baseInput(groupEvent('@bot 沉澱', { groupId: undefined }), {
        distill,
        partnerGroupResponder: responder,
      })
    )

    expect(decision.action).toBe('respond')
    expect(responder.respond).toHaveBeenCalledTimes(1)
    expect(distill.run).not.toHaveBeenCalled()
    expect(distill.approve).not.toHaveBeenCalled()
  })

  it('seam run 裸 throw → router 收斂成 distill + status error 固定文案（不炸 webhook）', async () => {
    const distill = fakeDistillSeam({
      run: async () => {
        throw new Error('store read exploded')
      },
    })
    const decision = await routeCommand(
      baseInput(groupEvent('@bot 沉澱'), { distill })
    )

    expect(decision.action).toBe('distill')
    expect(decision.handlerResult?.status).toBe('error')
    expect(decision.handlerResult?.outboundText).toBe('沉澱處理失敗，請稍後重試。')
    expect(decision.handlerResult?.meta?.reason).toBe('distill_seam_failed')
  })
})

describe('shouldReplyToPartnerGroup — distill 放行', () => {
  it('action distill ＋ 非空 outboundText ＋ replyToken → true', async () => {
    const distill = fakeDistillSeam()
    const event = groupEvent('@bot 沉澱')
    const decision = await routeCommand(baseInput(event, { distill }))

    expect(decision.action).toBe('distill')
    expect(shouldReplyToPartnerGroup(event, decision, true)).toBe(true)
  })

  it('action distill ＋ 空 outboundText → false（gate 七條件不放水）', async () => {
    const distill = fakeDistillSeam({
      run: async () => ({ handler: 'runDistillation', status: 'stub_ok', outboundText: '' }),
    })
    const event = groupEvent('@bot 沉澱')
    const decision = await routeCommand(baseInput(event, { distill }))

    expect(decision.action).toBe('distill')
    expect(shouldReplyToPartnerGroup(event, decision, true)).toBe(false)
  })
})
