import { describe, it, expect } from 'vitest'
import { MemoryStore } from '../../storage/memory-store'
import { recordOaContactEvent, isOaCaptureEnabled } from '../oa-contact-recorder'
import type { NormalizedLineEvent } from '../../line/event-normalizer'

const ON = { AI_AGENT_OA_CAPTURE_ENABLED: 'true' }
const follow = (userId: string, ts = 1000): NormalizedLineEvent =>
  ({ kind: 'oa_follow', sourceChannel: 'line_oa', lineUserId: userId, messageId: '', mentionsBot: false, timestamp: ts })
const oaText = (userId: string, text: string, ts: number): NormalizedLineEvent =>
  ({ kind: 'oa_text', sourceChannel: 'line_oa', lineUserId: userId, messageId: 'm', text, mentionsBot: false, timestamp: ts })

describe('isOaCaptureEnabled', () => {
  it('gate off unless env flag === "true"', () => {
    expect(isOaCaptureEnabled({})).toBe(false)
    expect(isOaCaptureEnabled({ AI_AGENT_OA_CAPTURE_ENABLED: 'false' })).toBe(false)
    expect(isOaCaptureEnabled({ AI_AGENT_OA_CAPTURE_ENABLED: '  TRUE ' })).toBe(true)
  })
})

describe('recordOaContactEvent', () => {
  it('gate off → no write, byte-identical', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(follow('U1'), s, { env: {} })
    expect(await s.getOaContactRecord('U1')).toBeNull()
  })
  it('follow → creates record with followedAt', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(follow('U1', 111), s, { env: ON })
    expect(await s.getOaContactRecord('U1')).toMatchObject({ userId: 'U1', followedAt: 111 })
  })
  it('follow is idempotent — second follow does not overwrite followedAt', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(follow('U1', 111), s, { env: ON })
    await recordOaContactEvent(follow('U1', 999), s, { env: ON })
    expect((await s.getOaContactRecord('U1'))?.followedAt).toBe(111)
  })
  it('first text → sets firstMessageAt and appends trimmed message', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(follow('U1', 100), s, { env: ON })
    await recordOaContactEvent(oaText('U1', ' 想問清邁包車 ', 200), s, { env: ON })
    const r = await s.getOaContactRecord('U1')
    expect(r).toMatchObject({ firstMessageAt: 200, messages: [{ ts: 200, text: '想問清邁包車' }] })
  })
  it('text without prior follow still records (follow may be missed)', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(oaText('U2', 'hi', 5), s, { env: ON })
    expect(await s.getOaContactRecord('U2')).toMatchObject({ userId: 'U2', firstMessageAt: 5 })
  })
  it('caps messages at OA_MESSAGES_MAX keeping the newest', async () => {
    const s = new MemoryStore()
    for (let i = 1; i <= 25; i++) await recordOaContactEvent(oaText('U1', `m${i}`, i), s, { env: ON })
    const r = await s.getOaContactRecord('U1')
    expect(r?.messages).toHaveLength(20)
    expect(r?.messages?.[0].text).toBe('m6')
    expect(r?.messages?.at(-1)?.text).toBe('m25')
  })
  it('text→follow order: follow keeps existing messages/firstMessageAt, only adds followedAt', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(oaText('U1', 'hi', 200), s, { env: ON })
    await recordOaContactEvent(follow('U1', 111), s, { env: ON })
    const r = await s.getOaContactRecord('U1')
    expect(r).toMatchObject({
      userId: 'U1',
      followedAt: 111,
      firstMessageAt: 200,
      messages: [{ ts: 200, text: 'hi' }],
    })
  })
  it('follow preserves sheetWritten and writes followedAt', async () => {
    const s = new MemoryStore()
    await s.putOaContactRecord({ userId: 'U1', firstMessageAt: 1, sheetWritten: true })
    await recordOaContactEvent(follow('U1', 111), s, { env: ON })
    const r = await s.getOaContactRecord('U1')
    expect(r?.sheetWritten).toBe(true)
    expect(r?.followedAt).toBe(111)
  })
  it('preserves sheetWritten across later text', async () => {
    const s = new MemoryStore()
    await s.putOaContactRecord({ userId: 'U1', firstMessageAt: 1, sheetWritten: true })
    await recordOaContactEvent(oaText('U1', 'more', 9), s, { env: ON })
    expect((await s.getOaContactRecord('U1'))?.sheetWritten).toBe(true)
  })
  it('skips non-OA / non-text-follow events (image, partner group)', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent({ kind: 'image', sourceChannel: 'line_oa', lineUserId: 'U1', messageId: 'm', mentionsBot: false, timestamp: 1 } as NormalizedLineEvent, s, { env: ON })
    await recordOaContactEvent({ kind: 'group_text', sourceChannel: 'line_partner_group', lineUserId: 'U1', messageId: 'm', text: 'x', mentionsBot: false, timestamp: 1 } as NormalizedLineEvent, s, { env: ON })
    expect(await s.getOaContactRecord('U1')).toBeNull()
  })
  it('empty text is ignored', async () => {
    const s = new MemoryStore()
    await recordOaContactEvent(oaText('U1', '   ', 5), s, { env: ON })
    expect(await s.getOaContactRecord('U1')).toBeNull()
  })
  it('swallows store errors (fail-safe, never throws)', async () => {
    const boom = { getOaContactRecord: async () => { throw new Error('kv down') }, putOaContactRecord: async () => {} } as any
    await expect(recordOaContactEvent(follow('U1'), boom, { env: ON })).resolves.toBeUndefined()
  })
})
