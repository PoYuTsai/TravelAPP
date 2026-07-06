/**
 * Tests for LINE webhook event normalization.
 *
 * Each test covers one distinct normalization case:
 *   1. Official OA 1:1 user text message
 *   2. Partner group text message
 *   3. Partner group quoted/reply message
 *   4. Image message (OA or group)
 *   5. File message (OA or group)
 *   6. Casual / unknown group message (non-text, non-image, non-file)
 */

import { describe, it, expect } from 'vitest'
import { normalizeLineEvent } from '../line/event-normalizer'
import type { NormalizedLineEvent } from '../line/event-normalizer'

// ---------------------------------------------------------------------------
// Fixture helpers — minimal raw LINE webhook events
// ---------------------------------------------------------------------------

const PARTNER_GROUP_ID = 'C_partner_group_001'
const LINE_USER_ID = 'U_customer_001'
const TS = 1717200000000

function makeOaTextEvent(overrides?: object) {
  return {
    type: 'message',
    source: { type: 'user', userId: LINE_USER_ID },
    message: { type: 'text', id: 'msg_001', text: '請問清邁包車怎麼算？' },
    timestamp: TS,
    replyToken: 'reply_token_abc',
    ...overrides,
  }
}

function makeGroupTextEvent(overrides?: object) {
  return {
    type: 'message',
    source: { type: 'group', groupId: PARTNER_GROUP_ID, userId: 'U_tsai_001' },
    message: { type: 'text', id: 'msg_002', text: '@清微AI助理 這組缺什麼？' },
    timestamp: TS,
    replyToken: 'reply_token_def',
    ...overrides,
  }
}

function makeGroupQuotedEvent() {
  return {
    type: 'message',
    source: { type: 'group', groupId: PARTNER_GROUP_ID, userId: 'U_tsai_001' },
    message: {
      type: 'text',
      id: 'msg_003',
      text: '這份報價有沒有漏？',
      quoteToken: 'qt_abc',
      quotedMessageId: 'msg_original_99',
    },
    timestamp: TS,
    replyToken: 'reply_token_ghi',
  }
}

function makeImageEvent(sourceType: 'user' | 'group') {
  const source =
    sourceType === 'user'
      ? { type: 'user', userId: LINE_USER_ID }
      : { type: 'group', groupId: PARTNER_GROUP_ID, userId: 'U_tsai_001' }
  return {
    type: 'message',
    source,
    message: { type: 'image', id: 'img_001' },
    timestamp: TS,
    replyToken: 'reply_token_img',
  }
}

function makeFileEvent() {
  return {
    type: 'message',
    source: { type: 'group', groupId: PARTNER_GROUP_ID, userId: 'U_tsai_001' },
    message: { type: 'file', id: 'file_001', fileName: 'quote.pdf', fileSize: 204800 },
    timestamp: TS,
    replyToken: 'reply_token_file',
  }
}

function makeUnknownGroupEvent() {
  return {
    type: 'message',
    source: { type: 'group', groupId: PARTNER_GROUP_ID, userId: 'U_tsai_001' },
    message: { type: 'sticker', id: 'sticker_001', packageId: '1', stickerId: '2' },
    timestamp: TS,
    replyToken: 'reply_token_sticker',
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('normalizeLineEvent', () => {
  it('normalizes an OA 1:1 user text message', () => {
    const raw = makeOaTextEvent()
    const event = normalizeLineEvent(raw, PARTNER_GROUP_ID)

    expect(event).not.toBeNull()
    const e = event as NormalizedLineEvent
    expect(e.kind).toBe('oa_text')
    expect(e.sourceChannel).toBe('line_oa')
    expect(e.lineUserId).toBe(LINE_USER_ID)
    expect(e.groupId).toBeUndefined()
    expect(e.messageId).toBe('msg_001')
    expect(e.text).toBe('請問清邁包車怎麼算？')
    expect(e.quotedRef).toBeUndefined()
    expect(e.timestamp).toBe(TS)
  })

  it('normalizes a partner group text message', () => {
    const raw = makeGroupTextEvent()
    const event = normalizeLineEvent(raw, PARTNER_GROUP_ID)

    expect(event).not.toBeNull()
    const e = event as NormalizedLineEvent
    expect(e.kind).toBe('group_text')
    expect(e.sourceChannel).toBe('line_partner_group')
    expect(e.lineUserId).toBe('U_tsai_001')
    expect(e.groupId).toBe(PARTNER_GROUP_ID)
    expect(e.messageId).toBe('msg_002')
    expect(e.text).toBe('@清微AI助理 這組缺什麼？')
    expect(e.quotedRef).toBeUndefined()
    expect(e.timestamp).toBe(TS)
  })

  it('normalizes a partner group quoted/reply message and captures quotedRef', () => {
    const raw = makeGroupQuotedEvent()
    const event = normalizeLineEvent(raw, PARTNER_GROUP_ID)

    expect(event).not.toBeNull()
    const e = event as NormalizedLineEvent
    expect(e.kind).toBe('group_quoted')
    expect(e.sourceChannel).toBe('line_partner_group')
    expect(e.groupId).toBe(PARTNER_GROUP_ID)
    expect(e.messageId).toBe('msg_003')
    expect(e.text).toBe('這份報價有沒有漏？')
    expect(e.quotedRef).toBeDefined()
    expect(e.quotedRef?.quotedMessageId).toBe('msg_original_99')
  })

  it('normalizes an image message and carries the message id (no OCR here)', () => {
    const raw = makeImageEvent('user')
    const event = normalizeLineEvent(raw, PARTNER_GROUP_ID)

    expect(event).not.toBeNull()
    const e = event as NormalizedLineEvent
    expect(e.kind).toBe('image')
    expect(e.messageId).toBe('img_001')
    expect(e.text).toBeUndefined()
    // No OCR content — caller must use messageId to fetch separately
  })

  it('normalizes a file message and carries the message id', () => {
    const raw = makeFileEvent()
    const event = normalizeLineEvent(raw, PARTNER_GROUP_ID)

    expect(event).not.toBeNull()
    const e = event as NormalizedLineEvent
    expect(e.kind).toBe('file')
    expect(e.messageId).toBe('file_001')
    expect(e.text).toBeUndefined()
  })

  it('normalizes a casual/unknown group message (sticker, etc.) as kind=unknown_group', () => {
    const raw = makeUnknownGroupEvent()
    const event = normalizeLineEvent(raw, PARTNER_GROUP_ID)

    expect(event).not.toBeNull()
    const e = event as NormalizedLineEvent
    expect(e.kind).toBe('unknown_group')
    expect(e.sourceChannel).toBe('line_partner_group')
    expect(e.groupId).toBe(PARTNER_GROUP_ID)
  })

  it('returns null for a non-message event type (e.g. postback/join)', () => {
    // NOTE: `follow` is now upgraded to oa_follow (廣告刀1) — see the dedicated
    // "follow event" describe block. Other non-message events stay fail-closed.
    const postbackEvent = {
      type: 'postback',
      source: { type: 'user', userId: LINE_USER_ID },
      timestamp: TS,
    }
    const result = normalizeLineEvent(postbackEvent, PARTNER_GROUP_ID)
    expect(result).toBeNull()
  })

  it('sets sourceChannel=line_partner_group for a group message matching partnerGroupId', () => {
    const raw = makeGroupTextEvent()
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID) as NormalizedLineEvent
    expect(e.sourceChannel).toBe('line_partner_group')
  })

  it('sets sourceChannel=line_oa for a user message (not a group)', () => {
    const raw = makeOaTextEvent()
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID) as NormalizedLineEvent
    expect(e.sourceChannel).toBe('line_oa')
  })

  it('returns null for a group message from a non-partner group (wrong groupId is ignored)', () => {
    // Bot may be in some other group; events from a group whose id does NOT
    // match the configured partner group must be ignored — they must NOT
    // become line_partner_group events.
    const raw = makeGroupTextEvent({
      source: { type: 'group', groupId: 'C_some_other_group_999', userId: 'U_stranger_001' },
    })
    const result = normalizeLineEvent(raw, PARTNER_GROUP_ID)
    expect(result).toBeNull()
  })

  it('returns null for a room / multi-person chat source (fail-closed)', () => {
    // LINE sources can also be 'room' (an ad-hoc multi-person chat). Rooms are
    // not the partner group and not an OA 1:1 customer, so they must be ignored
    // rather than silently treated as line_oa and routed to create_case.
    const raw = {
      type: 'message',
      source: { type: 'room', roomId: 'R_some_room', userId: 'U_001' },
      message: { type: 'text', id: 'msg_room_001', text: 'hello' },
      timestamp: TS,
    }

    expect(normalizeLineEvent(raw, PARTNER_GROUP_ID)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// mentionsBot — partner-group bot-mention detection (design 2026-06-03 §A)
//
// The normalizer is the SINGLE source of truth for "is the bot being addressed".
// permissions.ts only reads the resulting boolean; it never runs its own regex.
//
// Hard rules pinned here:
//  - mentionsBot is ONLY ever true for sourceChannel === 'line_partner_group'.
//  - line_oa customer events are ALWAYS mentionsBot:false, even if the text
//    literally contains @bot / a wake word — they must never trigger a reply.
//  - mentionsBot is a REQUIRED boolean — the normalizer always assigns it.
// ---------------------------------------------------------------------------

const BOT_USER_ID = 'U_chiangway_bot_999'

/** Raw partner-group text event with an optional structured mention block. */
function makeGroupMentionEvent(
  text: string,
  mentioneeUserIds?: string[]
): Record<string, any> {
  const message: Record<string, any> = {
    type: 'text',
    id: 'msg_mention',
    text,
  }
  if (mentioneeUserIds) {
    message.mention = {
      mentionees: mentioneeUserIds.map((userId, i) => ({
        index: i,
        length: 3,
        userId,
        type: 'user',
      })),
    }
  }
  return {
    type: 'message',
    source: { type: 'group', groupId: PARTNER_GROUP_ID, userId: 'U_tsai_001' },
    message,
    timestamp: TS,
    replyToken: 'reply_token_mention',
  }
}

describe('normalizeLineEvent — mentionsBot detection', () => {
  it('sets mentionsBot:true when a structured mentionee matches botUserId', () => {
    const raw = makeGroupMentionEvent('幫我看一下', [BOT_USER_ID])
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, BOT_USER_ID) as NormalizedLineEvent
    expect(e.mentionsBot).toBe(true)
  })

  it('sets mentionsBot:false when the structured mentionee is NOT the bot (and no text alias)', () => {
    const raw = makeGroupMentionEvent('幫我看一下', ['U_someone_else'])
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, BOT_USER_ID) as NormalizedLineEvent
    expect(e.mentionsBot).toBe(false)
  })

  it.each([
    '@清微旅行chiangway_travel 幫我看',
    '@清微旅行 這組缺什麼',
    '@清微AI助理 確認一下',
    '@清微AI 看看',
    '@AI 幫忙',
    '@bot 幫我查',
    '@cc 看一下',
    '清微AI 幫我看一下',
    '清微助理 在嗎',
    '幫我問 bot 一下',
  ])('sets mentionsBot:true for alias text "%s" in the partner group', (text) => {
    const raw = makeGroupMentionEvent(text)
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, BOT_USER_ID) as NormalizedLineEvent
    expect(e.mentionsBot).toBe(true)
  })

  // Regression — 2026-06-12 real-group incident: Chun tagged ERIC
  // ("@清微旅行-阿裕"), whose display name shares the 清微旅行 prefix with the
  // bot.  The bare `@清微旅行` text alias matched the prefix and the bot hijacked
  // a question addressed to a human (and answered it wrong).  Two layers fix it:
  //  1. When a structured mention block exists AND botUserId is known, the
  //     structural verdict is AUTHORITATIVE — no text-alias fallback.  A real
  //     tag always carries mentionees; tagging someone else is never for us.
  //  2. The bare `@清微旅行` alias no longer matches when followed by a
  //     name-continuation char (`-阿裕` etc.), so even the text-only fallback
  //     (botUserId unset) cannot misfire on a colleague's display name.
  it('REGRESSION: tagging a human whose name shares the bot prefix is NOT a bot mention (structural path)', () => {
    const raw = makeGroupMentionEvent(
      '@清微旅行-阿裕 2大2小（4歲跟6歲）小台車這樣會不會很擠挖',
      ['U_eric_001']
    )
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, BOT_USER_ID) as NormalizedLineEvent
    expect(e.mentionsBot).toBe(false)
  })

  it('REGRESSION: text-only fallback (no botUserId) also rejects "@清微旅行-阿裕"', () => {
    const raw = makeGroupMentionEvent('@清微旅行-阿裕 小台車這樣會不會很擠')
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, '') as NormalizedLineEvent
    expect(e.mentionsBot).toBe(false)
  })

  it('structural block is authoritative: mentioning someone else suppresses text aliases in the same message', () => {
    // Trade-off documented: a partner who tags a human AND types "@bot" in one
    // message gets no bot reply — fail-closed beats hijacking a human-directed
    // question.  Re-tagging the bot properly always works.
    const raw = makeGroupMentionEvent('@清微旅行-阿裕 你問 @bot 看看', ['U_eric_001'])
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, BOT_USER_ID) as NormalizedLineEvent
    expect(e.mentionsBot).toBe(false)
  })

  it('bare "@清微旅行" followed by a space/end still counts as a typed alias', () => {
    const raw = makeGroupMentionEvent('@清微旅行 在嗎')
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, '') as NormalizedLineEvent
    expect(e.mentionsBot).toBe(true)
  })

  it('sets mentionsBot:false for casual partner-group chat with no wake word', () => {
    const raw = makeGroupMentionEvent('今天天氣很好，明天出發')
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, BOT_USER_ID) as NormalizedLineEvent
    expect(e.mentionsBot).toBe(false)
  })

  it('falls back to text-only detection when botUserId is empty', () => {
    // Structured mention present but botUserId unknown → cannot match structurally;
    // alias text still triggers.
    const structuredOnly = makeGroupMentionEvent('幫我看一下', [BOT_USER_ID])
    expect(
      (normalizeLineEvent(structuredOnly, PARTNER_GROUP_ID, '') as NormalizedLineEvent).mentionsBot
    ).toBe(false)

    const aliasText = makeGroupMentionEvent('@bot 幫我查')
    expect(
      (normalizeLineEvent(aliasText, PARTNER_GROUP_ID, '') as NormalizedLineEvent).mentionsBot
    ).toBe(true)
  })

  it('treats a missing botUserId arg the same as empty (text fallback only)', () => {
    const aliasText = makeGroupMentionEvent('清微AI 幫我看')
    expect(
      (normalizeLineEvent(aliasText, PARTNER_GROUP_ID) as NormalizedLineEvent).mentionsBot
    ).toBe(true)
  })

  it('HARD RULE: a line_oa customer text containing @bot is ALWAYS mentionsBot:false', () => {
    const raw = {
      type: 'message',
      source: { type: 'user', userId: LINE_USER_ID },
      message: { type: 'text', id: 'msg_oa_atbot', text: '@bot 請問可以包車嗎' },
      timestamp: TS,
    }
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, BOT_USER_ID) as NormalizedLineEvent
    expect(e.sourceChannel).toBe('line_oa')
    expect(e.mentionsBot).toBe(false)
  })

  it('word-boundary: standalone "bot" triggers but "robot"/"chatbot" do not', () => {
    expect(
      (normalizeLineEvent(makeGroupMentionEvent('幫我問 bot'), PARTNER_GROUP_ID, '') as NormalizedLineEvent)
        .mentionsBot
    ).toBe(true)
    expect(
      (normalizeLineEvent(makeGroupMentionEvent('這是一個 robot 玩具'), PARTNER_GROUP_ID, '') as NormalizedLineEvent)
        .mentionsBot
    ).toBe(false)
    expect(
      (normalizeLineEvent(makeGroupMentionEvent('我用 chatbot 測試'), PARTNER_GROUP_ID, '') as NormalizedLineEvent)
        .mentionsBot
    ).toBe(false)
  })

  it('non-text partner-group events (image/unknown) are mentionsBot:false', () => {
    const e = normalizeLineEvent(makeImageEvent('group'), PARTNER_GROUP_ID, BOT_USER_ID) as NormalizedLineEvent
    expect(e.mentionsBot).toBe(false)
  })

  // Latin @-aliases are word-boundary guarded so a longer word that merely
  // starts with the alias does NOT widen the trigger (design §A 誤觸防護).
  it.each(['@botany 是植物學', '@AIGC 生成圖', '@ccc 三個c'])(
    'does NOT trigger on a longer latin word "%s"',
    (text) => {
      const e = normalizeLineEvent(makeGroupMentionEvent(text), PARTNER_GROUP_ID, '') as NormalizedLineEvent
      expect(e.mentionsBot).toBe(false)
    }
  )

  it.each(['@bot 幫我查', '@AI 看看', '@cc 確認'])(
    'still triggers on the exact latin alias "%s"',
    (text) => {
      const e = normalizeLineEvent(makeGroupMentionEvent(text), PARTNER_GROUP_ID, '') as NormalizedLineEvent
      expect(e.mentionsBot).toBe(true)
    }
  )
})

// ---------------------------------------------------------------------------
// replyToken capture (tagged-reply plan Task 1)
//
// The reply send gate (a later task) needs the LINE reply token to call
// replyMessage(). The normalizer must surface raw.replyToken on the normalized
// event for BOTH planes, but capturing it must NOT change mentionsBot — an OA
// customer event stays mentionsBot:false even though its replyToken is captured,
// so a captured token can never become a customer auto-reply on its own.
// ---------------------------------------------------------------------------

describe('normalizeLineEvent — replyToken capture', () => {
  it('captures replyToken on a partner group text event without changing mentionsBot', () => {
    const raw = makeGroupTextEvent() // replyToken: 'reply_token_def', text tags the bot
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, BOT_USER_ID) as NormalizedLineEvent
    expect(e.replyToken).toBe('reply_token_def')
    expect(e.mentionsBot).toBe(true)
  })

  it('captures replyToken on an OA text event but keeps mentionsBot:false', () => {
    const raw = makeOaTextEvent() // replyToken: 'reply_token_abc'
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, BOT_USER_ID) as NormalizedLineEvent
    expect(e.replyToken).toBe('reply_token_abc')
    expect(e.sourceChannel).toBe('line_oa')
    expect(e.mentionsBot).toBe(false)
  })

  it('captures replyToken on a partner group image event', () => {
    const raw = makeImageEvent('group') // replyToken: 'reply_token_img'
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, BOT_USER_ID) as NormalizedLineEvent
    expect(e.replyToken).toBe('reply_token_img')
  })

  it('leaves replyToken undefined when the raw event omits it', () => {
    const raw = makeGroupTextEvent({ replyToken: undefined })
    const e = normalizeLineEvent(raw, PARTNER_GROUP_ID, BOT_USER_ID) as NormalizedLineEvent
    expect(e.replyToken).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// follow event → oa_follow (廣告刀1：OA 1:1 被動記錄加好友)
// ---------------------------------------------------------------------------

describe('follow event', () => {
  it('normalizes a user follow into oa_follow', () => {
    const ev = normalizeLineEvent(
      { type: 'follow', timestamp: 1720000000000, source: { type: 'user', userId: 'U123' } },
      'Gpartner',
    )
    expect(ev).toEqual({
      kind: 'oa_follow',
      sourceChannel: 'line_oa',
      lineUserId: 'U123',
      messageId: '',
      mentionsBot: false,
      timestamp: 1720000000000,
      replyToken: undefined,
    })
  })

  it('ignores a follow from a non-user source (group/room)', () => {
    expect(
      normalizeLineEvent(
        { type: 'follow', timestamp: 1, source: { type: 'group', groupId: 'Gx' } },
        'Gpartner',
      ),
    ).toBeNull()
  })

  it('still ignores unfollow / other non-message events', () => {
    expect(
      normalizeLineEvent({ type: 'unfollow', source: { type: 'user', userId: 'U1' } }, 'Gp'),
    ).toBeNull()
  })
})
