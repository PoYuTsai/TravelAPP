/**
 * thread-weaver.ts — 沉澱刀2：把 30 天 transcript 織成 LLM 可讀對話串
 * （design 2026-06-11 §2 ③「按引用關係+時間織成對話串」）.
 *
 * 純函式零 I/O。發話者匿名化（夥伴A/B/C…）— raw lineUserId 永不進 prompt。
 * 行格式：`#行號 [夥伴A] （回覆 #m） （截圖） （已標記） text`，缺的部件省略。
 */

import type { TranscriptEntry } from '../transcript/transcript-entry'

export interface WovenTranscript {
  /** 給 LLM 的對話串全文；空存檔時為 ''。 */
  promptText: string
  /** OCR 失敗的截圖數（text === ''）— 過目回覆裡如實報告。 */
  unreadableImageCount: number
  /** 本次掃過的所有 messageId（成功沉澱後標 distilled 用）。 */
  scannedMessageIds: string[]
  /** # 行號 → messageId（LLM 回 sourceLines 後映回出處用）。 */
  lineToMessageId: Record<number, string>
}

export function weaveTranscript(entries: TranscriptEntry[]): WovenTranscript {
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp)
  const alias = new Map<string, string>()
  const lineNoByMessageId = new Map<string, number>() // messageId → 行號（引用註記用）
  const lineToMessageId: Record<number, string> = {}
  const lines: string[] = []
  let unreadableImageCount = 0

  for (const e of sorted) {
    if (e.kind === 'image' && e.text === '') {
      // OCR 失敗的截圖：不入文（沒內容可織），但仍要被掃到 → scannedMessageIds 照收
      unreadableImageCount += 1
      continue
    }
    if (!alias.has(e.lineUserId)) {
      // 夥伴A..Z，超過 26 人回繞補數字（防衛性；實際群遠小於此）
      const n = alias.size
      alias.set(
        e.lineUserId,
        `夥伴${String.fromCharCode(65 + (n % 26))}${n >= 26 ? n : ''}`
      )
    }
    const lineNo = lines.length + 1
    lineNoByMessageId.set(e.messageId, lineNo)
    lineToMessageId[lineNo] = e.messageId
    const quotedLineNo =
      e.quotedMessageId !== undefined
        ? lineNoByMessageId.get(e.quotedMessageId)
        : undefined
    const parts = [
      `#${lineNo}`,
      `[${alias.get(e.lineUserId)}]`,
      ...(quotedLineNo !== undefined ? [`（回覆 #${quotedLineNo}）`] : []),
      ...(e.kind === 'image' ? ['（截圖）'] : []),
      // priority ＝ Eric「記一下」標過 — LLM 入選規則（≥2 次或標過）要這個訊號
      ...(e.priority === true ? ['（已標記）'] : []),
      e.text,
    ]
    lines.push(parts.join(' '))
  }

  return {
    promptText: lines.join('\n'),
    unreadableImageCount,
    scannedMessageIds: sorted.map((e) => e.messageId),
    lineToMessageId,
  }
}
