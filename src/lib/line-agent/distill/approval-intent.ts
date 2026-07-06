/**
 * approval-intent.ts — 刀A 層2 LLM 回傳的零信任解析（mirror candidates.ts 紀律）。
 * 模型輸出一律不可信：失敗回 null（caller 走防呆兜底文案），絕不 throw。
 */

import { DISTILL_FIELD_MAX_CHARS } from './candidates'

export type ApprovalIntentConfidence = 'high' | 'low'

export type ApprovalIntent =
  | { action: 'approve'; indices: number[]; confidence: ApprovalIntentConfidence }
  | { action: 'approve_all'; confidence: ApprovalIntentConfidence }
  | { action: 'modify'; index: number; newAnswer: string; confidence: ApprovalIntentConfidence }
  | { action: 'not_approval' }

/** 剝 code fence（```json … ``` 或 ``` … ```）— LLM 慣性防衛，同 candidates.ts。 */
function stripCodeFence(raw: string): string {
  const text = raw.trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fence ? fence[1].trim() : text
}

function isPositiveInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1
}

function parseConfidence(v: unknown): ApprovalIntentConfidence | null {
  return v === 'high' || v === 'low' ? v : null
}

/**
 * 注意：indices / index 只驗證「正整數」下界；上界（是否超出實際候選清單長度）
 * 由 caller 對照當下的 candidate list 驗證。
 */
export function parseApprovalIntentJson(raw: string): ApprovalIntent | null {
  let data: unknown
  try {
    data = JSON.parse(stripCodeFence(raw))
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const obj = data as Record<string, unknown>

  if (obj.action === 'not_approval') return { action: 'not_approval' }

  const confidence = parseConfidence(obj.confidence)
  if (confidence === null) return null

  if (obj.action === 'approve_all') return { action: 'approve_all', confidence }

  if (obj.action === 'approve') {
    if (!Array.isArray(obj.indices)) return null
    if (!obj.indices.every(isPositiveInt)) return null
    const indices = [...new Set(obj.indices as number[])]
    if (indices.length === 0) return null
    return { action: 'approve', indices, confidence }
  }

  if (obj.action === 'modify') {
    if (!isPositiveInt(obj.index)) return null
    if (typeof obj.newAnswer !== 'string') return null
    const newAnswer = obj.newAnswer.trim().slice(0, DISTILL_FIELD_MAX_CHARS)
    if (newAnswer === '') return null
    return { action: 'modify', index: obj.index, newAnswer, confidence }
  }

  return null
}
