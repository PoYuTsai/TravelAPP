/**
 * oa-contact-webhook-wiring.test.ts — 廣告刀5：oa-contact-recorder webhook 接線.
 *
 * 鎖住 AI_AGENT_OA_CAPTURE_ENABLED 閘住的被動記錄 seam（archiver 範式的 OA 客人
 * 面對照物）：
 *   1. 閘開 → OA 加好友（oa_follow）→ store 落 followedAt
 *   2. 閘開 → OA 首則文字（oa_text）→ store 落 messages
 *   3. 閘未設（default off）→ 零 OA 記錄寫入（byte-identical），且 OA 建案路徑
 *      不受影響（case 照常落地）
 *   4. 閘開＋夥伴群事件 → recorder 短路不寫 OA namespace（只記客人面）
 *
 * 全部走 getEventHandler()（完整 defaultEventHandler）＋MemoryStore — 零網路、
 * 零真 key。recorder 在 routeCommand 之前跑，故記錄與建案路徑彼此獨立。
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { getEventHandler } from '../line/webhook-runtime'
import { MemoryStore } from '../storage/memory-store'
import type { NormalizedLineEvent } from '../line/event-normalizer'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OA_USER = 'U_ad_customer'
const TS = 1_700_000_000_000

function oaFollowEvent(
  overrides: Partial<NormalizedLineEvent> = {}
): NormalizedLineEvent {
  return {
    kind: 'oa_follow',
    sourceChannel: 'line_oa',
    lineUserId: OA_USER,
    messageId: '',
    mentionsBot: false,
    timestamp: TS,
    ...overrides,
  }
}

function oaTextEvent(
  text: string,
  overrides: Partial<NormalizedLineEvent> = {}
): NormalizedLineEvent {
  return {
    kind: 'oa_text',
    sourceChannel: 'line_oa',
    lineUserId: OA_USER,
    messageId: 'M_oa_1',
    text,
    mentionsBot: false,
    timestamp: TS,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 廣告刀5 — webhook oa-contact-recorder seam
// ---------------------------------------------------------------------------

describe('webhook oa-contact-recorder seam（廣告刀5 接線）', () => {
  it('1. 閘開 → OA 加好友（oa_follow）→ store 落 followedAt', async () => {
    vi.stubEnv('AI_AGENT_OA_CAPTURE_ENABLED', 'true')
    const store = new MemoryStore()

    await getEventHandler()(oaFollowEvent(), store)

    const record = await store.getOaContactRecord(OA_USER)
    expect(record?.followedAt).toBe(TS)
  })

  it('2. 閘開 → OA 首則文字（oa_text）→ store 落 messages', async () => {
    vi.stubEnv('AI_AGENT_OA_CAPTURE_ENABLED', 'true')
    const store = new MemoryStore()

    await getEventHandler()(oaTextEvent('清邁包車想問一下'), store)

    const record = await store.getOaContactRecord(OA_USER)
    expect(record?.messages?.map((m) => m.text)).toEqual(['清邁包車想問一下'])
    expect(record?.firstMessageAt).toBe(TS)
  })

  it('3. 閘未設（default）→ 零 OA 記錄（byte-identical），OA 建案路徑不受影響', async () => {
    vi.stubEnv('AI_AGENT_OA_CAPTURE_ENABLED', '') // 防宿主殘留 — 視同未設
    const store = new MemoryStore()
    const putSpy = vi.spyOn(store, 'putOaContactRecord')

    await getEventHandler()(oaTextEvent('想訂三天兩夜'), store)

    // recorder 零寫入 — 被動層在閘關時形同不存在
    expect(putSpy).not.toHaveBeenCalled()
    expect(await store.getOaContactRecord(OA_USER)).toBeNull()
    // 建案路徑照常：OA 客訊仍被 routeCommand 落成 case（不被 recorder 短路影響）
    expect(await store.getByLineUserId(OA_USER)).not.toBeNull()
  })

  it('4. 閘開＋夥伴群事件 → recorder 不寫 OA namespace（只記客人面）', async () => {
    vi.stubEnv('AI_AGENT_OA_CAPTURE_ENABLED', 'true')
    const store = new MemoryStore()
    const putSpy = vi.spyOn(store, 'putOaContactRecord')

    await getEventHandler()(
      oaTextEvent('夥伴群訊息', {
        kind: 'group_text',
        sourceChannel: 'line_partner_group',
        groupId: 'G_partner',
        lineUserId: 'U_partner',
        mentionsBot: false,
      }),
      store
    )

    expect(putSpy).not.toHaveBeenCalled()
    expect(await store.getOaContactRecord('U_partner')).toBeNull()
  })
})
