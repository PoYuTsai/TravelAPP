/**
 * 沉澱刀2 — thread-weaver 單元測試.
 *
 * 驗純函式：時間排序、匿名化（raw userId 絕不外洩）、引用註記、
 * 截圖標記與讀不到計數、scannedMessageIds 全量、lineToMessageId 映射、priority 標註。
 */

import { describe, it, expect } from 'vitest'
import { weaveTranscript } from '../distill/thread-weaver'
import type { TranscriptEntry } from '../transcript/transcript-entry'

function entry(overrides: Partial<TranscriptEntry> = {}): TranscriptEntry {
  return {
    messageId: 'M1',
    groupId: 'G_partner',
    lineUserId: 'U_tsai',
    timestamp: 1_700_000_000_000,
    kind: 'text',
    text: '高山行程2月可以走嗎',
    ...overrides,
  }
}

describe('weaveTranscript', () => {
  it('空輸入 → promptText 空、counts 0、空映射', () => {
    const woven = weaveTranscript([])
    expect(woven.promptText).toBe('')
    expect(woven.unreadableImageCount).toBe(0)
    expect(woven.scannedMessageIds).toEqual([])
    expect(woven.lineToMessageId).toEqual({})
  })

  it('按 timestamp 升冪排序（輸入亂序）', () => {
    const woven = weaveTranscript([
      entry({ messageId: 'M3', timestamp: 3_000, text: '第三句' }),
      entry({ messageId: 'M1', timestamp: 1_000, text: '第一句' }),
      entry({ messageId: 'M2', timestamp: 2_000, text: '第二句' }),
    ])
    expect(woven.promptText).toBe(
      ['#1 [夥伴A] 第一句', '#2 [夥伴A] 第二句', '#3 [夥伴A] 第三句'].join(
        '\n'
      )
    )
    // 不 mutate 輸入順序（純函式紀律）
    expect(woven.scannedMessageIds).toEqual(['M1', 'M2', 'M3'])
  })

  it('不改動呼叫端的陣列（純函式）', () => {
    const input = [
      entry({ messageId: 'M2', timestamp: 2_000 }),
      entry({ messageId: 'M1', timestamp: 1_000 }),
    ]
    weaveTranscript(input)
    expect(input.map((e) => e.messageId)).toEqual(['M2', 'M1'])
  })

  it('lineUserId 依首次出現順序映成 夥伴A/夥伴B；raw userId 絕不出現在 promptText', () => {
    const woven = weaveTranscript([
      entry({
        messageId: 'M1',
        timestamp: 1_000,
        lineUserId: 'U_min',
        text: '問價格',
      }),
      entry({
        messageId: 'M2',
        timestamp: 2_000,
        lineUserId: 'U_tsai',
        text: '回價格',
      }),
      entry({
        messageId: 'M3',
        timestamp: 3_000,
        lineUserId: 'U_min',
        text: '追問',
      }),
    ])
    expect(woven.promptText).toBe(
      ['#1 [夥伴A] 問價格', '#2 [夥伴B] 回價格', '#3 [夥伴A] 追問'].join('\n')
    )
    expect(woven.promptText).not.toContain('U_min')
    expect(woven.promptText).not.toContain('U_tsai')
  })

  it('>26 人回繞補數字（防衛性）', () => {
    const entries = Array.from({ length: 27 }, (_, i) =>
      entry({
        messageId: `M${i}`,
        timestamp: 1_000 + i,
        lineUserId: `U_${i}`,
        text: `msg${i}`,
      })
    )
    const woven = weaveTranscript(entries)
    const lines = woven.promptText.split('\n')
    expect(lines[0]).toContain('[夥伴A]')
    expect(lines[25]).toContain('[夥伴Z]')
    // 第 27 人回繞到 A 但補序號，避免與第 1 人撞名
    expect(lines[26]).toContain('[夥伴A26]')
  })

  it('quotedMessageId 命中存檔內訊息 → 加（回覆 #被引行號）', () => {
    const woven = weaveTranscript([
      entry({ messageId: 'M1', timestamp: 1_000, text: '高山2月能走嗎' }),
      entry({
        messageId: 'M2',
        timestamp: 2_000,
        lineUserId: 'U_min',
        text: '可以，但要看天氣',
        quotedMessageId: 'M1',
      }),
    ])
    expect(woven.promptText.split('\n')[1]).toBe(
      '#2 [夥伴B] （回覆 #1） 可以，但要看天氣'
    )
  })

  it('quotedMessageId 引用不存在的 id → 不註記', () => {
    const woven = weaveTranscript([
      entry({
        messageId: 'M2',
        timestamp: 2_000,
        text: '可以',
        quotedMessageId: 'M_gone',
      }),
    ])
    expect(woven.promptText).toBe('#1 [夥伴A] 可以')
    expect(woven.promptText).not.toContain('回覆')
  })

  it("kind: 'image' 且 text 非空 → 行加（截圖）標記", () => {
    const woven = weaveTranscript([
      entry({
        messageId: 'M1',
        timestamp: 1_000,
        kind: 'image',
        text: '報價單：包車一日 2500 泰銖',
      }),
    ])
    expect(woven.promptText).toBe(
      '#1 [夥伴A] （截圖） 報價單：包車一日 2500 泰銖'
    )
    expect(woven.unreadableImageCount).toBe(0)
  })

  it("kind: 'image' 且 text 空 → 不入文、計入 unreadableImageCount、不佔行號", () => {
    const woven = weaveTranscript([
      entry({ messageId: 'M1', timestamp: 1_000, text: '前一句' }),
      entry({
        messageId: 'M_img',
        timestamp: 2_000,
        kind: 'image',
        text: '',
      }),
      entry({ messageId: 'M3', timestamp: 3_000, text: '後一句' }),
    ])
    expect(woven.promptText).toBe(
      ['#1 [夥伴A] 前一句', '#2 [夥伴A] 後一句'].join('\n')
    )
    expect(woven.unreadableImageCount).toBe(1)
    // 讀不到的圖不佔行號，但仍在 scannedMessageIds（要標 distilled，否則每輪重複報告）
    expect(woven.scannedMessageIds).toEqual(['M1', 'M_img', 'M3'])
    expect(woven.lineToMessageId).toEqual({ 1: 'M1', 2: 'M3' })
  })

  it('text 含 \\n（多行 OCR 內容）→ 換行原樣保留，#n 邏輯行數不受實體行數影響', () => {
    const woven = weaveTranscript([
      entry({
        messageId: 'M1',
        timestamp: 1_000,
        kind: 'image',
        text: '價目表：\n包車一日 2500\n導遊一日 1500',
      }),
      entry({ messageId: 'M2', timestamp: 2_000, text: '收到' }),
    ])
    // 內文換行原樣保留 → promptText 實體行數（4）> #n 邏輯行數（2）
    expect(woven.promptText).toBe(
      '#1 [夥伴A] （截圖） 價目表：\n包車一日 2500\n導遊一日 1500\n#2 [夥伴A] 收到'
    )
    expect(woven.promptText.split('\n')).toHaveLength(4)
    // 下一則訊息的 #n 標記照常正確（邏輯行號不被內文換行撐大）
    expect(woven.lineToMessageId).toEqual({ 1: 'M1', 2: 'M2' })
  })

  it("kind: 'text' 且 text 空（防衛）→ 跳過不入文、不計 unreadableImageCount、照進 scannedMessageIds", () => {
    const woven = weaveTranscript([
      entry({ messageId: 'M1', timestamp: 1_000, text: '前一句' }),
      entry({ messageId: 'M_empty', timestamp: 2_000, text: '' }),
      entry({ messageId: 'M3', timestamp: 3_000, text: '後一句' }),
    ])
    expect(woven.promptText).toBe(
      ['#1 [夥伴A] 前一句', '#2 [夥伴A] 後一句'].join('\n')
    )
    expect(woven.unreadableImageCount).toBe(0)
    expect(woven.scannedMessageIds).toEqual(['M1', 'M_empty', 'M3'])
    expect(woven.lineToMessageId).toEqual({ 1: 'M1', 2: 'M3' })
  })

  it('scannedMessageIds ＝ 所有輸入 entry 的 messageId', () => {
    const woven = weaveTranscript([
      entry({ messageId: 'Mb', timestamp: 2_000 }),
      entry({ messageId: 'Ma', timestamp: 1_000 }),
      entry({ messageId: 'Mc', timestamp: 3_000, kind: 'image', text: '' }),
    ])
    expect([...woven.scannedMessageIds].sort()).toEqual(['Ma', 'Mb', 'Mc'])
  })

  it('lineToMessageId：行號 → messageId 正確映射', () => {
    const woven = weaveTranscript([
      entry({ messageId: 'M2', timestamp: 2_000, text: '第二' }),
      entry({ messageId: 'M1', timestamp: 1_000, text: '第一' }),
    ])
    expect(woven.lineToMessageId).toEqual({ 1: 'M1', 2: 'M2' })
  })

  it('priority: true → 行加（已標記）標註', () => {
    const woven = weaveTranscript([
      entry({
        messageId: 'M1',
        timestamp: 1_000,
        text: '高山路線備案在這',
        priority: true,
      }),
    ])
    expect(woven.promptText).toBe('#1 [夥伴A] （已標記） 高山路線備案在這')
  })

  it('引用＋截圖＋priority 同行 → 部件順序固定、單空格分隔', () => {
    const woven = weaveTranscript([
      entry({ messageId: 'M1', timestamp: 1_000, text: '原問題' }),
      entry({
        messageId: 'M2',
        timestamp: 2_000,
        lineUserId: 'U_min',
        kind: 'image',
        text: '截圖回覆內容',
        quotedMessageId: 'M1',
        priority: true,
      }),
    ])
    expect(woven.promptText.split('\n')[1]).toBe(
      '#2 [夥伴B] （回覆 #1） （截圖） （已標記） 截圖回覆內容'
    )
  })
})
