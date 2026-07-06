/**
 * candidates.ts — 沉澱刀2：LLM 候選輸出的 zero-trust 解析層
 * （design 2026-06-11 §2 ④）.
 *
 * Threat model（同 case-intake-enrichment）：LLM 是 UNTRUSTED candidate
 * producer。Adapter（Task 4）只回 raw text；剝 code fence、JSON 解析、
 * schema 防衛、cap 截斷全在本層：
 *
 *   - 必填欄位（question / answer）壞 → throw fail-closed；
 *   - 輔助欄位（occurrences / sourceLines）壞 → 正規化降級（1 / 留正整數），
 *     因為它們只影響展示與出處映射，不值得整批作廢。
 *
 * DistillParseError 一律帶 fixed code、絕不帶 LLM 原文 — raw 可能含
 * 對話內容（夥伴群內文），error message 會進 log。
 */

export const DISTILL_MAX_CANDIDATES = 5
export const DISTILL_FIELD_MAX_CHARS = 500

export interface ParsedCandidate {
  question: string
  answer: string
  /** thread-weaver 的 # 行號（orchestrator 用 lineToMessageId 映回 messageIds）。 */
  sourceLines: number[]
  occurrences: number
}

/** Fixed-code error：invalid_json · not_array · invalid_candidate。 */
export class DistillParseError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'DistillParseError'
    this.code = code
  }
}

/** 剝 code fence（```json … ``` 或 ``` … ```）— LLM 慣性防衛，同 extractJsonValue。 */
function stripCodeFence(raw: string): string {
  const text = raw.trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fence ? fence[1].trim() : text
}

/** 必填字串欄位：非 string 或 trim 後空 → throw；超長 slice 到 500（防衛）。 */
function parseRequiredField(value: unknown): string {
  if (typeof value !== 'string') throw new DistillParseError('invalid_candidate')
  const trimmed = value.trim()
  if (trimmed === '') throw new DistillParseError('invalid_candidate')
  return trimmed.slice(0, DISTILL_FIELD_MAX_CHARS)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

/**
 * 解析 LLM 候選輸出（raw text → ParsedCandidate[]）。
 * 空陣列合法（「完全沒有常規問答」）；超過 5 條只取前 5（cap 內的元素才驗，
 * 第 6 條起的垃圾不該害整批作廢）。
 */
export function parseDistillCandidates(raw: string): ParsedCandidate[] {
  let value: unknown
  try {
    value = JSON.parse(stripCodeFence(raw))
  } catch {
    throw new DistillParseError('invalid_json')
  }
  if (!Array.isArray(value)) throw new DistillParseError('not_array')

  return value.slice(0, DISTILL_MAX_CANDIDATES).map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new DistillParseError('invalid_candidate')
    }
    const rec = item as Record<string, unknown>
    return {
      question: parseRequiredField(rec.question),
      answer: parseRequiredField(rec.answer),
      // 非陣列 → []；陣列 → 只留正整數元素（行號從 1 起算）
      sourceLines: Array.isArray(rec.sourceLines)
        ? rec.sourceLines.filter(isPositiveInteger)
        : [],
      occurrences: isPositiveInteger(rec.occurrences) ? rec.occurrences : 1,
    }
  })
}
