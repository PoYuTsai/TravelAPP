/**
 * archiver.ts — 沉澱管線刀1：旁聽存檔層（design 2026-06-11 §1 ①）.
 *
 * 夥伴群每則文字/截圖被動存進 store（KV TTL 30 天）：
 *   - 文字：直接存，零 LLM 零成本
 *   - 截圖：進群「當下」OCR 成文字一起存（LINE 圖片內容會過期，沉澱時才讀
 *     有缺角風險）；OCR 失敗仍存該筆但 text=''（如實留缺）
 *
 * 紀律：
 *   - 整層被 AI_AGENT_TRANSCRIPT_ENABLED 閘住（default off）。被動旁聽沒有
 *     botDirected，所以不能走 M3-0 'ocr' tool-gate；OCR 花費由 vision adapter
 *     內的 daily cost cap 守第二道（雙閘精神不變）。
 *   - FAIL-SAFE：任何失敗（store 壞、OCR 壞）一律吞掉 — 回覆優先於記錄，
 *     絕不堵 webhook 主流程、絕不觸發 LINE 重送。
 *   - 冪等：寫入前查同 messageId，已存在即跳過 — LINE at-least-once 重送
 *     絕不二次 OCR（錢）也不重複記。
 *   - OA 客人面永不入檔（隱私邊界 — 旁聽的是夥伴群，不是客人）。
 */

import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { CaseStore } from '../storage/store'
import type { AgentLogger } from '../observability/structured-log'
import {
  type TranscriptEntry,
  TRANSCRIPT_TEXT_MAX_CHARS,
} from './transcript-entry'

// ---------------------------------------------------------------------------
// 環境閘（default off — 寫入夥伴對話有隱私重量，必須顯式打開）
// ---------------------------------------------------------------------------

export function isTranscriptCaptureEnabled(
  env: Record<string, string | undefined>
): boolean {
  return (env.AI_AGENT_TRANSCRIPT_ENABLED ?? '').trim().toLowerCase() === 'true'
}

// ---------------------------------------------------------------------------
// OCR seam — webhook 端注入（adapter 蓋 transport + daily cost cap）
// ---------------------------------------------------------------------------

/** 把一張 LINE 圖片 messageId 變成轉錄文字。失敗 throw；archiver 內吞。 */
export type TranscriptOcr = (messageId: string) => Promise<string>

export interface ArchiveDeps {
  /** 注入的 OCR；null/省略 ⇒ 截圖仍入檔但 text=''（無 key 環境的退化）。 */
  ocr?: TranscriptOcr | null
  /** 環境（閘）。 */
  env: Record<string, string | undefined>
  /** Per-request structured logger（可選）。 */
  log?: AgentLogger
}

// ---------------------------------------------------------------------------
// 主函式 — best-effort、永不 throw
// ---------------------------------------------------------------------------

export async function archivePartnerGroupMessage(
  event: NormalizedLineEvent,
  store: CaseStore,
  deps: ArchiveDeps
): Promise<void> {
  try {
    if (!isTranscriptCaptureEnabled(deps.env)) return
    // 只旁聽夥伴群 — OA 客人面（隱私邊界）與未知來源一律不入檔。
    if (event.sourceChannel !== 'line_partner_group') return
    if (event.messageId === '' || !event.groupId) return

    // kind 對映：設計只涵蓋文字+截圖；file / sticker / video 等跳過。
    let kind: TranscriptEntry['kind']
    if (event.kind === 'group_text' || event.kind === 'group_quoted') {
      kind = 'text'
    } else if (event.kind === 'image') {
      kind = 'image'
    } else {
      return
    }

    // 冪等：LINE at-least-once 重送 → 同 messageId 已存在即跳過。
    // 這同時是雙重 OCR 的防線（重送的 image 不再花一次 vision 錢）。
    if ((await store.getTranscriptEntry(event.messageId)) !== null) return

    // 截圖：進群當下 OCR。失敗（或無 seam）→ text=''，如實留缺 —
    // 刀2 沉澱時據此報告「有一張圖讀不到」。
    let text: string
    if (kind === 'image') {
      try {
        text = deps.ocr ? await deps.ocr(event.messageId) : ''
      } catch {
        deps.log?.('store_write_failed', { reason: 'transcript_ocr_failed' })
        text = ''
      }
    } else {
      text = event.text ?? ''
    }

    const entry: TranscriptEntry = {
      messageId: event.messageId,
      groupId: event.groupId,
      lineUserId: event.lineUserId,
      timestamp: event.timestamp,
      kind,
      text: text.slice(0, TRANSCRIPT_TEXT_MAX_CHARS),
      ...(event.quotedRef?.quotedMessageId
        ? { quotedMessageId: event.quotedRef.quotedMessageId }
        : {}),
    }
    await store.putTranscriptEntry(entry)
  } catch {
    // FAIL-SAFE：存檔失敗 → 丟該則，絕不堵 webhook（design 錯誤處理節）。
    // Code-only log：raw store error 可能 echo KV url。
    deps.log?.('store_write_failed', { reason: 'transcript_archive_failed' })
  }
}
