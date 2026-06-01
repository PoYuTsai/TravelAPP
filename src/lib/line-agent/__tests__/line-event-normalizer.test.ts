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

  it('returns null for a non-message event type (e.g. follow)', () => {
    const followEvent = {
      type: 'follow',
      source: { type: 'user', userId: LINE_USER_ID },
      timestamp: TS,
    }
    const result = normalizeLineEvent(followEvent, PARTNER_GROUP_ID)
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
})
