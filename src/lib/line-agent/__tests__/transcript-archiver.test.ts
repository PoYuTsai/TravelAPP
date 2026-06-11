/**
 * 沉澱管線刀1 — archiver 單元測試.
 *
 * 驗的是純邏輯：閘、kind 對映、OCR seam、冪等防雙重 OCR、fail-safe。
 * store 用 MemoryStore，OCR 用 fake — 零網路、零 key。
 */

import { describe, it, expect, vi } from 'vitest'
import {
  archivePartnerGroupMessage,
  isTranscriptCaptureEnabled,
} from '../transcript/archiver'
import { MemoryStore } from '../storage/memory-store'
import type { NormalizedLineEvent } from '../line/event-normalizer'

const GATE_ON = { AI_AGENT_TRANSCRIPT_ENABLED: 'true' }

function groupTextEvent(
  overrides: Partial<NormalizedLineEvent> = {}
): NormalizedLineEvent {
  return {
    kind: 'group_text',
    sourceChannel: 'line_partner_group',
    lineUserId: 'U_tsai',
    groupId: 'G_partner',
    messageId: 'M100',
    text: '高山行程2月可以走嗎',
    mentionsBot: false,
    timestamp: 1_700_000_000_000,
    ...overrides,
  }
}

describe('isTranscriptCaptureEnabled', () => {
  it('default off — 缺 env 即 false', () => {
    expect(isTranscriptCaptureEnabled({})).toBe(false)
  })

  it("'false' → false", () => {
    expect(
      isTranscriptCaptureEnabled({ AI_AGENT_TRANSCRIPT_ENABLED: 'false' })
    ).toBe(false)
  })

  it("'1' → false（只認 true 字面）", () => {
    expect(
      isTranscriptCaptureEnabled({ AI_AGENT_TRANSCRIPT_ENABLED: '1' })
    ).toBe(false)
  })

  it("'true' → true", () => {
    expect(
      isTranscriptCaptureEnabled({ AI_AGENT_TRANSCRIPT_ENABLED: 'true' })
    ).toBe(true)
  })

  it("' TRUE ' → true（trim + case-insensitive）", () => {
    expect(
      isTranscriptCaptureEnabled({ AI_AGENT_TRANSCRIPT_ENABLED: ' TRUE ' })
    ).toBe(true)
  })
})

describe('archivePartnerGroupMessage', () => {
  it('閘關 → 什麼都不存', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(groupTextEvent(), store, { env: {} })
    expect(await store.listTranscriptEntries()).toEqual([])
  })

  it('group_text → 存 kind text 完整欄位', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(groupTextEvent(), store, { env: GATE_ON })
    expect(await store.getTranscriptEntry('M100')).toEqual({
      messageId: 'M100',
      groupId: 'G_partner',
      lineUserId: 'U_tsai',
      timestamp: 1_700_000_000_000,
      kind: 'text',
      text: '高山行程2月可以走嗎',
    })
  })

  it('group_quoted → kind text 並帶 quotedMessageId', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(
      groupTextEvent({
        kind: 'group_quoted',
        messageId: 'M101',
        text: '這個可以',
        quotedRef: { quotedMessageId: 'M100' },
      }),
      store,
      { env: GATE_ON }
    )
    const entry = await store.getTranscriptEntry('M101')
    expect(entry?.kind).toBe('text')
    expect(entry?.quotedMessageId).toBe('M100')
  })

  it('image → 當下 OCR，存 OCR 文字', async () => {
    const store = new MemoryStore()
    const ocr = vi.fn().mockResolvedValue('客人：2/1 兩大一小，想去茵他儂')
    await archivePartnerGroupMessage(
      groupTextEvent({ kind: 'image', messageId: 'M102', text: undefined }),
      store,
      { env: GATE_ON, ocr }
    )
    expect(ocr).toHaveBeenCalledWith('M102')
    const entry = await store.getTranscriptEntry('M102')
    expect(entry?.kind).toBe('image')
    expect(entry?.text).toBe('客人：2/1 兩大一小，想去茵他儂')
  })

  it("OCR 失敗 → 仍存該筆，text=''（如實留缺）", async () => {
    const store = new MemoryStore()
    const ocr = vi.fn().mockRejectedValue(new Error('vision down'))
    await archivePartnerGroupMessage(
      groupTextEvent({ kind: 'image', messageId: 'M103', text: undefined }),
      store,
      { env: GATE_ON, ocr }
    )
    const entry = await store.getTranscriptEntry('M103')
    expect(entry?.kind).toBe('image')
    expect(entry?.text).toBe('')
  })

  it("無 OCR seam → image 仍入檔但 text=''", async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(
      groupTextEvent({ kind: 'image', messageId: 'M104', text: undefined }),
      store,
      { env: GATE_ON }
    )
    const entry = await store.getTranscriptEntry('M104')
    expect(entry?.kind).toBe('image')
    expect(entry?.text).toBe('')
  })

  it('LINE 重送同一張圖 → 冪等：只 OCR 一次、只存一筆', async () => {
    const store = new MemoryStore()
    const ocr = vi.fn().mockResolvedValue('OCR 文字')
    const event = groupTextEvent({
      kind: 'image',
      messageId: 'M105',
      text: undefined,
    })
    await archivePartnerGroupMessage(event, store, { env: GATE_ON, ocr })
    await archivePartnerGroupMessage(event, store, { env: GATE_ON, ocr })
    expect(ocr).toHaveBeenCalledTimes(1)
    expect(await store.listTranscriptEntries()).toHaveLength(1)
  })

  it('OCR 進行中重送不二次 OCR（placeholder 先佔位）', async () => {
    const store = new MemoryStore()
    // 手動 resolve 的 deferred — 模擬 OCR 還在飛的窗口
    let resolveOcr!: (text: string) => void
    const deferred = new Promise<string>((resolve) => {
      resolveOcr = resolve
    })
    const ocr = vi.fn().mockReturnValue(deferred)
    const event = groupTextEvent({
      kind: 'image',
      messageId: 'M107',
      text: undefined,
    })

    // 第一次：不 await — OCR pending 期間 placeholder 應已佔位
    const first = archivePartnerGroupMessage(event, store, {
      env: GATE_ON,
      ocr,
    })
    await new Promise((r) => setTimeout(r, 0)) // flush microtasks 到 OCR await 點
    const placeholder = await store.getTranscriptEntry('M107')
    expect(placeholder).not.toBeNull()
    expect(placeholder?.text).toBe('')

    // LINE 重送（OCR 還沒回來）→ 冪等檢查擋下，不二次 OCR
    await archivePartnerGroupMessage(event, store, { env: GATE_ON, ocr })
    expect(ocr).toHaveBeenCalledTimes(1)

    // OCR 回來 → 同 messageId 覆寫成轉錄文字
    resolveOcr('OCR 結果')
    await first
    const entry = await store.getTranscriptEntry('M107')
    expect(entry?.text).toBe('OCR 結果')
    expect(ocr).toHaveBeenCalledTimes(1)
    expect(await store.listTranscriptEntries()).toHaveLength(1)
  })

  it('OA 客人面事件 → 永不入檔（隱私邊界）', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(
      groupTextEvent({
        kind: 'oa_text',
        sourceChannel: 'line_oa',
        groupId: undefined,
        messageId: 'M106',
      }),
      store,
      { env: GATE_ON }
    )
    expect(await store.listTranscriptEntries()).toEqual([])
  })

  it('file / unknown_group kind → 不入檔', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(
      groupTextEvent({ kind: 'file', messageId: 'M107', text: undefined }),
      store,
      { env: GATE_ON }
    )
    await archivePartnerGroupMessage(
      groupTextEvent({ kind: 'unknown_group', messageId: 'M108' }),
      store,
      { env: GATE_ON }
    )
    expect(await store.listTranscriptEntries()).toEqual([])
  })

  it('空 messageId → 不入檔', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(
      groupTextEvent({ messageId: '' }),
      store,
      { env: GATE_ON }
    )
    expect(await store.listTranscriptEntries()).toEqual([])
  })

  it('store 寫入失敗 → 吞掉、絕不 throw（fail-safe）', async () => {
    const store = new MemoryStore()
    vi.spyOn(store, 'putTranscriptEntry').mockRejectedValue(
      new Error('kv down')
    )
    await expect(
      archivePartnerGroupMessage(groupTextEvent(), store, { env: GATE_ON })
    ).resolves.toBeUndefined()
  })

  it('超長文字 → slice 到 5000 chars', async () => {
    const store = new MemoryStore()
    await archivePartnerGroupMessage(
      groupTextEvent({ text: 'x'.repeat(6000) }),
      store,
      { env: GATE_ON }
    )
    const entry = await store.getTranscriptEntry('M100')
    expect(entry?.text).toHaveLength(5000)
  })
})
