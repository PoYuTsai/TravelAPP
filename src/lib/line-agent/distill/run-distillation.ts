/**
 * run-distillation.ts — 沉澱刀2 orchestrator：「沉澱」指令的完整流程
 * （design 2026-06-11 §2 ②③④）.
 *
 * 純邏輯模組 — store / source 全注入，router 接線在 Task 7。流程：
 *   掃檔（同 groupId、未 distilled）→ thread-weaver 織串 → 一次 LLM →
 *   zero-trust 解析 → carryover 合併（略過兩次即棄）→ pending 寫入 →
 *   逐筆標 distilled。
 *
 * 紀律：
 *   - 失敗零副作用：source / parse throw → 不標 distilled、不寫 pending、
 *     回固定錯誤文案 — 重跑冪等（30 天窗內資料還在）。
 *   - 寫入順序：pending 先、distilled 後 — pending 寫失敗時 entries 未標，
 *     下次重掃即可；反過來會永遠丟掉這批。
 *   - markTranscriptDistilled 單筆失敗吞掉繼續 — 漏標只是下次重掃，
 *     比中斷整批好（fixed-code log）。
 *   - resolved 原樣保留 — 那是刀3 寫 Notion 的輸入，絕不洗掉。
 */

import type { CaseStore } from '../storage/store'
import type { AgentLogger } from '../observability/structured-log'
import type { HandlerResult } from '../commands/handlers'
import type { TranscriptEntry } from '../transcript/transcript-entry'
import { weaveTranscript } from './thread-weaver'
import { parseDistillCandidates, DistillParseError, type ParsedCandidate } from './candidates'
import type { DistillSource } from './distill-llm-adapter'
import type { DistillCandidate, DistillPendingBatch } from './pending'

// ---------------------------------------------------------------------------
// 環境閘（default off — 同 isTranscriptCaptureEnabled 慣例）
// ---------------------------------------------------------------------------

export function isDistillEnabled(
  env: Record<string, string | undefined>
): boolean {
  return (env.AI_AGENT_DISTILL_ENABLED ?? '').trim().toLowerCase() === 'true'
}

// ---------------------------------------------------------------------------
// 指令判定 — 剝 @mention 後全等「沉澱」才算（杜絕「幫我看看沉澱物」誤觸）
// ---------------------------------------------------------------------------

export function isDistillCommand(text: string): boolean {
  return text.replace(/@\S+/g, '').trim() === '沉澱'
}

// ---------------------------------------------------------------------------
// 固定文案（exported for tests — 排版以測試鎖定）
// ---------------------------------------------------------------------------

export const DISTILL_NO_NEW_MESSAGES_TEXT = '30 天內沒有新的可沉澱訊息'
export const DISTILL_NO_CANDIDATES_TEXT = '這批訊息裡沒有找到重複的常規問答'
export const DISTILL_FAILURE_TEXT = '沉澱失敗，請稍後重試'

/** 被貼出 ≥2 次沒回應即不再提（行動即投票 — design §3 ④）。 */
export const DISTILL_MISSED_DROP_AT = 2

// ---------------------------------------------------------------------------
// 回覆文案組裝
// ---------------------------------------------------------------------------

const EMOJI_DIGITS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

/**
 * 1-9 用 emoji 編號；>9 用「10.」普通編號。
 * 10 是可達常態（carryover 上限 5＋新候選上限 5）；成長有界 —
 * missedCount 達 2 即棄，carryover 不會無限堆積。
 */
function numberLabel(id: number): string {
  return id >= 1 && id <= 9 ? EMOJI_DIGITS[id - 1] : `${id}.`
}

function composeCandidateReply(
  candidates: DistillCandidate[],
  unreadableImageCount: number
): string {
  const lines = [`📚 沉澱候選（${candidates.length} 條）：`]
  for (const c of candidates) {
    lines.push(`${numberLabel(c.id)} Q：${c.question}`)
    lines.push(`　A：${c.answer}（出現 ${c.occurrences} 次）`)
  }
  lines.push('回覆方式：「1 3 要」｜「都要」｜「2 改成〇〇再收」；不回的下次沉澱再提。')
  if (unreadableImageCount > 0) {
    lines.push(`⚠️ 有 ${unreadableImageCount} 張截圖讀不到，已略過`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

export interface RunDistillationInput {
  groupId: string
  store: CaseStore
  source: DistillSource
  /** ms since epoch — injected for determinism. */
  now: number
  log?: AgentLogger
}

function errorResult(reason: string): HandlerResult {
  return {
    handler: 'runDistillation',
    status: 'error',
    outboundText: DISTILL_FAILURE_TEXT,
    meta: { reason },
  }
}

export async function runDistillation(
  input: RunDistillationInput
): Promise<HandlerResult> {
  const { groupId, store, source, now, log } = input

  // ① 掃檔：只取本群、未 distilled 的（distilled=true 掃過即不重掃）
  const all = await store.listTranscriptEntries()
  const fresh = all.filter((e) => e.groupId === groupId && e.distilled !== true)

  // ② carryover：舊 batch 的 pending 候選 missedCount+1；達 2 即棄（行動即投票）。
  //    resolved 原樣保留 — 刀3 的輸入，絕不洗掉。
  const oldBatch = await store.getDistillPending(groupId)
  const carryover: DistillCandidate[] = (oldBatch?.candidates ?? [])
    .filter((c) => c.status === 'pending' && c.missedCount + 1 < DISTILL_MISSED_DROP_AT)
    .map((c) => ({ ...c, missedCount: c.missedCount + 1 }))
  const resolved = oldBatch?.resolved ?? []

  /** 重編 id 1..N（Eric 回「1 3 要」對的是呈現編號）。 */
  const renumber = (candidates: DistillCandidate[]): DistillCandidate[] =>
    candidates.map((c, i) => ({ ...c, id: i + 1 }))

  const writeBatch = async (candidates: DistillCandidate[]) => {
    await store.putDistillPending({
      groupId,
      createdAt: now,
      candidates,
      resolved,
    } satisfies DistillPendingBatch)
    // 新 batch ＝ 編號重編 → 舊複述確認在源頭作廢（best-effort：刪失敗時
    // resolve 端的 batchCreatedAt 比對＋KV TTL 雙兜底）。
    try {
      await store.deleteDistillConfirmation(groupId)
    } catch {
      log?.('store_write_failed', { reason: 'distill_confirmation_delete_failed' })
    }
  }

  // ③ 零新訊息：不叫 source（沒得織就沒得花錢）。
  if (fresh.length === 0) {
    if (carryover.length === 0) {
      // 被略過的事實要記錄 — 但舊 batch 不存在就不無中生有寫入。
      try {
        if (oldBatch) await writeBatch([])
      } catch {
        log?.('store_write_failed', { reason: 'distill_pending_write_failed' })
        return errorResult('distill_pending_write_failed')
      }
      return {
        handler: 'runDistillation',
        status: 'stub_ok',
        outboundText: DISTILL_NO_NEW_MESSAGES_TEXT,
      }
    }
    // 沒新訊息但有 carryover → 只重貼 carryover（不掃、不標 distilled）
    const renumbered = renumber(carryover)
    try {
      await writeBatch(renumbered)
    } catch {
      log?.('store_write_failed', { reason: 'distill_pending_write_failed' })
      return errorResult('distill_pending_write_failed')
    }
    return {
      handler: 'runDistillation',
      status: 'stub_ok',
      outboundText: composeCandidateReply(renumbered, 0),
      meta: {
        scannedCount: 0,
        candidateCount: renumbered.length,
        carryoverCount: carryover.length,
        unreadableImageCount: 0,
      },
    }
  }

  // ④ 織串 → 一次 LLM → zero-trust 解析。throw → 零副作用、固定文案。
  //    空 prompt（fresh 全是 OCR 失敗截圖 — 刀1 閘關時的常態）絕不打 LLM：
  //    API 必 400 → error → 不標 distilled → 每輪重複失敗死循環。視同零候選。
  const woven = weaveTranscript(fresh)
  let parsed: ParsedCandidate[]
  if (woven.promptText === '') {
    parsed = []
  } else {
    let raw: string
    try {
      raw = await source(woven.promptText)
    } catch {
      // Raw error 可能帶 transport 細節 — 吞掉只留 fixed code。
      return errorResult('distill_source_failed')
    }
    try {
      parsed = parseDistillCandidates(raw)
    } catch (e) {
      return errorResult(
        e instanceof DistillParseError ? `distill_parse_${e.code}` : 'distill_parse_failed'
      )
    }
  }

  // ⑤ sourceLines → sourceMessageIds（去重；無效行號跳過）；合併 carryover。
  const newCandidates: DistillCandidate[] = parsed.map((p) => ({
    id: 0, // renumber 重編 1..N
    question: p.question,
    answer: p.answer,
    sourceMessageIds: [
      ...new Set(
        p.sourceLines
          .map((line) => woven.lineToMessageId[line])
          .filter((id): id is string => id !== undefined)
      ),
    ],
    occurrences: p.occurrences,
    status: 'pending',
    missedCount: 0,
  }))
  const combined = renumber([...carryover, ...newCandidates])

  // ⑥ pending 寫入成功後才標 distilled（順序鐵律 — 反過來會永遠丟掉這批）。
  //    [] 且無 carryover：沒東西可呈現就不無中生有寫 batch（除非舊 batch
  //    存在 — missedCount 更新要落地），但掃過了就要標 distilled。
  try {
    if (combined.length > 0 || oldBatch) await writeBatch(combined)
  } catch {
    log?.('store_write_failed', { reason: 'distill_pending_write_failed' })
    return errorResult('distill_pending_write_failed')
  }

  for (const messageId of woven.scannedMessageIds) {
    try {
      await store.markTranscriptDistilled(messageId)
    } catch {
      // 單筆失敗吞掉繼續 — 漏標只是下次重掃，比中斷好。
      log?.('store_write_failed', { reason: 'distill_mark_failed' })
    }
  }

  if (combined.length === 0) {
    // 讀不到的截圖照報（含空 prompt 整批讀不到的情境）— 沉默會讓人以為被吃掉。
    const lines = [DISTILL_NO_CANDIDATES_TEXT]
    if (woven.unreadableImageCount > 0) {
      lines.push(`⚠️ 有 ${woven.unreadableImageCount} 張截圖讀不到，已略過`)
    }
    return {
      handler: 'runDistillation',
      status: 'stub_ok',
      outboundText: lines.join('\n'),
      meta: {
        scannedCount: woven.scannedMessageIds.length,
        unreadableImageCount: woven.unreadableImageCount,
      },
    }
  }

  return {
    handler: 'runDistillation',
    status: 'stub_ok',
    outboundText: composeCandidateReply(combined, woven.unreadableImageCount),
    meta: {
      scannedCount: woven.scannedMessageIds.length,
      candidateCount: combined.length,
      carryoverCount: carryover.length,
      unreadableImageCount: woven.unreadableImageCount,
    },
  }
}
