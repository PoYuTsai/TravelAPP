/**
 * summary-adapter.ts — 廣告刀7：LINE OA 詢問三欄摘要（Haiku）。
 *
 * 把 OA 被動記錄的訊息串濃縮成 { inquiry, headcount, amount } 三欄，供每日
 * 轉換表填 Sheet 用。設計為 fail-open：任何失敗（閘關 / cap 超 / LLM 拋 /
 * 回非 JSON）一律退「原文節錄」fallback，**永不 throw** — 摘要只是加值，不能
 * 讓它擋掉每日匯出主流程。
 *
 * 紀律（照 archiver / oa-contact-recorder 範式）：
 *   - 整層被 AI_AGENT_ADS_SUMMARY_ENABLED 閘住（default off）。未開 → 不呼叫
 *     LLM、直接回原文節錄。
 *   - 日 cap：checkBudget() !== 'ok' → 不打 LLM、退 fallback（照
 *     anthropic-call.ts 的 BUDGET GATE 紀律）。recordSpend 由 composition
 *     root（Task 8）於成功後負責。
 *   - LLM transport 注入（deps.llm）— 本層不 import SDK；測試注入 fake、prod
 *     由 composition root 綁 callAnthropicMessages（Haiku）。
 */

import type { OaContactMessage } from './oa-contact-record'

export interface OaSummary {
  inquiry: string
  headcount: string
  amount: string
}

// ---------------------------------------------------------------------------
// 環境閘（default off）
// ---------------------------------------------------------------------------

export function isAdsSummaryEnabled(env: Record<string, string | undefined>): boolean {
  return (env.AI_AGENT_ADS_SUMMARY_ENABLED ?? '').trim().toLowerCase() === 'true'
}

/**
 * 窄化的 cost cap surface：checkBudget 回 'ok' 才可打 LLM。
 * 與 DailyCostCap 相容（composition root 可綁一個 'ok' | outcome 的 adapter）。
 */
export interface AdsCostCap {
  checkBudget(): Promise<'ok' | string>
  recordSpend(usd: number): Promise<void>
}

export interface SummaryDeps {
  /** 環境（閘＋模型選擇）。 */
  env: Record<string, string | undefined>
  /** 由 composition root 綁 callAnthropicMessages（Haiku）。 */
  llm: (prompt: string) => Promise<string>
  /** 日 cap（可選）；非 'ok' 一律不打 LLM。 */
  costCap?: AdsCostCap
  /** 固定碼 log（可選）；raw error 可能含敏感字，只記 code。 */
  log?: (code: string, meta?: Record<string, unknown>) => void
}

// ---------------------------------------------------------------------------
// Fallback：原文節錄（永不拋）
// ---------------------------------------------------------------------------

const EXCERPT_MAX = 60

function excerpt(messages: OaContactMessage[]): string {
  if (!Array.isArray(messages)) return ''
  const first = messages.map((m) => (m?.text ?? '').trim()).find((t) => t !== '') ?? ''
  return first.length > EXCERPT_MAX ? `${first.slice(0, EXCERPT_MAX)}…` : first
}

function buildPrompt(messages: OaContactMessage[]): string {
  const body = messages.map((m) => m.text).join('\n')
  return (
    `以下是一位 LINE 客人的詢問訊息。抽出三欄，只回 JSON（無其他字）：\n` +
    `{"inquiry":"一句話詢問項目摘要","headcount":"人數如 4大2小，抽不到留空字串","amount":"預估金額如 NT$20000，抽不到留空字串"}\n\n` +
    `訊息：\n${body}`
  )
}

function parseSummary(raw: string): OaSummary | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return null
    const o = JSON.parse(m[0])
    if (typeof o.inquiry !== 'string') return null
    return { inquiry: o.inquiry, headcount: String(o.headcount ?? ''), amount: String(o.amount ?? '') }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// 主函式 — fail-open，永不 throw
// ---------------------------------------------------------------------------

export async function summarizeOaInquiry(
  input: { messages: OaContactMessage[] },
  deps: SummaryDeps,
): Promise<OaSummary> {
  const fallback: OaSummary = { inquiry: excerpt(input.messages), headcount: '', amount: '' }
  try {
    if (!isAdsSummaryEnabled(deps.env)) return fallback
    if (deps.costCap && (await deps.costCap.checkBudget()) !== 'ok') return fallback
    const raw = await deps.llm(buildPrompt(input.messages))
    return parseSummary(raw) ?? fallback
  } catch {
    deps.log?.('ads_summary_failed', {})
    return fallback
  }
}
