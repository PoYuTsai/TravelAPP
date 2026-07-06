/**
 * oa-contact-recorder.ts — 廣告刀1：LINE OA 被動記錄層。
 *
 * 以 LINE userId 為 key，被動記錄 OA 客人「加好友 → 首則訊息」的軌跡，供每日
 * 轉換表自動填 Sheet 用（見 oa-contact-record.ts）。只讀不回 — 絕不觸發任何對
 * 客自動回覆。
 *
 * 紀律（照 archiver.ts 範式）：
 *   - 整層被 AI_AGENT_OA_CAPTURE_ENABLED 閘住（default off）。未開 → 零寫入、
 *     byte-identical。
 *   - FAIL-SAFE：任何失敗（store 壞）一律吞掉 — 絕不 throw、絕不堵 webhook
 *     主流程、絕不觸發 LINE 重送。
 *   - 冪等：follow 已記過 followedAt 就不覆寫；重複 follow 不改 timestamp。
 *   - 只處理 line_oa 的 oa_follow / oa_text，其餘事件（image/sticker/夥伴群…）
 *     一律略過（熱路徑零成本）。
 */

import type { NormalizedLineEvent } from '../line/event-normalizer'
import type { CaseStore } from '../storage/store'
import type { AgentLogger } from '../observability/structured-log'
import {
  OA_MESSAGES_MAX,
  OA_TEXT_MAX_CHARS,
  type OaContactRecord,
} from './oa-contact-record'

// ---------------------------------------------------------------------------
// 環境閘（default off — 記錄客人聯絡軌跡有隱私重量，必須顯式打開）
// ---------------------------------------------------------------------------

export function isOaCaptureEnabled(
  env: Record<string, string | undefined>
): boolean {
  return (env.AI_AGENT_OA_CAPTURE_ENABLED ?? '').trim().toLowerCase() === 'true'
}

export interface OaContactRecorderDeps {
  /** 環境（閘）。 */
  env: Record<string, string | undefined>
  /** Per-request structured logger（可選）；只記固定 code，raw store error 可能 echo KV url。 */
  log?: AgentLogger
}

// ---------------------------------------------------------------------------
// 主函式 — best-effort、永不 throw
// ---------------------------------------------------------------------------

/**
 * 廣告刀1 被動記錄。fail-safe：任何失敗吞掉，絕不 throw、絕不堵 webhook。
 * 只處理 line_oa 的 oa_follow / oa_text 事件，其餘一律略過。
 */
export async function recordOaContactEvent(
  event: NormalizedLineEvent,
  store: CaseStore,
  deps: OaContactRecorderDeps
): Promise<void> {
  try {
    if (!isOaCaptureEnabled(deps.env)) return
    // 只記 OA 客人面 — 夥伴群與未知來源一律不入此 namespace。
    if (event.sourceChannel !== 'line_oa') return
    const userId = event.lineUserId
    if (userId === '') return

    if (event.kind === 'oa_follow') {
      const existing = await store.getOaContactRecord(userId)
      // 冪等：已記過加好友日就不覆寫（LINE 可能重送 follow）。
      if (existing?.followedAt) return
      await store.putOaContactRecord({
        ...(existing ?? { userId }),
        userId,
        followedAt: event.timestamp,
      })
      return
    }

    if (event.kind === 'oa_text') {
      const text = (event.text ?? '').trim()
      if (text === '') return
      const existing: OaContactRecord = (await store.getOaContactRecord(
        userId
      )) ?? { userId }
      const messages = [
        ...(existing.messages ?? []),
        { ts: event.timestamp, text: text.slice(0, OA_TEXT_MAX_CHARS) },
      ].slice(-OA_MESSAGES_MAX)
      await store.putOaContactRecord({
        ...existing,
        userId,
        firstMessageAt: existing.firstMessageAt ?? event.timestamp,
        messages,
      })
      return
    }

    // 其他事件（image/file/sticker/夥伴群…）→ 略過（熱路徑零成本）。
  } catch {
    // FAIL-SAFE：記錄失敗 → 丟該則，絕不堵 webhook。
    // Code-only log（reason 固定碼）：raw store error 可能 echo KV url。
    deps.log?.('store_write_failed', { reason: 'oa_contact_record_failed' })
  }
}
